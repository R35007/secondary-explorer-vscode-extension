import * as fsExtra from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { FSItem } from '../models/FSItem';
import { SecondaryExplorerProvider } from '../providers/SecondaryExplorerProvider';
import { isWindows, windowsInvalidName } from '../utils/constants';
import { Settings } from '../utils/Settings';
import { exists, existsAsync, getSelectedItems, sanitizeRelative, splitNameExt } from '../utils/utils';

export function registerCommands(context: vscode.ExtensionContext, provider: SecondaryExplorerProvider, treeView: vscode.TreeView<FSItem>) {
  // Clipboard state for cut/copy/paste
  let clipboard: { type: 'cut' | 'copy'; items: FSItem[] } | null = null;

  const addToSecondaryExplorer = async (uriOrUris: vscode.Uri | vscode.Uri[]) => {
    const uris: vscode.Uri[] = Array.isArray(uriOrUris) ? uriOrUris : uriOrUris ? [uriOrUris] : [];

    if (!uris.length) return vscode.window.showWarningMessage('No file or folder selected.');

    const pathsToAdd = uris.map((u) => u.fsPath);
    const existing = Settings.paths;
    Settings.paths = [...new Set([...existing, ...pathsToAdd])];
    provider.refresh?.();
  };

  const pickPath = async () => {
    const hasWorkspaceFolders = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0;
    const defaultUri = hasWorkspaceFolders ? vscode.workspace?.workspaceFolders?.[0].uri : vscode.Uri.file(require('os').homedir());
    const picked = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: true,
      canSelectMany: true,
      defaultUri,
    });

    if (!picked?.length) return;

    const pickedPaths = picked.map((p) => p.fsPath);
    const existing = Settings.paths;
    Settings.paths = [...new Set([...existing, ...pickedPaths])];
  };

  const openInTerminal = async (item?: FSItem) => {
    const treeViewItem = item || getSelectedItems(treeView).at(-1);
    if (!treeViewItem) return;

    const targetPath = treeViewItem.type === 'file' ? path.dirname(treeViewItem.fullPath) : treeViewItem.fullPath;
    const term = vscode.window.createTerminal({ cwd: targetPath });
    term.show();
  };

  const openFolderInNewWindow = async (item?: FSItem) => {
    const treeViewItem = item || getSelectedItems(treeView).at(-1);
    if (!treeViewItem) return;

    const targetFolder = treeViewItem.type === 'file' ? path.dirname(treeViewItem.fullPath) : treeViewItem.fullPath;
    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(targetFolder), true);
  };

  const removePath = async (item?: FSItem) => {
    const treeViewItem = item || getSelectedItems(treeView).at(-1);
    if (!treeViewItem) return;

    if (treeViewItem.rootIndex < 0) {
      vscode.window.showWarningMessage('This path is not a root path in the configuration.');
      return;
    }
    Settings.paths = Settings.paths.filter((_, index) => index !== treeViewItem.rootIndex);
    provider.refresh();
    vscode.window.setStatusBarMessage('Path removed from Secondary Explorer', 1500);
  };

  const createEntry = async (item?: FSItem) => {
    const treeViewItem = item || getSelectedItems(treeView).at(-1);
    if (!treeViewItem) return;

    const basePath = treeViewItem.type === 'folder' ? treeViewItem.fullPath : path.dirname(treeViewItem?.fullPath);
    // get the nearest rootPath
    const nearestRootPath =
      Settings.parsedPaths.find((p) => basePath.replace(/\\/g, '/').toLowerCase().startsWith(p.basePath.replace(/\\/g, '/').toLowerCase()))
        ?.basePath || basePath;
    const displayPath = path.relative(nearestRootPath, basePath)
      ? `${path.basename(nearestRootPath)}/${path.relative(nearestRootPath, basePath)}`
      : path.basename(nearestRootPath);

    const value = await vscode.window.showInputBox({
      title: 'New File or Folder',
      prompt: `Create in "${displayPath}"`,
      placeHolder: 'Enter name or path (e.g. folder, folder/file.ext)',
      validateInput: async (raw: string) => {
        const input = raw.trim();
        if (!input) return 'Name is required';
        if (path.isAbsolute(input)) return 'Provide a relative path, not absolute';
        const rel = sanitizeRelative(input);
        const leaf = path.basename(rel);
        if (isWindows && windowsInvalidName.test(leaf)) return 'Name contains invalid characters';
        const target = path.resolve(basePath, rel);
        if (await exists(target)) return 'File or folder already exists';
        return undefined;
      },
    });
    if (!value) return;

    const rel = sanitizeRelative(value);
    const target = path.resolve(basePath, rel);
    try {
      const leaf = path.basename(rel);
      const isFile = !!path.extname(leaf) || (leaf.startsWith('.') && leaf.length > 1);
      isFile ? await fsExtra.ensureFile(target) : await fsExtra.ensureDir(target);
      if (isFile) {
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(target));
        await vscode.window.showTextDocument(doc);
      }
      provider.refresh();
    } catch (e) {
      vscode.window.showErrorMessage('Failed to create entry: ' + String(e));
    }
  };

  const openFile = async (item?: FSItem) => {
    const selectedFiles = getSelectedItems(treeView).filter((i) => i.type === 'file');
    const filesToOpen = selectedFiles.length <= 1 && item ? (item.type === 'file' ? [item] : []) : selectedFiles;
    if (!filesToOpen.length) return;
    // Open each file
    for (let fileItem of filesToOpen) {
      const uri = vscode.Uri.file(fileItem.fullPath);
      await vscode.window.showTextDocument(uri, { preview: filesToOpen.length === 1, preserveFocus: true });
    }
    try {
      item && (await treeView.reveal(item, { select: true, focus: true }));
    } catch {}
  };

  const cutEntry = async (item?: FSItem) => {
    const selectedItems = getSelectedItems(treeView);
    vscode.commands.executeCommand('setContext', 'secondaryExplorerHasClipboard', true);
    clipboard = { type: 'cut', items: selectedItems.length <= 1 && item ? [item] : selectedItems };
    vscode.window.setStatusBarMessage(`Cut!`, 1500);
  };

  const copyEntry = async (item?: FSItem) => {
    const selectedItems = getSelectedItems(treeView);
    clipboard = { type: 'copy', items: selectedItems.length <= 1 && item ? [item] : selectedItems };
    vscode.commands.executeCommand('setContext', 'secondaryExplorerHasClipboard', true);
    vscode.window.setStatusBarMessage(`Copied!`, 1500);
  };

  const copyPath = async (item?: FSItem) => {
    const treeViewItem = item || getSelectedItems(treeView).at(-1);
    if (!treeViewItem) return;
    await vscode.env.clipboard.writeText(treeViewItem.fullPath.replace(/\\/g, '/'));
    vscode.window.setStatusBarMessage('Path copied to clipboard', 1500);
  };

  const copyRelativePath = async (item?: FSItem) => {
    const treeViewItem = item || getSelectedItems(treeView).at(-1);
    if (!treeViewItem) return;

    const nearestRootPath =
      Settings.parsedPaths.find((p) =>
        treeViewItem.fullPath.replace(/\\/g, '/').toLowerCase().startsWith(p.basePath.replace(/\\/g, '/').toLowerCase()),
      )?.basePath || treeViewItem.fullPath;
    const relativePath = path.relative(nearestRootPath, treeViewItem.fullPath).replace(/\\/g, '/') || path.basename(nearestRootPath);
    const copyText = treeViewItem.contextValue === 'root' ? relativePath : `${path.basename(nearestRootPath)}/${relativePath}`;
    await vscode.env.clipboard.writeText(copyText);
    vscode.window.setStatusBarMessage('Relative path copied to clipboard', 1500);
  };

  const renameEntry = async (item?: FSItem) => {
    const treeViewItem = item || getSelectedItems(treeView).at(-1);
    if (!treeViewItem) return;

    const oldPath = treeViewItem.fullPath;
    const parentDir = path.dirname(oldPath);
    // Ensure label is a string
    const labelStr = typeof treeViewItem.label === 'string' ? treeViewItem.label : (treeViewItem.label?.label ?? '');
    const value = await vscode.window.showInputBox({
      title: 'Rename',
      prompt: `Rename "${labelStr}"`,
      value: labelStr,
      validateInput: async (input) => {
        const name = input.trim();
        if (!name) return 'Name is required';
        if (isWindows && windowsInvalidName.test(name)) return 'Invalid characters in name';
        const newPath = path.join(parentDir, name);
        if (newPath === oldPath) return undefined;
        if (await exists(newPath)) return 'Target already exists';
        return undefined;
      },
    });
    if (!value) return;
    const newPath = path.join(parentDir, value.trim());
    // Check if active editor is showing the file being renamed
    const activeEditor = vscode.window.activeTextEditor;
    const isActiveFile = activeEditor && activeEditor.document.uri.fsPath === oldPath;
    try {
      await fsExtra.move(oldPath, newPath, { overwrite: false });
      provider.refresh();
      if (isActiveFile) {
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(newPath));
        await vscode.window.showTextDocument(doc);
      }
    } catch (e) {
      vscode.window.showErrorMessage('Rename failed: ' + String(e));
    }
  };

  const deleteEntry = async (item?: FSItem) => {
    const selectedItems = getSelectedItems(treeView);
    const itemsToDelete = selectedItems.length <= 1 && item ? [item] : selectedItems;
    if (itemsToDelete.length === 0) return;
    const names = itemsToDelete.map((s) => (typeof s.label === 'string' ? s.label : (s.label?.label ?? s.fullPath)));
    const confirm = await vscode.window.showWarningMessage(
      `Delete the following ${itemsToDelete.length > 1 ? 'items' : 'item'}?\n${names.join('\n')}`,
      { modal: true },
      'Delete',
    );
    if (confirm !== 'Delete') return;

    const hasFolder = selectedItems.some((i) => i.type === 'folder');
    let showProgress = selectedItems.length > 1 || hasFolder;

    const doDelete = async (progress?: vscode.Progress<unknown>) => {
      let errorCount = 0;
      for (const [idx, s] of selectedItems.entries()) {
        try {
          await fsExtra.remove(s.fullPath);
        } catch (e) {
          errorCount++;
        }
        if (showProgress && progress) {
          progress.report({ increment: Math.floor((100 * (idx + 1)) / selectedItems.length) });
        }
      }
      provider.refresh();
      if (errorCount > 0) {
        vscode.window.showErrorMessage(`Failed to delete ${errorCount} item(s).`);
      }
    };

    if (showProgress) {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Deleting',
          cancellable: false,
        },
        async (progress) => {
          await doDelete(progress);
        },
      );
    } else {
      await doDelete();
    }
  };

  const pasteEntry = async (item?: FSItem) => {
    if (!clipboard || clipboard.items.length === 0) {
      vscode.window.setStatusBarMessage('Clipboard is empty', 1500);
      return;
    }

    const treeViewItem = item || getSelectedItems(treeView).at(0);
    if (!treeViewItem) return;
    const destPath = treeViewItem.type === 'file' ? path.dirname(treeViewItem.fullPath) : treeViewItem.fullPath;

    const itemsToCopy = clipboard?.items ?? [];

    // Sanity check - ensure all items exist before proceeding
    if (!itemsToCopy.length) return;

    const hasFolder = itemsToCopy.some((i) => i.type === 'folder');
    let showProgress = itemsToCopy.length > 1 || hasFolder;

    const doPaste = async (progress?: vscode.Progress<unknown>) => {
      for (const [idx, item] of itemsToCopy.entries()) {
        const baseName = path.basename(item.fullPath);
        let newPath = path.join(destPath, baseName);
        let fileIdx = 1;
        while (await existsAsync(newPath)) {
          const { name, ext } = splitNameExt(baseName);
          newPath = path.join(destPath, `${name}_${fileIdx}${ext}`);
          fileIdx++;
        }
        try {
          if (clipboard?.type === 'copy') {
            await fsExtra.copy(item.fullPath, newPath);
          } else {
            await fsExtra.move(item.fullPath, newPath, { overwrite: false });
          }
        } catch (e) {
          vscode.window.showErrorMessage(`Paste failed: ${String(e)}`);
        }
        if (showProgress && progress) {
          progress.report({ increment: Math.floor((100 * (idx + 1)) / itemsToCopy.length) });
        }
      }
    };

    if (showProgress) {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: clipboard && clipboard.type === 'copy' ? 'Copying' : 'Pasting',
          cancellable: false,
        },
        async (progress) => {
          await doPaste(progress);
        },
      );
    } else {
      await doPaste();
    }
    clipboard = null;
    vscode.commands.executeCommand('setContext', 'secondaryExplorerHasClipboard', false);
    provider.refresh();
  };

  const commandCallbacks = {
    viewAsList: () => provider.toggleListView?.(),
    viewAsTree: () => provider.toggleListView?.(),
    refresh: () => provider.refresh?.(),
    openSettings: () => vscode.commands.executeCommand('workbench.action.openSettings', 'secondaryExplorer'),
    revealInFileExplorer: (item: FSItem) => vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(item.fullPath)),
    addToSecondaryExplorer,
    pickPath,
    openInTerminal,
    openFolderInNewWindow,
    removePath,
    createEntry,
    openFile,
    cutEntry,
    copyEntry,
    copyPath,
    copyRelativePath,
    renameEntry,
    deleteEntry,
    pasteEntry,
  };

  for (let [command, callback] of Object.entries(commandCallbacks)) {
    context.subscriptions.push(vscode.commands.registerCommand(`secondary-explorer.${command}`, callback));
  }
}
