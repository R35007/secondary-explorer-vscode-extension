import * as fs from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { FSItem } from '../FSItem';
import { Settings } from '../Settings';
import { NO_TAGS } from '../constants';
import { extractVariableAndValue, getUniqueDestPath, log, normalizePath } from '../utils';
import { TreeDataProvider } from './TreeDataProvider';

export class TreeDragAndDropController implements vscode.TreeDragAndDropController<FSItem> {
  readonly id = 'secondaryExplorerDragAndDrop';
  readonly dropMimeTypes = ['application/vnd.code.tree.secondaryExplorerView', 'text/uri-list'];
  readonly dragMimeTypes = ['text/uri-list'];

  constructor(private provider: TreeDataProvider) {}

  /**
   * Handles drag events by storing dragged item paths
   * in both tree-specific and URI formats so they can
   * be recognized by the explorer and editor.
   */
  async handleDrag(source: readonly FSItem[], treeDataTransfer: vscode.DataTransfer, _token: vscode.CancellationToken) {
    try {
      const draggedItems = source.filter((s) => !!s);
      const isTagOrRoot = draggedItems.every((d) => (typeof d === 'object' && d.isRoot) || d.isTag);
      treeDataTransfer.set(
        'application/vnd.code.tree.secondaryExplorerView',
        new vscode.DataTransferItem(isTagOrRoot ? draggedItems : draggedItems.map((d) => d.basePath)),
      );
      log(`Dragged items prepared for transfer: ${draggedItems.map((d) => d.basePath).join(', ')}`);
    } catch (err) {
      log(`Failed to prepare dragged items: ${String(err)}`);
    }
  }

  /**
   * Resolves the correct target directory for a drop.
   * If the target is a file, returns its parent folder.
   * If inaccessible, returns null and shows an error.
   */
  private async resolveTargetDir(target: FSItem): Promise<string | undefined> {
    if (target.isTag) return;
    const stat = await fs.stat(target.basePath);
    const targetDir = stat.isDirectory() ? normalizePath(target.basePath) : normalizePath(path.dirname(target.basePath));
    log(`Resolved target directory: ${target.basePath} → ${targetDir}`);
    return targetDir;
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
    if (cancelToken?.isCancellationRequested) {
      log(`Move operation cancelled by user`);
      vscode.window.showInformationMessage('Move operation cancelled.');
      return;
    }

    const fileName = path.basename(filePath);
    const newPath = await getUniqueDestPath(targetDir, fileName);

    // Prevent moving a directory into itself or its subdirectories
    if (this.isSameOrSubDir(filePath, targetDir)) return;

    await fs.move(filePath, newPath, { overwrite: false });
    progress?.report({ message: `Moved: ${fileName}` });
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
   * Generates modal dialog content based on tag movement.
   */
  private getTagDropDetails(source: string, target: string, paths: string[]) {
    const isSNo = source === NO_TAGS;
    const isTNo = target === NO_TAGS;
    const pathList = paths.map((p) => `- ${p}`).join('\n');

    const message = isTNo ? `Remove tag "${source}"?` : isSNo ? `Assign items to "${target}"?` : `Move items to "${target}"?`;

    const detail = isTNo
      ? `The following items will have "${source}" removed and become untagged:\n\n${pathList}`
      : isSNo
        ? `The following untagged items will be assigned to "${target}":\n\n${pathList}`
        : `The following items will be reassigned from "${source}" to "${target}":\n\n${pathList}`;

    return { message, detail };
  }

  private async handleTagToTagDrop(draggedItem: FSItem, target: FSItem) {
    const sourceTag = draggedItem.tag!;
    const isNoTag = sourceTag === NO_TAGS;
    const targetTag = target.tag!;

    // Identify paths currently assigned to the source tag
    const affectedPaths = Settings.parsedPaths.filter((p) => p.tags.includes(sourceTag)).map((p) => p.basePath);

    if (affectedPaths.length === 0) return;

    // Custom messages for "No Tag" vs "Existing Tag"
    const { message, detail } = this.getTagDropDetails(sourceTag, targetTag, affectedPaths);

    // Show modal confirmation dialog
    const selection = await vscode.window.showWarningMessage(message, { modal: true, detail }, 'Proceed');

    if (selection !== 'Proceed') return;

    // Execute the update logic
    const selectedIndices = Settings.parsedPaths.filter((p) => p.tags.includes(sourceTag)).map((p) => p.rootIndex);

    Settings.paths = Settings.paths.map((p, i) => {
      if (!selectedIndices.includes(i)) return p;

      const isObj = typeof p !== 'string';
      const current = (isObj ? p.tags : [])?.filter((t) => !!t && t !== NO_TAGS && t !== sourceTag) || [];
      const updated = [...new Set([...current, targetTag])].filter((t) => t !== NO_TAGS);

      if (isObj) return { ...p, tags: updated };

      // Handle extraction for string-based paths
      const [variable = p, folderName] = extractVariableAndValue(p) || [];
      return { basePath: variable, name: folderName, tags: updated };
    });
  }

  private handleRootToTagDrop(draggedItems: FSItem[], target: FSItem) {
    const targetTag = target.tag!;
    draggedItems
      .filter((item) => item.parent?.tag || !item.tags || (item.tags?.length === 1 && item.tags[0] === NO_TAGS))
      .forEach((item) => {
        const sourceTag = item.parent?.tag || item.tags?.[0];
        if (!sourceTag) return;

        Settings.paths = Settings.paths.map((p, i) => {
          const isSelected = item.rootIndex === i;
          if (!isSelected) return p;

          const isObj = typeof p !== 'string';
          const current = (isObj ? p.tags : [])?.filter((t) => !!t && t !== NO_TAGS && t !== sourceTag) || [];

          const updated = [...new Set([...current, targetTag])].filter((t) => t !== NO_TAGS);

          if (isObj) return { ...p, tags: updated };

          const [variable = p, folderName] = extractVariableAndValue(p) || [];
          return { basePath: variable, name: folderName, tags: updated };
        });
      });
  }

  /**
   * Main drop handler. Decides whether the drop is a move
   * within the explorer or an open action in the editor.
   * Delegates actual work to helper functions for clarity.
   */
  async handleDrop(target: FSItem | undefined, dataTransfer: vscode.DataTransfer, _token: vscode.CancellationToken) {
    try {
      const treeItem = dataTransfer.get('application/vnd.code.tree.secondaryExplorerView');
      const uriItem = dataTransfer.get('text/uri-list');

      const draggedItems: Array<string | FSItem> = ([] as string[]).concat(treeItem?.value || uriItem?.value.split(/\r?\n/) || []).flat();
      if (!draggedItems.length || !target) return;

      const isTagToTagDrop = draggedItems.length === 1 && typeof draggedItems[0] === 'object' && draggedItems[0].isTag && target.isTag;
      const isRootToTagDrop = draggedItems.every((p) => typeof p === 'object' && p.isRoot) && target.isTag;

      if (isTagToTagDrop) return this.handleTagToTagDrop(draggedItems[0] as FSItem, target);
      if (isRootToTagDrop) return this.handleRootToTagDrop(draggedItems as FSItem[], target);

      const draggedPaths = [
        ...new Set(
          draggedItems
            .filter((d) => (typeof d === 'object' && !(d.isRoot || d.isTag)) || typeof d === 'string')
            .map((d) => (typeof d === 'object' ? d.basePath : d))
            .filter(Boolean),
        ),
      ];

      if (!draggedPaths.length) return;

      const targetDir = await this.resolveTargetDir(target);
      if (!targetDir) return;

      const normalizedPaths: string[] = draggedPaths.map(normalizePath);

      const hasFolder = normalizedPaths.some((i) => fs.statSync(i).isDirectory());
      const isSameOrSubDir = normalizedPaths.every((p) => this.isSameOrSubDir(p, targetDir));
      if (isSameOrSubDir) return;

      const showProgress = normalizedPaths.length > 1 || hasFolder;
      await this.runMove(normalizedPaths, targetDir, showProgress);
      log(`All items moved successfully into: ${targetDir}`);
    } catch (err) {
      log(`Failed to complete move operation: ${String(err)}`);
    }
  }
}
