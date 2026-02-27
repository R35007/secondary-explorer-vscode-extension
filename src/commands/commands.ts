import * as fsExtra from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { FSItem } from '../models/FSItem';
import { SecondaryExplorerProvider } from '../providers/SecondaryExplorerProvider';
import { isWindows, windowsInvalidName } from '../utils/constants';
import { Settings } from '../utils/Settings';
import { exists, existsAsync, getSelectedItems, normalizePath, splitNameExt } from '../utils/utils';
const trash = require('trash').default;

export function registerCommands(context: vscode.ExtensionContext, provider: SecondaryExplorerProvider, treeView: vscode.TreeView<FSItem>) {
  let clipboard: { type: 'cut' | 'copy'; items: FSItem[] } | null = null; // Clipboard state for cut/copy/paste
  let lastOpenedFile: string | null = null;

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

    const targetPath = treeViewItem.type === 'file' ? path.dirname(treeViewItem.basePath) : treeViewItem.basePath;
    const term = vscode.window.createTerminal({ cwd: targetPath });
    term.show();
  };

  const openFolderInNewWindow = async (item?: FSItem) => {
    const treeViewItem = item || getSelectedItems(treeView).at(-1);
    if (!treeViewItem) return;

    let targetUri: vscode.Uri;

    if (treeViewItem.type === 'file') {
      if (treeViewItem.basePath.endsWith('.code-workspace')) {
        // Open the workspace file itself
        targetUri = vscode.Uri.file(treeViewItem.basePath);
      } else {
        // For normal files, open their parent folder
        targetUri = vscode.Uri.file(path.dirname(treeViewItem.basePath));
      }
    } else {
      // For folders, open the folder directly
      targetUri = vscode.Uri.file(treeViewItem.basePath);
    }

    // Always force a new window, even if already open
    await vscode.commands.executeCommand('vscode.openFolder', targetUri, {
      forceNewWindow: true,
    });
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
  const hidePath = async (item?: FSItem) => {
    const treeViewItem = item || getSelectedItems(treeView).at(-1);
    if (!treeViewItem) return;

    if (treeViewItem.rootIndex < 0) {
      vscode.window.showWarningMessage('This path is not a root path in the configuration.');
      return;
    }

    const newPaths = [...Settings.paths];
    newPaths[treeViewItem.rootIndex] = {
      hidden: true,
      basePath: treeViewItem.basePath,
      include: treeViewItem.include,
      exclude: treeViewItem.exclude,
      name: treeViewItem.label as string,
      showEmptyDirectories: treeViewItem.showEmptyDirectories,
      viewAsList: treeViewItem.viewAsList,
      sortOrderPattern: treeViewItem.sortOrderPattern,
    };

    Settings.paths = newPaths;
    provider.refresh();
    vscode.window.setStatusBarMessage('Path set to hidden from Secondary Explorer', 1500);
  };

  const createFile = async (item?: FSItem) => {
    const selectedItem = item || getSelectedItems(treeView).at(-1);

    const isSingleRoot = provider.explorerPaths.length === 1;
    const pathObj = provider.explorerPaths[0];

    if (!selectedItem && !isSingleRoot)
      return vscode.window.showWarningMessage('Please select a file or folder to create a new file inside');

    const treeViewItem = !selectedItem && isSingleRoot ? new FSItem({ ...pathObj, isRoot: true }) : selectedItem;

    if (!treeViewItem) return vscode.window.showWarningMessage('Please select a file or folder to create a new file inside');

    const basePath = treeViewItem.type === 'folder' ? treeViewItem.basePath : path.dirname(treeViewItem.basePath);

    const value = await vscode.window.showInputBox({
      title: `Create file in "${path.basename(basePath)}" Folder`,
      placeHolder: 'Enter file name or path (e.g. foo, bar/foo.md)',
      validateInput: async (raw: string) => {
        const input = raw.trim();
        if (!input) return 'Name is required';
        if (path.isAbsolute(input)) return 'Provide a relative path, not absolute';
        const target = path.resolve(basePath, normalizePath(input));
        if (await exists(target)) return 'File already exists';
        return undefined;
      },
    });
    if (!value) return;

    const rel = normalizePath(value);
    const target = path.resolve(basePath, rel);

    try {
      await fsExtra.ensureDir(path.dirname(target)); // ensure parent folders
      await fsExtra.ensureFile(target); // always create file
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(target));
      await vscode.window.showTextDocument(doc);
      provider.refresh();
    } catch (e) {
      vscode.window.showErrorMessage('Failed to create file: ' + String(e));
    }
  };

  const createFolder = async (item?: FSItem) => {
    const selectedItem = item || getSelectedItems(treeView).at(-1);

    const isSingleRoot = provider.explorerPaths.length === 1;
    const pathObj = provider.explorerPaths[0];

    if (!selectedItem && !isSingleRoot)
      return vscode.window.showWarningMessage('Please select a file or folder to create a new file inside');

    const treeViewItem = !selectedItem && isSingleRoot ? new FSItem({ ...pathObj, isRoot: true }) : selectedItem;

    if (!treeViewItem) return vscode.window.showWarningMessage('Please select a file or folder to create a new file inside');

    const basePath = treeViewItem.type === 'folder' ? treeViewItem.basePath : path.dirname(treeViewItem.basePath);

    const value = await vscode.window.showInputBox({
      title: `Create folder in "${path.basename(basePath)}" folder`,
      placeHolder: 'Enter folder name or path (e.g. foo, bar/foo.md)',
      validateInput: async (raw: string) => {
        const input = raw.trim();
        if (!input) return 'Name is required';
        if (path.isAbsolute(input)) return 'Provide a relative path, not absolute';
        const target = path.resolve(basePath, normalizePath(input));
        if (await exists(target)) return 'Folder already exists';
        return undefined;
      },
    });
    if (!value) return;

    const rel = normalizePath(value);
    const target = path.resolve(basePath, rel);

    try {
      await fsExtra.ensureDir(target); // always create folder
      provider.refresh();
    } catch (e) {
      vscode.window.showErrorMessage('Failed to create folder: ' + String(e));
    }
  };

  const openFile = async (item?: FSItem) => {
    const selectedFiles = getSelectedItems(treeView).filter((i) => i.type === 'file');
    const filesToOpen = selectedFiles.length <= 1 && item ? (item.type === 'file' ? [item] : []) : selectedFiles;

    if (!filesToOpen.length) return;

    const results = await Promise.allSettled(
      filesToOpen.map((fileItem) => {
        const uri = vscode.Uri.file(fileItem.basePath);

        // If same file clicked again, open permanently (preview: false)
        const isSameFile = lastOpenedFile === fileItem.basePath;
        lastOpenedFile = fileItem.basePath;

        return vscode.commands.executeCommand('vscode.open', uri, {
          preview: !isSameFile && filesToOpen.length === 1,
          preserveFocus: true,
        });
      }),
    );

    results.forEach((res, idx) => {
      if (res.status === 'rejected') {
        console.error(`Failed to open: ${filesToOpen[idx].basePath}`, res.reason);
      }
    });

    try {
      item && (await treeView.reveal(item, { select: true, focus: true }));
    } catch {}
  };

  const openToTheSide = async (item?: FSItem) => {
    const selectedFiles = getSelectedItems(treeView).filter((i) => i.type === 'file');
    const filesToOpen = selectedFiles.length <= 1 && item ? (item.type === 'file' ? [item] : []) : selectedFiles;

    if (!filesToOpen.length) return;

    // Batch open with Promise.allSettled
    const results = await Promise.allSettled(
      filesToOpen.map((fileItem) => {
        const uri = vscode.Uri.file(fileItem.basePath);
        return vscode.commands.executeCommand('vscode.open', uri, {
          viewColumn: vscode.ViewColumn.Beside,
          preview: filesToOpen.length === 1,
          preserveFocus: true,
        });
      }),
    );

    // Handle failures gracefully
    results.forEach((res, idx) => {
      if (res.status === 'rejected') {
        console.error(`Failed to open: ${filesToOpen[idx].basePath}`, res.reason);
      }
    });

    try {
      item && (await treeView.reveal(item, { select: true, focus: true }));
    } catch {}
  };

  const cutEntry = async (item?: FSItem) => {
    const selectedItems = getSelectedItems(treeView);
    clipboard = { type: 'cut', items: selectedItems.length <= 1 && item ? [item] : selectedItems };
    vscode.window.setStatusBarMessage(`Cut!`, 1500);
  };

  const copyEntry = async (item?: FSItem) => {
    const selectedItems = getSelectedItems(treeView);
    clipboard = { type: 'copy', items: selectedItems.length <= 1 && item ? [item] : selectedItems };
    vscode.window.setStatusBarMessage(`Copied!`, 1500);
  };

  const copyPath = async (item?: FSItem) => {
    const treeViewItem = item || getSelectedItems(treeView).at(-1);
    if (!treeViewItem) return;
    await vscode.env.clipboard.writeText(treeViewItem.basePath.replace(/\\/g, '/'));
    vscode.window.setStatusBarMessage('Path copied to clipboard', 1500);
  };

  const copyRelativePath = async (item?: FSItem) => {
    const treeViewItem = item || getSelectedItems(treeView).at(-1);
    if (!treeViewItem) return;

    const nearestRootPath =
      Settings.parsedPaths.find((p) =>
        treeViewItem.basePath.replace(/\\/g, '/').toLowerCase().startsWith(p.basePath.replace(/\\/g, '/').toLowerCase()),
      )?.basePath || treeViewItem.basePath;
    const relativePath = path.relative(nearestRootPath, treeViewItem.basePath).replace(/\\/g, '/') || path.basename(nearestRootPath);
    const copyText = treeViewItem.contextValue === 'root' ? relativePath : `${path.basename(nearestRootPath)}/${relativePath}`;
    await vscode.env.clipboard.writeText(copyText);
    vscode.window.setStatusBarMessage('Relative path copied to clipboard', 1500);
  };

  const renameEntry = async (item?: FSItem) => {
    const treeViewItem = item || getSelectedItems(treeView).at(-1);
    if (!treeViewItem) return;

    const oldPath = treeViewItem.basePath;
    const parentDir = path.dirname(oldPath);
    const labelStr = typeof treeViewItem.label === 'string' ? treeViewItem.label : (treeViewItem.label?.label ?? '');

    const value = await vscode.window.showInputBox({
      title: `Rename "${labelStr}"`,
      value: labelStr,
      validateInput: async (input) => {
        const name = input.trim();
        if (!name) return 'Name is required';
        if (isWindows && windowsInvalidName.test(name)) return 'Invalid characters in name';

        const newPath = path.resolve(parentDir, normalizePath(name));
        if (newPath === oldPath) return undefined;
        if (await exists(newPath)) return 'Target already exists';
        return undefined;
      },
    });
    if (!value) return;

    const rel = normalizePath(value.trim());
    const newPath = path.resolve(parentDir, rel);

    const isFolder = treeViewItem.type === 'folder';
    const isFile = treeViewItem.type === 'file';

    try {
      if (isFolder) {
        // Check if nested rename (contains path separators)
        const isNested = rel.includes(path.sep);

        if (!isNested) {
          // Simple folder rename
          await fsExtra.move(oldPath, newPath, { overwrite: false });
        } else {
          // Nested folder rename
          const contents = await fsExtra.readdir(oldPath);
          if (contents.length > 0) {
            // Folder not empty → do nothing
            vscode.window.showWarningMessage(`Cannot rename "${labelStr}" into nested folders because it is not empty.`);
            return;
          }
          // Folder empty → allow nested rename
          await fsExtra.ensureDir(newPath);
          await fsExtra.remove(oldPath);
        }
      } else if (isFile) {
        // Always rename into a file
        await fsExtra.ensureDir(path.dirname(newPath));
        await fsExtra.move(oldPath, newPath, { overwrite: false });

        // If active editor is showing the file, reopen
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.uri.fsPath === oldPath) {
          const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(newPath));
          await vscode.window.showTextDocument(doc);
        }
      }

      provider.refresh();
    } catch (e) {
      vscode.window.showErrorMessage('Rename failed: ' + String(e));
    }
  };

  const deleteEntry = async (item?: FSItem) => {
    const selectedItems = getSelectedItems(treeView);
    const itemsToDelete = selectedItems.length <= 1 && item ? [item] : selectedItems;
    if (itemsToDelete.length === 0) return;

    const names = itemsToDelete.map((s) => (typeof s.label === 'string' ? s.label : (s.label?.label ?? s.basePath)));

    let confirm: 'Delete (Move to Recycle Bin)' | 'Delete Permanently' | undefined = undefined;
    if (Settings.deleteBehavior === 'alwaysAsk') {
      confirm = await vscode.window.showWarningMessage(
        `Delete the following ${itemsToDelete.length > 1 ? 'items' : 'item'}?\n${names.join('\n')}`,
        { modal: true },
        'Delete (Move to Recycle Bin)',
        'Delete Permanently',
      );

      if (!confirm) return;
    }

    const hasFolder = selectedItems.some((i) => i.type === 'folder');
    const showProgress = selectedItems.length > 1 || hasFolder;

    const doDelete = async (progress?: vscode.Progress<unknown>, cancelToken?: vscode.CancellationToken) => {
      let errorCount = 0;
      for (const [idx, s] of selectedItems.entries()) {
        if (cancelToken?.isCancellationRequested) {
          vscode.window.showInformationMessage('Delete operation cancelled.');
          break;
        }

        try {
          if (confirm === 'Delete Permanently' || Settings.deleteBehavior === 'permanent') {
            // Permanently remove
            await fsExtra.remove(s.basePath);
          } else {
            await trash([s.basePath]);
          }
        } catch (e) {
          errorCount++;
        }

        if (showProgress && progress) {
          progress.report({
            increment: Math.floor((100 * (idx + 1)) / selectedItems.length),
            message: `${idx + 1}/${selectedItems.length} deleted`,
          });
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
          title: confirm === 'Delete Permanently' ? 'Deleting Permanently' : 'Deleting',
          cancellable: true,
        },
        async (progress, cancelToken) => {
          await doDelete(progress, cancelToken);
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
    const destPath = treeViewItem.type === 'file' ? path.dirname(treeViewItem.basePath) : treeViewItem.basePath;

    const itemsToCopy = clipboard?.items ?? [];

    // Sanity check - ensure all items exist before proceeding
    if (!itemsToCopy.length) return;

    const hasFolder = itemsToCopy.some((i) => i.type === 'folder');
    const showProgress = itemsToCopy.length > 1 || hasFolder;

    const doPaste = async (progress?: vscode.Progress<unknown>, cancelToken?: vscode.CancellationToken) => {
      let errorCount = 0;
      for (const [idx, item] of itemsToCopy.entries()) {
        if (cancelToken?.isCancellationRequested) {
          vscode.window.showInformationMessage('Paste operation cancelled.');
          break;
        }

        const baseName = path.basename(item.basePath);
        let newPath = path.join(destPath, baseName);
        let fileIdx = 1;

        while (await existsAsync(newPath)) {
          const { name, ext } = splitNameExt(baseName);
          newPath = path.join(destPath, `${name}_${fileIdx}${ext}`);
          fileIdx++;
        }

        try {
          if (clipboard?.type === 'copy') {
            await fsExtra.copy(item.basePath, newPath);
          } else {
            await fsExtra.move(item.basePath, newPath, { overwrite: false });
          }
        } catch (e) {
          errorCount++;
          vscode.window.showErrorMessage(`Paste failed: ${String(e)}`);
        }

        if (showProgress && progress) {
          progress.report({
            increment: Math.floor(((idx + 1) / itemsToCopy.length) * 100),
            message: `${idx + 1}/${itemsToCopy.length} processed`,
          });
        }
      }

      provider.refresh();
      if (errorCount > 0) {
        vscode.window.showErrorMessage(`Failed to paste ${errorCount} item(s).`);
      }
    };

    if (showProgress) {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: clipboard && clipboard.type === 'copy' ? 'Copying' : 'Pasting',
          cancellable: true,
        },
        async (progress, cancelToken) => {
          await doPaste(progress, cancelToken);
        },
      );
    } else {
      await doPaste();
    }
  };

  const copyToWorkspaceRoot = async (item?: FSItem) => {
    const treeViewItem = item || getSelectedItems(treeView).at(-1);
    if (!treeViewItem) {
      vscode.window.showWarningMessage('No file or folder selected.');
      return;
    }

    // Ensure there is an active workspace
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showWarningMessage('No active workspace folder found.');
      return;
    }

    // Use the first workspace folder as the root
    const rootPath = workspaceFolders[0].uri.fsPath;

    const sourcePath = treeViewItem.basePath;
    const baseName = path.basename(sourcePath);
    let destPath = path.join(rootPath, baseName);

    // Handle name collisions by appending suffix
    let fileIdx = 1;
    while (await existsAsync(destPath)) {
      const { name, ext } = splitNameExt(baseName);
      destPath = path.join(rootPath, `${name}_${fileIdx}${ext}`);
      fileIdx++;
    }

    try {
      if (treeViewItem.type === 'folder') {
        await fsExtra.copy(sourcePath, destPath);
      } else {
        await fsExtra.copyFile(sourcePath, destPath);
      }
      vscode.window.setStatusBarMessage(`Copied "${baseName}" to workspace root`, 2000);
      provider.refresh();
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to copy: ${String(e)}`);
    }
  };

  const moveToWorkspaceRoot = async (item?: FSItem) => {
    const treeViewItem = item || getSelectedItems(treeView).at(-1);
    if (!treeViewItem) {
      vscode.window.showWarningMessage('No file or folder selected.');
      return;
    }

    // Ensure there is an active workspace
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showWarningMessage('No active workspace folder found.');
      return;
    }

    // Use the first workspace folder as the root
    const rootPath = workspaceFolders[0].uri.fsPath;

    const sourcePath = treeViewItem.basePath;
    const baseName = path.basename(sourcePath);
    let destPath = path.join(rootPath, baseName);

    // Handle name collisions by appending suffix
    let fileIdx = 1;
    while (await existsAsync(destPath)) {
      const { name, ext } = splitNameExt(baseName);
      destPath = path.join(rootPath, `${name}_${fileIdx}${ext}`);
      fileIdx++;
    }

    try {
      if (treeViewItem.type === 'folder') {
        await fsExtra.move(sourcePath, destPath, { overwrite: false });
      } else {
        await fsExtra.move(sourcePath, destPath, { overwrite: false });
      }
      vscode.window.setStatusBarMessage(`Moved "${baseName}" to workspace root`, 2000);
      provider.refresh();
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to move: ${String(e)}`);
    }
  };

  const addSelectedToWorkspace = async (item?: FSItem) => {
    const selectedItems = getSelectedItems(treeView);
    // If multiple items are selected, pick the last one
    const targetItem = selectedItems.length <= 1 && item ? item : selectedItems.at(-1);

    if (!targetItem) {
      vscode.window.showWarningMessage('No file or folder selected.');
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

    try {
      // Prevent duplicates: check if already in workspace
      const existing = vscode.workspace.workspaceFolders?.some((f) => f.uri.fsPath === folderUri.fsPath);
      if (existing) {
        vscode.window.showInformationMessage(`Folder "${path.basename(folderPath)}" is already part of the workspace.`);
        return;
      }

      // Add folder to workspace
      vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : 0, null, {
        uri: folderUri,
      });

      vscode.window.setStatusBarMessage(`Added folder "${path.basename(folderPath)}" to workspace`, 2000);
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to add folder: ${String(e)}`);
    }
  };

  const commandCallbacks = {
    viewAsList: () => provider.toggleListView?.(),
    viewAsTree: () => provider.toggleListView?.(),
    refresh: () => provider.refresh?.(),
    openSettings: () => vscode.commands.executeCommand('workbench.action.openSettings', ' @ext:thinker.secondary-explorer '),
    revealInFileExplorer: (item: FSItem) => vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(item.basePath)),
    addToSecondaryExplorer,
    pickPath,
    openInTerminal,
    openFolderInNewWindow,
    removePath,
    hidePath,
    createFile,
    createFolder,
    openFile,
    openToTheSide,
    cutEntry,
    copyEntry,
    copyPath,
    copyRelativePath,
    renameEntry,
    deleteEntry,
    pasteEntry,
    copyToWorkspaceRoot,
    moveToWorkspaceRoot,
    addSelectedToWorkspace,
  };

  for (let [command, callback] of Object.entries(commandCallbacks)) {
    context.subscriptions.push(vscode.commands.registerCommand(`secondary-explorer.${command}`, callback));
  }
}
