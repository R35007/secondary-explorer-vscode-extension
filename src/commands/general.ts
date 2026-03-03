import * as path from 'path';
import * as vscode from 'vscode';
import { NO_TAGS } from '../constants';
import { FSItem } from '../FSItem';
import { TreeDataProvider } from '../providers/TreeDataProvider';
import { Settings } from '../Settings';
import { getSelectedItems, getSettingSaveTarget, log, pickPaths, pickTags, resolveVariables } from '../utils';

export function getGeneralCommands(treeView: vscode.TreeView<FSItem>, provider: TreeDataProvider) {
  const addToSecondaryExplorer = async (uri: vscode.Uri) => {
    try {
      let uris = [uri];
      const userHome = process.env.HOME || process.env.USERPROFILE || '';

      if (!uri) {
        const picked = await vscode.window.showOpenDialog({
          canSelectFolders: true,
          canSelectFiles: true,
          canSelectMany: true,
          defaultUri: vscode.workspace?.workspaceFolders?.[0].uri || vscode.Uri.file(userHome),
        });

        if (!picked) return;
        uris = picked;
      }

      // 2. If we haven't asked the user in THIS session yet, prompt them
      if (!Settings.hasWorkspacePathSetting && Settings._sessionTarget === undefined) {
        const choice = await getSettingSaveTarget();
        if (!choice) return;
        Settings._sessionTarget = choice;
      }

      const pathsToAdd = uris
        .filter(Boolean)
        .map((u) =>
          resolveVariables(u.fsPath, Settings.hasWorkspacePathSetting || Settings._sessionTarget === vscode.ConfigurationTarget.Workspace),
        );

      Settings.paths = [...Settings.paths, ...pathsToAdd];
      log(`Added paths to Secondary Explorer: ${pathsToAdd.join(', ')}`);
    } catch (err) {
      log(`Failed to add paths to Secondary Explorer: ${String(err)}`);
    }
  };

  const addSelectedToWorkspace = async (item?: FSItem) => {
    try {
      const selectedItems = getSelectedItems(treeView);
      // If multiple items are selected, pick the last one
      const targetItem = selectedItems.length <= 1 && item ? item : selectedItems.at(-1);

      if (!targetItem) return;

      // If it's a file, use its parent folder
      let folderPath: string;
      if (targetItem.type === 'file') {
        folderPath = path.dirname(targetItem.basePath);
      } else {
        folderPath = targetItem.basePath;
      }

      const folderUri = vscode.Uri.file(folderPath);

      // Prevent duplicates: check if already in workspace
      const existing = vscode.workspace.workspaceFolders?.some((f) => f.uri.fsPath === folderUri.fsPath);
      if (existing) return;

      // Add folder to workspace
      vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : 0, null, {
        uri: folderUri,
      });

      vscode.window.setStatusBarMessage(`Added folder "${path.basename(folderPath)}" to workspace`, 2000);
      log(`Added folder to workspace: ${folderPath}`);
    } catch (err) {
      log(`Failed to add folder to workspace: ${String(err)}`);
    }
  };

  const removePath = async (item?: FSItem) => {
    try {
      const treeViewItem = item || getSelectedItems(treeView).at(-1);
      if (!treeViewItem) return;

      if (treeViewItem.rootIndex < 0) return;
      Settings.paths = Settings.paths.filter((_, index) => index !== treeViewItem.rootIndex);
      vscode.window.setStatusBarMessage('Path removed from Secondary Explorer', 1500);
      log(`Removed root path from Secondary Explorer: ${treeViewItem.basePath}`);
    } catch (err) {
      log(`Failed to remove root path from Secondary Explorer: ${String(err)}`);
    }
  };

  const hidePath = async (item?: FSItem) => {
    try {
      const treeViewItem = item || getSelectedItems(treeView).at(-1);
      if (!treeViewItem) return;

      if (treeViewItem.rootIndex < 0) return;

      Settings.updatePathConfig(treeViewItem.rootIndex, { hidden: true });
      vscode.window.setStatusBarMessage('Path set to hidden from Secondary Explorer', 1500);
      log(`Path hidden in Secondary Explorer: ${treeViewItem.basePath}`);
    } catch (err) {
      log(`Failed to hide path in Secondary Explorer: ${String(err)}`);
    }
  };

  const handleTagAssignment = async (tags: string[]) => {
    const selectedIndices = await pickPaths(Settings.parsedPaths, tags);
    if (!selectedIndices) return;

    Settings.paths = Settings.paths.map((p, i) => {
      const isSelected = selectedIndices.has(i);
      const isObj = typeof p !== 'string';
      const current = (isObj ? p.tags : [])?.filter((t) => !!t && t !== NO_TAGS) || [];

      const updated = isSelected ? [...new Set([...current, ...tags])] : current.filter((t) => !tags?.includes(t));

      if (!isObj && !isSelected) return p;
      return isObj ? { ...p, tags: updated } : { basePath: p, tags: updated };
    });
  };

  const handleNoTagsAssignment = async () => {
    const available = provider.tags.filter((t) => t !== NO_TAGS);
    const tags = await pickTags(available);
    if (!tags?.length) return;

    const selectedIndices = await pickPaths(
      Settings.parsedPaths.filter((p) => p.tags.includes(NO_TAGS)),
      tags,
    );
    if (!selectedIndices) return;

    Settings.paths = Settings.paths.map((p, i) => {
      const isSelected = selectedIndices.has(i);
      if (!isSelected) return p;

      const isObj = typeof p !== 'string';
      const current = (isObj ? p.tags : [])?.filter((t) => !!t && t !== NO_TAGS) || [];

      const updated = [...new Set([...current, ...tags])];

      return isObj ? { ...p, tags: updated } : { basePath: p, tags: updated };
    });
  };

  const assignTagToPaths = async (item: FSItem) => {
    try {
      const treeItem = item || getSelectedItems(treeView).at(-1);
      if (!treeItem || !treeItem.tag || !treeItem.isTag) return;

      if (treeItem.tag === NO_TAGS) {
        await handleNoTagsAssignment();
      } else if (treeItem.isTag) {
        await handleTagAssignment([treeItem.tag]);
      }

      log(`Tags updated successfully.`);
    } catch (err) {
      log(`Failed to assign tags: ${err}`);
    }
  };

  const editPathTags = async (item: FSItem) => {
    try {
      const treeViewItem = item || getSelectedItems(treeView).at(-1);
      if (!treeViewItem || treeViewItem.rootIndex < 0) return;

      const updatedTags = await pickTags(
        provider.tags.filter((t) => t !== NO_TAGS),
        item.tags,
      );
      if (!updatedTags) return;

      Settings.updatePathConfig(treeViewItem.rootIndex, { tags: updatedTags });

      log(`Tas update in Secondary Explorer: ${treeViewItem.basePath}`);
    } catch (err) {
      log(`Failed to edit tags in Secondary Explorer: ${String(err)}`);
    }
  };

  const openSettings = () => {
    const showWorkspaceSetting = Settings.hasWorkspacePathSetting || Settings._sessionTarget === vscode.ConfigurationTarget.Workspace;
    vscode.commands.executeCommand(
      showWorkspaceSetting ? 'workbench.action.openWorkspaceSettings' : 'workbench.action.openSettings',
      ' @ext:thinker.secondary-explorer ',
    );
  };

  const generalCommands = {
    refresh: () => provider.refresh?.(),
    openSettings,
    addToSecondaryExplorer,
    addSelectedToWorkspace,
    removePath,
    hidePath,
    assignTagToPaths,
    editPathTags,
  };

  return generalCommands;
}
