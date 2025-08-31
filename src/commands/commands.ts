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

  // View as List
  context.subscriptions.push(
    vscode.commands.registerCommand('secondary-explorer.viewAsList', async (uriOrUris: vscode.Uri | vscode.Uri[]) => {
      provider.toggleListView?.();
    }),
  );
  // View as Tree
  context.subscriptions.push(
    vscode.commands.registerCommand('secondary-explorer.viewAsTree', async (uriOrUris: vscode.Uri | vscode.Uri[]) => {
      provider.toggleListView?.();
    }),
  );

  // Add to Secondary Explorer from default explorer using context menu
  context.subscriptions.push(
    vscode.commands.registerCommand('secondary-explorer.addToSecondaryExplorer', async (uriOrUris: vscode.Uri | vscode.Uri[]) => {
      const uris: vscode.Uri[] = Array.isArray(uriOrUris) ? uriOrUris : uriOrUris ? [uriOrUris] : [];

      if (!uris.length) return vscode.window.showWarningMessage('No file or folder selected.');

      const pathsToAdd = uris.map((u) => u.fsPath);
      const existing = Settings.paths;
      Settings.paths = [...new Set([...existing, ...pathsToAdd])];
      provider.refresh?.();
    }),
  );

  // Pick path (file or folder) to add to configuration
  context.subscriptions.push(
    vscode.commands.registerCommand('secondary-explorer.pickPath', async () => {
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
    }),
  );

  // Open in Integrated Terminal (file/folder)
  context.subscriptions.push(
    vscode.commands.registerCommand('secondary-explorer.openInTerminal', async (item: FSItem) => {
      const targetPath = item.type === 'file' ? path.dirname(item.fullPath) : item.fullPath;
      const term = vscode.window.createTerminal({ cwd: targetPath });
      term.show();
    }),
  );

  // Open folder in new VS Code window
  context.subscriptions.push(
    vscode.commands.registerCommand('secondary-explorer.openFolderInNewWindow', async (item: FSItem) => {
      const targetFolder = item.type === 'file' ? path.dirname(item.fullPath) : item.fullPath;
      await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(targetFolder), true);
    }),
  );

  // Refresh tree view
  context.subscriptions.push(vscode.commands.registerCommand('secondary-explorer.refresh', () => provider.refresh()));

  // Open settings to the extension's folder configuration
  context.subscriptions.push(
    vscode.commands.registerCommand('secondary-explorer.openSettings', () => {
      vscode.commands.executeCommand('workbench.action.openSettings', 'secondaryExplorer');
    }),
  );

  // Remove root path (file or folder) from configuration
  context.subscriptions.push(
    vscode.commands.registerCommand('secondary-explorer.removePath', async (item: FSItem) => {
      if (item.rootIndex < 0) {
        vscode.window.showWarningMessage('This path is not a root path in the configuration.');
        return;
      }
      Settings.paths = Settings.paths.filter((_, index) => index !== item.rootIndex);
      provider.refresh();
      vscode.window.setStatusBarMessage('Path removed from Secondary Explorer', 1500);
    }),
  );

  // Create Entry
  context.subscriptions.push(
    vscode.commands.registerCommand('secondary-explorer.createEntry', async (item: FSItem) => {
      const basePath = item.type === 'folder' ? item.fullPath : path.dirname(item?.fullPath);
      // get the nearest rootPath
      const nearestRootPath =
        Settings.parsedPaths.find((p) =>
          basePath.replace(/\\/g, '/').toLowerCase().startsWith(p.basePath.replace(/\\/g, '/').toLowerCase()),
        )?.basePath || basePath;
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
    }),
  );

  // Open file in editor
  context.subscriptions.push(
    vscode.commands.registerCommand('secondary-explorer.openFile', async (item: FSItem) => {
      if (!item || item.type !== 'file') return;
      const uri = vscode.Uri.file(item.fullPath);
      await vscode.commands.executeCommand('vscode.open', uri, {
        preview: true,
        preserveFocus: true,
      });
      try {
        await treeView.reveal(item, { select: true, focus: true });
      } catch {}
    }),
  );

  // Cut Entry
  context.subscriptions.push(
    vscode.commands.registerCommand('secondary-explorer.cutEntry', async (item?: FSItem | FSItem[]) => {
      const selectedItems = getSelectedItems(treeView);
      if (selectedItems.length === 0) return;
      vscode.commands.executeCommand('setContext', 'secondaryExplorerHasClipboard', true);
      clipboard = { type: 'cut', items: selectedItems };
      vscode.window.setStatusBarMessage(`Cut: ${selectedItems.map((s) => s.label).join(', ')}`, 1500);
    }),
  );

  // Copy Entry
  context.subscriptions.push(
    vscode.commands.registerCommand('secondary-explorer.copyEntry', async (item?: FSItem | FSItem[]) => {
      const selectedItems = getSelectedItems(treeView);
      if (selectedItems.length === 0) return;
      clipboard = { type: 'copy', items: selectedItems };
      vscode.commands.executeCommand('setContext', 'secondaryExplorerHasClipboard', true);
      vscode.window.setStatusBarMessage(`Copied: ${selectedItems.map((s) => s.label).join(', ')}`, 1500);
    }),
  );

  // Copy full path to clipboard
  context.subscriptions.push(
    vscode.commands.registerCommand('secondary-explorer.copyPath', async (item: FSItem) => {
      await vscode.env.clipboard.writeText(item.fullPath.replace(/\\/g, '/'));
      vscode.window.setStatusBarMessage('Path copied to clipboard', 1500);
    }),
  );

  // Copy relative path to clipboard
  context.subscriptions.push(
    vscode.commands.registerCommand('secondary-explorer.copyRelativePath', async (item: FSItem) => {
      const nearestRootPath =
        Settings.parsedPaths.find((p) =>
          item.fullPath.replace(/\\/g, '/').toLowerCase().startsWith(p.basePath.replace(/\\/g, '/').toLowerCase()),
        )?.basePath || item.fullPath;
      await vscode.env.clipboard.writeText(path.relative(nearestRootPath, item.fullPath).replace(/\\/g, '/'));
      vscode.window.setStatusBarMessage('Relative path copied to clipboard', 1500);
    }),
  );

  // Rename entry (file or folder)
  context.subscriptions.push(
    vscode.commands.registerCommand('secondary-explorer.renameEntry', async (item?: FSItem) => {
      const treeViewItem = item || (treeView.selection.length >= 0 ? treeView.selection.at(-1) : undefined);
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
    }),
  );

  // Delete entry (file or folder) with progress bar logic
  context.subscriptions.push(
    vscode.commands.registerCommand('secondary-explorer.deleteEntry', async (item?: FSItem | FSItem[]) => {
      const selectedItems = getSelectedItems(treeView);
      if (selectedItems.length === 0) return;
      const names = selectedItems.map((s) => (typeof s.label === 'string' ? s.label : (s.label?.label ?? s.fullPath)));
      const confirm = await vscode.window.showWarningMessage(
        `Delete the following ${selectedItems.length > 1 ? 'items' : 'item'}?\n${names.join('\n')}`,
        { modal: true },
        'Delete',
      );
      if (confirm !== 'Delete') return;

      // Helper to check if file is large (e.g., >10MB)
      async function isLargeFile(filePath: string) {
        try {
          const stat = await fsExtra.stat(filePath);
          return stat.size > 10 * 1024 * 1024; // 10MB
        } catch {
          return false;
        }
      }

      const hasFolder = selectedItems.some((i) => i.type === 'folder');
      const multipleFiles = selectedItems.filter((i) => i.type === 'file').length > 1;
      let showProgress = false;
      if (hasFolder || multipleFiles) {
        showProgress = true;
      } else if (selectedItems.length === 1 && selectedItems[0].type === 'file') {
        showProgress = await isLargeFile(selectedItems[0].fullPath);
      }

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
    }),
  );

  // Reveal in system file explorer
  context.subscriptions.push(
    vscode.commands.registerCommand('secondary-explorer.revealInFileExplorer', async (item: FSItem) => {
      await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(item.fullPath));
    }),
  );

  // Paste Entry
  context.subscriptions.push(
    vscode.commands.registerCommand('secondary-explorer.pasteEntry', async (item?: FSItem) => {
      if (!clipboard || clipboard.items.length === 0) {
        vscode.window.setStatusBarMessage('Clipboard is empty', 1500);
        return;
      }

      const treeViewItem = item || (treeView.selection.length === 1 ? treeView.selection[0] : undefined);
      if (!treeViewItem) return;
      const destPath = treeViewItem.type === 'file' ? path.dirname(treeViewItem.fullPath) : treeViewItem.fullPath;

      const items = clipboard?.items ?? [];
      const hasFolder = items.some((i) => i.type === 'folder');
      let showProgress = items.length > 1 || hasFolder;

      const doPaste = async (progress?: vscode.Progress<unknown>) => {
        for (const [idx, item] of items.entries()) {
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
            progress.report({ increment: Math.floor((100 * (idx + 1)) / items.length) });
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
    }),
  );
}
