import * as fs from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { FSItem } from '../models/FSItem';
import { SecondaryExplorerProvider } from './SecondaryExplorerProvider';

export class SecondaryExplorerDragAndDrop implements vscode.TreeDragAndDropController<FSItem> {
  readonly id = 'secondaryExplorerDragAndDrop';
  readonly dropMimeTypes = ['application/vnd.code.tree.secondaryExplorerView', 'text/uri-list'];
  readonly dragMimeTypes = ['text/uri-list'];

  constructor(private provider: SecondaryExplorerProvider) {}

  async handleDrag(source: readonly FSItem[], treeDataTransfer: vscode.DataTransfer, token: vscode.CancellationToken) {
    // Store full paths of dragged items
    treeDataTransfer.set('application/vnd.code.tree.secondaryExplorerView', new vscode.DataTransferItem(source.map((s) => s.fullPath)));

    // Also set text/uri-list so editor can recognize drops
    const uris = source.map((s) => vscode.Uri.file(s.fullPath).toString()).join('\n');
    treeDataTransfer.set('text/uri-list', new vscode.DataTransferItem(uris));
  }

  async handleDrop(target: FSItem | undefined, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken) {
    const treeItem = dataTransfer.get('application/vnd.code.tree.secondaryExplorerView');
    if (treeItem && target) {
      const draggedPaths: string[] = treeItem.value;

      let targetDir = target.fullPath;
      try {
        const targetStat = await fs.stat(target.fullPath);
        if (!targetStat.isDirectory()) {
          // If target is a file, use its parent folder
          targetDir = path.dirname(target.fullPath);
        }
      } catch (err) {
        vscode.window.showErrorMessage(`Target not accessible: ${String(err)}`);
        return;
      }

      // Show progress with cancel support
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Moving files...',
          cancellable: true,
        },
        async (progress, cancelToken) => {
          const total = draggedPaths.length;
          let count = 0;

          for (const filePath of draggedPaths) {
            if (cancelToken.isCancellationRequested) {
              vscode.window.showInformationMessage('File move cancelled.');
              break;
            }

            try {
              const fileName = path.basename(filePath);
              const newPath = path.join(targetDir, fileName);

              if (await fs.pathExists(newPath)) {
                vscode.window.showWarningMessage(`File already exists: ${newPath}`);
                continue;
              }

              await fs.move(filePath, newPath, { overwrite: false });
            } catch (err) {
              vscode.window.showErrorMessage(`Failed to move ${filePath}: ${String(err)}`);
            }

            count++;
            progress.report({ increment: (count / total) * 100, message: `${count}/${total} moved` });
          }
        },
      );

      this.provider.refresh();
      return;
    }

    // Case 2: Drop into editor → open file(s)
    const uriItem = dataTransfer.get('text/uri-list');
    if (uriItem) {
      const uris: string[] = uriItem.value.split('\n').filter(Boolean);
      for (const uriStr of uris) {
        const uri = vscode.Uri.parse(uriStr);

        const activeEditor = vscode.window.activeTextEditor;
        const column = activeEditor ? activeEditor.viewColumn : vscode.ViewColumn.One;

        const openBeside = target === undefined;
        await vscode.window.showTextDocument(uri, {
          viewColumn: openBeside ? vscode.ViewColumn.Beside : column,
          preview: false,
        });
      }
    }
  }
}
