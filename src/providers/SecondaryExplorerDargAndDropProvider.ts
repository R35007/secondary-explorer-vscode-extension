import * as fs from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { FSItem } from '../models/FSItem';
import { normalizePath } from '../utils/utils';
import { SecondaryExplorerProvider } from './SecondaryExplorerProvider';

export class SecondaryExplorerDragAndDrop implements vscode.TreeDragAndDropController<FSItem> {
  readonly id = 'secondaryExplorerDragAndDrop';
  readonly dropMimeTypes = ['application/vnd.code.tree.secondaryExplorerView', 'text/uri-list'];
  readonly dragMimeTypes = ['text/uri-list'];

  constructor(private provider: SecondaryExplorerProvider) {}

  /**
   * Handles drag events by storing dragged item paths
   * in both tree-specific and URI formats so they can
   * be recognized by the explorer and editor.
   */
  async handleDrag(source: readonly FSItem[], treeDataTransfer: vscode.DataTransfer, token: vscode.CancellationToken) {
    treeDataTransfer.set('application/vnd.code.tree.secondaryExplorerView', new vscode.DataTransferItem(source.map((s) => s.fullPath)));

    const uris = source.map((s) => vscode.Uri.file(s.fullPath).toString()).join('\n');
    treeDataTransfer.set('text/uri-list', new vscode.DataTransferItem(uris));
  }

  /**
   * Resolves the correct target directory for a drop.
   * If the target is a file, returns its parent folder.
   * If inaccessible, returns null and shows an error.
   */
  private async resolveTargetDir(target: FSItem): Promise<string | null> {
    try {
      const stat = await fs.stat(target.fullPath);
      return stat.isDirectory() ? target.fullPath : path.dirname(target.fullPath);
    } catch (err) {
      vscode.window.showErrorMessage(`Target not accessible: ${String(err)}`);
      return null;
    }
  }

  private isSameOrSubDir(source: string, targetDir: string): boolean {
    const isSameDir = fs.statSync(source).isDirectory()
      ? normalizePath(source) === normalizePath(targetDir)
      : normalizePath(path.dirname(source)) === normalizePath(targetDir);
    const isSubDirMove = normalizePath(targetDir).startsWith(normalizePath(source + path.sep));
    return isSameDir || isSubDirMove;
  }

  /**
   * Moves a single file or folder into the target directory.
   * Skips no-op cases: same directory, moving into own folder/subdir,
   * or if the destination already exists. Reports progress.
   */
  private async moveItem(filePath: string, targetDir: string, progress?: vscode.Progress<unknown>, cancelToken?: vscode.CancellationToken) {
    if (cancelToken?.isCancellationRequested) return;

    try {
      const fileName = path.basename(filePath);
      const newPath = path.join(targetDir, fileName);

      // Prevent moving a directory into itself or its subdirectories
      if (this.isSameOrSubDir(filePath, targetDir)) return;

      // Skip if file already exists in target
      if (await fs.pathExists(newPath)) {
        vscode.window.showWarningMessage(`File already exists: ${newPath}`);
        return;
      }

      await fs.move(filePath, newPath, { overwrite: false });
      progress?.report({ message: `Moved: ${fileName}` });
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to move ${filePath}: ${String(err)}`);
    }
  }

  /**
   * Runs the move operation for multiple dragged paths.
   * Shows progress if multiple items or folders are involved.
   * Reports incremental progress as items are moved.
   */
  private async runMove(draggedPaths: string[], targetDir: string, showProgress: boolean) {
    const runner = async (progress?: vscode.Progress<unknown>, cancelToken?: vscode.CancellationToken) => {
      const total = draggedPaths.length;
      let count = 0;

      for (const filePath of draggedPaths) {
        await this.moveItem(filePath, targetDir, progress, cancelToken);
        count++;
        progress?.report({ increment: (count / total) * 100, message: `${count}/${total} moved` });
      }
    };

    if (showProgress) {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Moving files...', cancellable: true },
        runner,
      );
    } else {
      await runner();
    }
  }

  /**
   * Opens dropped URIs directly in the editor.
   * Supports opening beside the current editor if no target is provided.
   */
  private async openDroppedUris(uriItem: vscode.DataTransferItem, target?: FSItem) {
    const uris: string[] = uriItem.value.split('\n').filter(Boolean);
    for (const uriStr of uris) {
      const uri = vscode.Uri.parse(uriStr);
      const activeEditor = vscode.window.activeTextEditor;
      const column = activeEditor ? activeEditor.viewColumn : vscode.ViewColumn.One;
      const openBeside = target === undefined;
      await vscode.window.showTextDocument(uri, { viewColumn: openBeside ? vscode.ViewColumn.Beside : column, preview: false });
    }
  }

  /**
   * Main drop handler. Decides whether the drop is a move
   * within the explorer or an open action in the editor.
   * Delegates actual work to helper functions for clarity.
   */
  async handleDrop(target: FSItem | undefined, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken) {
    const treeItem = dataTransfer.get('application/vnd.code.tree.secondaryExplorerView');
    if (treeItem && target) {
      const draggedPaths: string[] = treeItem.value;
      const targetDir = await this.resolveTargetDir(target);
      if (!targetDir) return;

      const hasFolder = draggedPaths.some((i) => fs.statSync(i).isDirectory());
      const isSameOrSubDir = draggedPaths.every((p) => this.isSameOrSubDir(p, targetDir));
      if (isSameOrSubDir) return;

      const showProgress = draggedPaths.length > 1 || hasFolder;
      await this.runMove(draggedPaths, targetDir, showProgress);
      this.provider.refresh();
      return;
    }

    const uriItem = dataTransfer.get('text/uri-list');
    if (uriItem) {
      await this.openDroppedUris(uriItem, target);
    }
  }
}
