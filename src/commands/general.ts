import * as fsx from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { NO_TAGS } from '../constants';
import { FSItem } from '../FSItem';
import { TreeDataProvider } from '../providers/TreeDataProvider';
import { Settings } from '../Settings';
import { getSelectedItems, getSettingSaveTarget, log, pickPaths, pickTags, resolveVariables } from '../utils';

export function getGeneralCommands(treeView: vscode.TreeView<FSItem>, provider: TreeDataProvider) {
  const addToSecondaryExplorer = async (arg: vscode.Uri | FSItem) => {
    try {
      log('Add to Secondary Explorer');
      const userHome = process.env.HOME || process.env.USERPROFILE || '';
      const isCallingFromNativeExplorer = arg && 'scheme' in arg && typeof arg.scheme === 'string';

      let uris: vscode.Uri[] = [arg] as vscode.Uri[];
      if (!isCallingFromNativeExplorer) {
        const picked = await vscode.window.showOpenDialog({
          canSelectFolders: true,
          canSelectFiles: true,
          canSelectMany: true,
          defaultUri: vscode.workspace?.workspaceFolders?.[0].uri || vscode.Uri.file(userHome),
        });

        if (!picked) {
          log('Cancelled');
          return;
        }
        uris = picked;
      }

      // 2. If we haven't asked the user in THIS session yet, prompt them
      if (!Settings.hasWorkspacePathSetting && Settings._sessionTarget === undefined) {
        const choice = await getSettingSaveTarget();
        if (!choice) {
          log('Cancelled');
          return;
        }
        Settings._sessionTarget = choice;
      }

      const pathsToAdd = uris
        .filter(Boolean)
        .map((u) =>
          resolveVariables(
            Settings.addFoldersOnly && fsx.statSync(u.fsPath).isFile() ? path.dirname(u.fsPath) : u.fsPath,
            Settings.hasWorkspacePathSetting || Settings._sessionTarget === vscode.ConfigurationTarget.Workspace,
            Settings.useAbsolutePath,
          ),
        );

      Settings.paths = [...Settings.paths, ...pathsToAdd];
      log(`Added paths to Secondary Explorer: ${pathsToAdd.join(', ')}`);
    } catch (err) {
      log(`Failed to add paths to Secondary Explorer: ${String(err)}`);
    }
  };

  const addSelectedToWorkspace = async (item?: FSItem) => {
    try {
      log('Add to workspace');
      const selectedItems = getSelectedItems(treeView);
      // If multiple items are selected, pick the last one
      const targetItem = selectedItems.length <= 1 && item ? item : selectedItems.at(-1);

      if (!targetItem) {
        log('No item selected');
        return;
      }

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
      if (existing) {
        log('Already in workspace');
        return;
      }

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
      log('Remove path');
      const treeViewItem = item || getSelectedItems(treeView).at(-1);
      if (!treeViewItem) {
        log('No item selected');
        return;
      }

      if (treeViewItem.rootIndex < 0) {
        log('Not a root item');
        return;
      }
      Settings.paths = Settings.paths.filter((_, index) => index !== treeViewItem.rootIndex);
      vscode.window.setStatusBarMessage('Path removed from Secondary Explorer', 1500);
      log(`Removed root path from Secondary Explorer: ${treeViewItem.basePath}`);
    } catch (err) {
      log(`Failed to remove root path from Secondary Explorer: ${String(err)}`);
    }
  };

  const hidePath = async (item?: FSItem) => {
    try {
      log('Hide path');
      const treeViewItem = item || getSelectedItems(treeView).at(-1);
      if (!treeViewItem) {
        log('No item selected');
        return;
      }

      if (treeViewItem.rootIndex < 0) {
        log('Not a root item');
        return;
      }

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
    Settings.updateSettingsTags(selectedIndices, tags, true);
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

    Settings.updateSettingsTags(selectedIndices, tags, false);
  };

  const assignTagToPaths = async (item: FSItem) => {
    try {
      log('Assign tags');
      const treeItem = item || getSelectedItems(treeView).at(-1);
      if (!treeItem || !treeItem.tag || !treeItem.isTag) {
        log('Not a valid tag item');
        return;
      }

      if (treeItem.tag === NO_TAGS) {
        await handleNoTagsAssignment();
      } else if (treeItem.isTag) {
        await handleTagAssignment([treeItem.tag]);
      }

      log(`Tags assigned successfully`);
    } catch (err) {
      log(`Failed to assign tags: ${err}`);
    }
  };

  const editPathTags = async (item: FSItem) => {
    try {
      log('Edit tags');
      const treeViewItem = item || getSelectedItems(treeView).at(-1);
      if (!treeViewItem || treeViewItem.rootIndex < 0) {
        log('Not a valid root item');
        return;
      }

      const updatedTags = await pickTags(
        provider.tags.filter((t) => t !== NO_TAGS),
        item.tags,
      );
      if (!updatedTags) {
        log('Cancelled');
        return;
      }

      Settings.updatePathConfig(treeViewItem.rootIndex, { tags: updatedTags });

      log(`Tags updated: ${treeViewItem.basePath}`);
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
