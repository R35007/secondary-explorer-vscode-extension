import * as fsExtra from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { FSItem } from '../models/FSItem';
import { SecondaryExplorerProvider } from '../providers/SecondaryExplorerProvider';
import { isWindows, windowsInvalidName } from '../utils/constants';
import { Settings } from '../utils/Settings';
import { exists, getSelectedItems, getUniqueDestPath, log, normalizePath, replaceVariablePath, setContext } from '../utils/utils';
const trash = require('trash').default;

export function registerCommands(context: vscode.ExtensionContext, provider: SecondaryExplorerProvider, treeView: vscode.TreeView<FSItem>) {
  let clipboard: { type: 'cut' | 'copy'; items: FSItem[] } | null = null; // Clipboard state for cut/copy/paste
  let lastOpenedFile: string | null = null;

  const addToSecondaryExplorer = async (uriOrUris: vscode.Uri | vscode.Uri[]) => {
    try {
      const uris: vscode.Uri[] = Array.isArray(uriOrUris) ? uriOrUris : uriOrUris ? [uriOrUris] : [];

      if (!uris.length) return;

      const hasWorkspaceSetting = Settings.hasWorkspaceSetting('paths');
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
      const userHome = process.env.HOME || process.env.USERPROFILE || '';

      const pathsToAdd = uris.map((u) => replaceVariablePath(u.fsPath, userHome, hasWorkspaceSetting ? workspaceRoot : ''));

      const existing = Settings.paths;
      Settings.paths = [...new Set([...existing, ...pathsToAdd])];
      log(`Added paths to Secondary Explorer: ${pathsToAdd.join(', ')}`);
    } catch (err) {
      log(`Failed to add paths to Secondary Explorer: ${String(err)}`);
    }
  };

  const pickPath = async () => {
    try {
      const hasWorkspaceFolders = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0;
      const defaultUri = hasWorkspaceFolders ? vscode.workspace?.workspaceFolders?.[0].uri : vscode.Uri.file(require('os').homedir());
      const picked = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: true,
        canSelectMany: true,
        defaultUri,
      });

      if (!picked?.length) return;

      const hasWorkspaceSetting = Settings.hasWorkspaceSetting('paths');
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
      const userHome = process.env.HOME || process.env.USERPROFILE || '';

      const pickedPaths = picked.map((u) => replaceVariablePath(u.fsPath, userHome, hasWorkspaceSetting ? workspaceRoot : ''));

      const existing = Settings.paths;
      Settings.paths = [...new Set([...existing, ...pickedPaths])];
      log(`Picked new paths and added to Secondary Explorer: ${pickedPaths.join(', ')}`);
    } catch (err) {
      log(`Failed to pick paths for Secondary Explorer: ${String(err)}`);
    }
  };

  const openInTerminal = async (item?: FSItem) => {
    try {
      const treeViewItem = item || getSelectedItems(treeView).at(-1);
      if (!treeViewItem) return;

      const targetPath = treeViewItem.type === 'file' ? path.dirname(treeViewItem.basePath) : treeViewItem.basePath;
      const term = vscode.window.createTerminal({ cwd: targetPath });
      term.show();
      log(`Opened terminal at: ${targetPath}`);
    } catch (err) {
      log(`Failed to open terminal: - ${String(err)}`);
    }
  };

  const openFolderInNewWindow = async (item?: FSItem) => {
    try {
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
      log(`Opened folder in new window: ${targetUri.fsPath}`);
    } catch (err) {
      log(`Failed to open folder in new window: ${String(err)}`);
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

      const hasWorkspaceSetting = Settings.hasWorkspaceSetting('paths');
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
      const userHome = process.env.HOME || process.env.USERPROFILE || '';

      const workspaceBasePath = replaceVariablePath(treeViewItem.basePath, userHome, hasWorkspaceSetting ? workspaceRoot : '');

      const newPaths = [...Settings.paths];
      newPaths[treeViewItem.rootIndex] = {
        hidden: true,
        basePath: workspaceBasePath,
        include: treeViewItem.include,
        exclude: treeViewItem.exclude,
        name: treeViewItem.label as string,
        showEmptyDirectories: treeViewItem.showEmptyDirectories,
        viewAsList: treeViewItem.viewAsList,
        sortOrderPattern: treeViewItem.sortOrderPattern,
      };

      Settings.paths = newPaths;
      vscode.window.setStatusBarMessage('Path set to hidden from Secondary Explorer', 1500);
      log(`Path hidden in Secondary Explorer: ${treeViewItem.basePath}`);
    } catch (err) {
      log(`Failed to hide path in Secondary Explorer: ${String(err)}`);
    }
  };

  const createFile = async (item?: FSItem) => {
    try {
      const selectedItem = item || getSelectedItems(treeView).at(-1);

      const isSingleRoot = provider.explorerPaths.length === 1;
      const pathObj = provider.explorerPaths[0];

      if (!selectedItem && !isSingleRoot) return;

      const treeViewItem = !selectedItem && isSingleRoot ? new FSItem({ ...pathObj, isRoot: true }) : selectedItem;

      if (!treeViewItem) return;

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

      await fsExtra.ensureDir(path.dirname(target)); // ensure parent folders
      await fsExtra.ensureFile(target); // always create file
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(target));
      await vscode.window.showTextDocument(doc);
      log(`Created new file: ${target}`);
    } catch (err) {
      log(`Failed to create file: ${String(err)}`);
    }
  };

  const createFolder = async (item?: FSItem) => {
    try {
      const selectedItem = item || getSelectedItems(treeView).at(-1);

      const isSingleRoot = provider.explorerPaths.length === 1;
      const pathObj = provider.explorerPaths[0];

      if (!selectedItem && !isSingleRoot) return;

      const treeViewItem = !selectedItem && isSingleRoot ? new FSItem({ ...pathObj, isRoot: true }) : selectedItem;

      if (!treeViewItem) return;

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

      await fsExtra.ensureDir(target); // always create folder
      log(`Created new folder: ${target}`);
    } catch (err) {
      log(`Failed to create folder: ${String(err)}`);
    }
  };

  const openFile = async (item?: FSItem) => {
    try {
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
          log(`Failed to open: ${filesToOpen[idx].basePath} \n ${res.reason}`);
        }
      });

      item && (await treeView.reveal(item, { select: true, focus: true }));
      log(`Opened file(s): ${filesToOpen.map((f) => f.basePath).join(', ')}`);
    } catch (err) {
      log(`Failed to open file(s): ${String(err)}`);
    }
  };

  const openToTheSide = async (item?: FSItem) => {
    try {
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
          log(`Failed to open: ${filesToOpen[idx].basePath} \n ${res.reason}`);
        }
      });

      item && (await treeView.reveal(item, { select: true, focus: true }));
      log(`Opened file(s) to the side: ${filesToOpen.map((f) => f.basePath).join(', ')}`);
    } catch (err) {
      log(`Failed to open file(s) to the side: ${String(err)}`);
    }
  };

  const cutEntry = async (item?: FSItem) => {
    try {
      const selectedItems = getSelectedItems(treeView);
      clipboard = { type: 'cut', items: selectedItems.length <= 1 && item ? [item] : selectedItems };
      vscode.window.setStatusBarMessage(`Cut!`, 1500);
      log(`Cut items: ${clipboard.items.map((i) => i.basePath).join(', ')}`);
    } catch (err) {
      log(`Failed to cut items: ${String(err)}`);
    }
  };

  const copyEntry = async (item?: FSItem) => {
    try {
      const selectedItems = getSelectedItems(treeView);
      clipboard = { type: 'copy', items: selectedItems.length <= 1 && item ? [item] : selectedItems };
      vscode.window.setStatusBarMessage(`Copied!`, 1500);
      log(`Copied items: ${clipboard.items.map((i) => i.basePath).join(', ')}`);
    } catch (err) {
      log(`Failed to copy items: ${String(err)}`);
    }
  };

  const copyPath = async (item?: FSItem) => {
    try {
      const treeViewItem = item || getSelectedItems(treeView).at(-1);
      if (!treeViewItem) return;
      await vscode.env.clipboard.writeText(treeViewItem.basePath.replace(/\\/g, '/'));
      vscode.window.setStatusBarMessage('Path copied to clipboard', 1500);
      log(`Copied path to clipboard: ${treeViewItem.basePath}`);
    } catch (err) {
      log(`Failed to copy path to clipboard: ${String(err)}`);
    }
  };

  const copyRelativePath = async (item?: FSItem) => {
    try {
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
      log(`Copied relative path to clipboard: ${copyText}`);
    } catch (err) {
      log(`Failed to copy relative path to clipboard: ${String(err)}`);
    }
  };

  const renameEntry = async (item?: FSItem) => {
    try {
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

      if (isFolder) {
        // Check if nested rename (contains path separators)
        const isNested = rel.includes(path.sep);

        if (!isNested) {
          // Simple folder rename
          await fsExtra.move(oldPath, newPath, { overwrite: false });
        } else {
          // Nested folder rename
          const contents = await fsExtra.readdir(oldPath);
          if (contents.length > 0) return;
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
      log(`Renamed ${oldPath} → ${newPath}`);
    } catch (err) {
      log(`Rename failed: ${String(err)}`);
    }
  };

  const deleteEntry = async (item?: FSItem) => {
    try {
      const selectedItems = getSelectedItems(treeView);
      const itemsToDelete = selectedItems.length <= 1 && item ? [item] : selectedItems;
      if (itemsToDelete.length === 0) return;

      const names = itemsToDelete.map((s) => (typeof s.label === 'string' ? s.label : (s.label?.label ?? s.basePath)));

      let confirm: 'Delete (Move to Recycle Bin)' | 'Delete Permanently' | undefined = undefined;
      let deleteBehavior = Settings.deleteBehavior;
      if (Settings.deleteBehavior === 'alwaysAsk') {
        confirm = await vscode.window.showWarningMessage(
          `Delete the following ${itemsToDelete.length > 1 ? 'items' : 'item'}?\n${names.join('\n')}`,
          { modal: true },
          'Delete (Move to Recycle Bin)',
          'Delete Permanently',
        );

        if (!confirm) return;
        deleteBehavior = confirm === 'Delete (Move to Recycle Bin)' ? 'recycleBin' : 'permanent';
      }

      const hasFolder = selectedItems.some((i) => i.type === 'folder');
      const showProgress = selectedItems.length > 1 || hasFolder;

      const doDelete = async (progress?: vscode.Progress<unknown>, cancelToken?: vscode.CancellationToken) => {
        for (const [idx, s] of selectedItems.entries()) {
          if (cancelToken?.isCancellationRequested) {
            log('Delete operation cancelled.');
            vscode.window.showInformationMessage('Delete operation cancelled.');
            break;
          }

          try {
            if (deleteBehavior === 'permanent') {
              await fsExtra.remove(s.basePath);
            } else {
              await trash([s.basePath]);
            }
          } catch {}

          if (showProgress && progress) {
            progress.report({
              increment: Math.floor((100 * (idx + 1)) / selectedItems.length),
              message: `${idx + 1}/${selectedItems.length} deleted`,
            });
          }
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

      if (deleteBehavior === 'permanent') {
        log(`Permanently deleted items: ${itemsToDelete.map((i) => i.basePath).join(', ')}`);
      } else {
        log(`Soft-deleted items (moved to trash): ${itemsToDelete.map((i) => i.basePath).join(', ')}`);
      }
    } catch (err) {
      log(`Failed to delete item(s): ${String(err)}`);
    }
  };

  const pasteEntry = async (item?: FSItem) => {
    try {
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
        for (const [idx, item] of itemsToCopy.entries()) {
          if (cancelToken?.isCancellationRequested) {
            log('Paste operation cancelled.');
            vscode.window.showInformationMessage('Paste operation cancelled.');
            break;
          }

          const baseName = path.basename(item.basePath);
          const newPath = await getUniqueDestPath(destPath, baseName);

          try {
            if (clipboard?.type === 'copy') {
              await fsExtra.copy(item.basePath, newPath);
            } else {
              await fsExtra.move(item.basePath, newPath, { overwrite: false });
            }
          } catch {}

          if (showProgress && progress) {
            progress.report({
              increment: Math.floor(((idx + 1) / itemsToCopy.length) * 100),
              message: `${idx + 1}/${itemsToCopy.length} processed`,
            });
          }
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
      log(`Pasted items into: ${destPath}`);
    } catch (err) {
      log(`Paste failed: ${String(err)}`);
    }
  };

  const copyToWorkspaceRoot = async (item?: FSItem) => {
    try {
      const treeViewItem = item || getSelectedItems(treeView).at(-1);
      if (!treeViewItem) return;

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
      const destPath = await getUniqueDestPath(rootPath, baseName);

      if (treeViewItem.type === 'folder') {
        await fsExtra.copy(sourcePath, destPath);
      } else {
        await fsExtra.copyFile(sourcePath, destPath);
      }
      vscode.window.setStatusBarMessage(`Copied "${baseName}" to workspace root`, 2000);
      log(`Copied ${baseName} to workspace root`);
    } catch (err) {
      log(`Failed to copy to workspace root: ${String(err)}`);
    }
  };

  const moveToWorkspaceRoot = async (item?: FSItem) => {
    try {
      const treeViewItem = item || getSelectedItems(treeView).at(-1);
      if (!treeViewItem) return;

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
      const destPath = await getUniqueDestPath(rootPath, baseName);

      if (treeViewItem.type === 'folder') {
        await fsExtra.move(sourcePath, destPath, { overwrite: false });
      } else {
        await fsExtra.move(sourcePath, destPath, { overwrite: false });
      }
      vscode.window.setStatusBarMessage(`Moved "${baseName}" to workspace root`, 2000);
      log(`Moved ${baseName} to workspace root`);
    } catch (err) {
      log(`Failed to move to workspace root: ${String(err)}`);
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

  const revealInExplorerView = async (item?: FSItem) => {
    try {
      const treeViewItem = item || getSelectedItems(treeView).at(-1);
      if (!treeViewItem) return;
      await vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(treeViewItem.basePath));
      await vscode.commands.executeCommand('workbench.view.explorer');
      log(`Revealed item in Explorer view: ${treeViewItem.basePath}`);
    } catch (err) {
      log(`Failed to reveal item in Explorer view: ${String(err)}`);
    }
  };

  const revealInSecondaryExplorer = async (uri: vscode.Uri) => {
    try {
      if (!uri) return;
      await vscode.commands.executeCommand('secondaryExplorerView.focus');
      const item = provider.findItemByUri(uri);

      if (!item) return;

      await treeView.reveal(item, { select: true, focus: true, expand: true });
      log(`Revealed item in Secondary Explorer: ${uri.fsPath}`);
    } catch (err) {
      log(`Failed to reveal item in Secondary Explorer: ${String(err)}`);
    }
  };

  const toggleListView = () => {
    const viewAsList = !Settings.viewAsList;
    Settings.viewAsList = viewAsList;
    setContext('secondaryExplorerRootViewAsList', viewAsList);
    provider.refresh();
  };

  const toggleShowEmptyDirectories = () => {
    const showEmptyDirectories = !Settings.showEmptyDirectories;
    Settings.showEmptyDirectories = showEmptyDirectories;
    setContext('secondaryExplorerShowEmptyDirectories', showEmptyDirectories);
    provider.refresh();
  };

  const commandCallbacks = {
    viewAsList: () => toggleListView(),
    viewAsTree: () => toggleListView(),
    showEmptyDirectories: () => toggleShowEmptyDirectories(),
    hideEmptyDirectories: () => toggleShowEmptyDirectories(),
    refresh: () => provider.refresh?.(),
    openSettings: () => vscode.commands.executeCommand('workbench.action.openSettings', ' @ext:thinker.secondary-explorer '),
    revealInFileExplorer: (item: FSItem) => vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(item.basePath)),
    revealInExplorerView,
    revealInSecondaryExplorer,
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
