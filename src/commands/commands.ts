import * as fsExtra from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { FSItem } from '../models/FSItem';
import { SecondaryExplorerProvider } from '../providers/SecondaryExplorerProvider';
import { isWindows, windowsInvalidName } from '../utils/constants';
import { exists, existsAsync, sanitizeRelative, splitNameExt } from '../utils/utils';

export function registerCommands(
  context: vscode.ExtensionContext,
  provider: SecondaryExplorerProvider,
  treeView: vscode.TreeView<FSItem>
) {
  // Clipboard state for cut/copy/paste
  let clipboard: { type: 'cut' | 'copy'; items: FSItem[] } | null = null;
  function getSelectedItems(passed?: FSItem | FSItem[]) {
    // If passed is an array, return it
    if (Array.isArray(passed)) return passed;
    // If passed is a single item
    if (passed) {
      if (
        treeView.selection &&
        treeView.selection.length > 1 &&
        treeView.selection.some((s) => s.fullPath === passed.fullPath)
      ) {
        return treeView.selection;
      }
      return [passed];
    }
    // If nothing passed, use selection
    if (treeView.selection && treeView.selection.length > 0) return treeView.selection;
    return [];
  }

  // Create Entry
  context.subscriptions.push(
    vscode.commands.registerCommand('secondary-explorer.createEntry', async (parent?: FSItem) => {
      // Get selected item or fallback to first configured folder
      const cfg = vscode.workspace.getConfiguration();
      const folders = cfg.get<string[]>('secondaryExplorer.folders') || [];
      if (folders.length === 0) {
        vscode.window.showErrorMessage(
          'No secondary folders configured. Open settings to add one.'
        );
        return;
      }
      const selArr = getSelectedItems(parent);
      const sel = selArr.length > 0 ? selArr[0] : undefined;
      let basePath = folders[0];
      if (sel) basePath = sel.type === 'file' ? path.dirname(sel.fullPath) : sel.fullPath;

      const value = await vscode.window.showInputBox({
        title: 'New File or Folder',
        prompt: `Create in "${basePath}"`,
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
    })
  );

  // Reveal in system file explorer
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'secondary-explorer.revealInFileExplorer',
      async (item?: FSItem | FSItem[]) => {
        const selArr = getSelectedItems(item);
        const sel = selArr.length > 0 ? selArr[0] : undefined;
        if (!sel) return;
        await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(sel.fullPath));
      }
    )
  );

  // Copy full path to clipboard
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'secondary-explorer.copyPath',
      async (item?: FSItem | FSItem[]) => {
        const selArr = getSelectedItems(item);
        const sel = selArr.length > 0 ? selArr[0] : undefined;
        if (!sel) return;
        await vscode.env.clipboard.writeText(sel.fullPath);
        vscode.window.setStatusBarMessage('Path copied to clipboard', 1500);
      }
    )
  );

  // Copy relative path to clipboard
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'secondary-explorer.copyRelativePath',
      async (item?: FSItem | FSItem[]) => {
        const sel = getSelectedItems(item)[0];
        if (!sel) return;

        const cfgFolders =
          vscode.workspace.getConfiguration().get<string[]>('secondaryExplorer.folders') || [];

        let relPath = sel.fullPath;
        let bestRoot = '';
        for (const root of cfgFolders) {
          if (
            (sel.fullPath + path.sep).startsWith(root + path.sep) &&
            root.length > bestRoot.length
          ) {
            bestRoot = root;
          }
        }
        if (bestRoot) relPath = path.relative(bestRoot, sel.fullPath);
        await vscode.env.clipboard.writeText(relPath);
        vscode.window.setStatusBarMessage('Relative path copied to clipboard', 1500);
      }
    )
  );

  // Pick folder to add to configuration
  context.subscriptions.push(
    vscode.commands.registerCommand('secondary-explorer.pickFolder', async () => {
      const folders = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: 'Select Folder',
      });
      if (folders && folders.length > 0) {
        const folderPath = folders[0].fsPath;
        const cfg = vscode.workspace.getConfiguration();
        const existing = cfg.get<string[]>('secondaryExplorer.folders') || [];
        // Avoid duplicates
        const updated = existing.includes(folderPath)
          ? existing
          : [...new Set([...existing, folderPath])];
        await cfg.update('secondaryExplorer.folders', updated, vscode.ConfigurationTarget.Global);
      }
    })
  );

  // Refresh tree view
  context.subscriptions.push(
    vscode.commands.registerCommand('secondary-explorer.refresh', () => provider.refresh())
  );

  // Open settings to the extension's folder configuration
  context.subscriptions.push(
    vscode.commands.registerCommand('secondary-explorer.openSettings', () => {
      vscode.commands.executeCommand('workbench.action.openSettings', 'secondaryExplorer');
    })
  );

  // Open file in editor
  context.subscriptions.push(
    vscode.commands.registerCommand('secondary-explorer.openFile', async (item: FSItem) => {
      let sel: FSItem | undefined = item;
      if (!sel) {
        const selected = getSelectedItems();
        sel = selected.length > 0 ? selected[0] : undefined;
      }
      if (!sel || sel.type !== 'file') return;
      const uri = vscode.Uri.file(sel.fullPath);
      await vscode.commands.executeCommand('vscode.open', uri, {
        preview: true,
        preserveFocus: true,
      });
      try {
        await treeView.reveal(sel, { select: true, focus: true });
      } catch {}
    })
  );

  // Open folder in new VS Code window
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'secondary-explorer.openFolderInNewWindow',
      async (item?: FSItem | FSItem[]) => {
        const selArr = getSelectedItems(item).filter((s): s is FSItem => !!s);
        if (selArr.length > 1) {
          vscode.window.showWarningMessage(
            'Cannot open multiple windows. Please select only one folder or file.'
          );
          return;
        }
        let targetFolder: string | undefined;
        if (selArr.length === 1) {
          const sel = selArr[0];
          targetFolder = sel.type === 'folder' ? sel.fullPath : path.dirname(sel.fullPath);
        } else {
          const folders =
            vscode.workspace.getConfiguration().get<string[]>('secondaryExplorer.folders') || [];
          if (folders.length === 1) {
            targetFolder = folders[0];
          }
        }
        if (!targetFolder) {
          vscode.window.showWarningMessage(
            'No folder selected or configured to open in new window.'
          );
          return;
        }
        await vscode.commands.executeCommand(
          'vscode.openFolder',
          vscode.Uri.file(targetFolder),
          true
        );
      }
    )
  );

  // Rename entry (file or folder)
  context.subscriptions.push(
    vscode.commands.registerCommand('secondary-explorer.renameEntry', async (item?: FSItem) => {
      const selArr = getSelectedItems(item).filter((s): s is FSItem => !!s);
      if (selArr.length !== 1) {
        vscode.window.showWarningMessage('Only one file or folder can be renamed at a time.');
        return;
      }
      const sel = selArr[0];
      if (!sel) return;
      const oldPath = sel.fullPath;
      const parentDir = path.dirname(oldPath);
      // Ensure label is a string
      const labelStr = typeof sel.label === 'string' ? sel.label : (sel.label?.label ?? '');
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
      try {
        await fsExtra.move(oldPath, newPath, { overwrite: false });
        provider.refresh();
      } catch (e) {
        vscode.window.showErrorMessage('Rename failed: ' + String(e));
      }
    })
  );

  // Delete entry (file or folder) with progress bar logic
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'secondary-explorer.deleteEntry',
      async (item?: FSItem | FSItem[]) => {
        const selArr = getSelectedItems(item).filter((s): s is FSItem => !!s);
        if (!selArr || selArr.length === 0) return;
        const names = selArr.map((s) =>
          typeof s.label === 'string' ? s.label : (s.label?.label ?? s.fullPath)
        );
        const confirm = await vscode.window.showWarningMessage(
          `Delete the following ${selArr.length > 1 ? 'items' : 'item'}?\n${names.join('\n')}`,
          { modal: true },
          'Delete'
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

        const hasFolder = selArr.some((i) => i.type === 'folder');
        const multipleFiles = selArr.filter((i) => i.type === 'file').length > 1;
        let showProgress = false;
        if (hasFolder || multipleFiles) {
          showProgress = true;
        } else if (selArr.length === 1 && selArr[0].type === 'file') {
          showProgress = await isLargeFile(selArr[0].fullPath);
        }

        const doDelete = async (progress?: vscode.Progress<unknown>) => {
          let errorCount = 0;
          for (const [idx, s] of selArr.entries()) {
            try {
              await fsExtra.remove(s.fullPath);
            } catch (e) {
              errorCount++;
            }
            if (showProgress && progress) {
              progress.report({ increment: Math.floor((100 * (idx + 1)) / selArr.length) });
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
            }
          );
        } else {
          await doDelete();
        }
      }
    )
  );

  // Cut Entry
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'secondary-explorer.cutEntry',
      async (item?: FSItem | FSItem[]) => {
        const sel = getSelectedItems(item).filter((s): s is FSItem => !!s);
        if (!sel || sel.length === 0) return;
        clipboard = { type: 'cut', items: sel };
        vscode.window.setStatusBarMessage(`Cut: ${sel.map((s) => s.label).join(', ')}`, 1500);
      }
    )
  );

  // Copy Entry
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'secondary-explorer.copyEntry',
      async (item?: FSItem | FSItem[]) => {
        const sel = getSelectedItems(item).filter((s): s is FSItem => !!s);
        if (!sel || sel.length === 0) return;
        clipboard = { type: 'copy', items: sel };
        vscode.window.setStatusBarMessage(`Copied: ${sel.map((s) => s.label).join(', ')}`, 1500);
      }
    )
  );

  // Paste Entry
  context.subscriptions.push(
    vscode.commands.registerCommand('secondary-explorer.pasteEntry', async (target?: FSItem) => {
      if (!clipboard || clipboard.items.length === 0) {
        vscode.window.setStatusBarMessage('Clipboard is empty', 1500);
        return;
      }
      const dest = getSelectedItems(target)[0];
      if (!dest) return;
      const destPath = dest.type === 'file' ? path.dirname(dest.fullPath) : dest.fullPath;

      // Helper to check if file is large (e.g., >10MB)
      async function isLargeFile(filePath: string) {
        try {
          const stat = await fsExtra.stat(filePath);
          return stat.size > 10 * 1024 * 1024; // 10MB
        } catch {
          return false;
        }
      }

      const items = clipboard?.items ?? [];
      const hasFolder = items.some((i) => i.type === 'folder');
      const multipleFiles = items.filter((i) => i.type === 'file').length > 1;
      let showProgress = false;
      if (hasFolder || multipleFiles) {
        showProgress = true;
      } else if (items.length === 1 && items[0].type === 'file') {
        showProgress = await isLargeFile(items[0].fullPath);
      }

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
            if (clipboard && clipboard.type === 'copy') {
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
          }
        );
      } else {
        await doPaste();
      }
      clipboard = null;
      provider.refresh();
    })
  );

  // Remove root folder from configuration
  context.subscriptions.push(
    vscode.commands.registerCommand('secondary-explorer.removeFolder', async (item?: FSItem) => {
      const selArr = getSelectedItems(item).filter((s): s is FSItem => !!s);
      if (selArr.length !== 1) {
        vscode.window.showWarningMessage('Please select only one root folder to remove.');
        return;
      }
      const sel = selArr[0];
      // Only allow removal if this is a root folder (matches configured path)
      const cfg = vscode.workspace.getConfiguration();
      const folders = cfg.get<string[]>('secondaryExplorer.folders') || [];
      if (!folders.includes(sel.fullPath)) {
        vscode.window.showWarningMessage('This folder is not a root folder in the configuration.');
        return;
      }
      const confirm = await vscode.window.showWarningMessage(
        `Remove folder "${sel.fullPath}" from Secondary Explorer?`,
        { modal: true },
        'Remove'
      );
      if (confirm !== 'Remove') return;
      const updated = folders.filter((f) => f !== sel.fullPath);
      await cfg.update('secondaryExplorer.folders', updated, vscode.ConfigurationTarget.Global);
      provider.refresh();
      vscode.window.setStatusBarMessage('Folder removed from Secondary Explorer', 1500);
    })
  );
}
