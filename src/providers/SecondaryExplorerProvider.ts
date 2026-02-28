import fg from 'fast-glob';
import * as fs from 'fs-extra';
import micromatch from 'micromatch';
import path from 'path';
import * as vscode from 'vscode';
import { FSItem } from '../models/FSItem';
import { NormalizedPaths, Settings } from '../utils/Settings';
import { log, normalizePath, safePromise } from '../utils/utils';
export class SecondaryExplorerProvider implements vscode.TreeDataProvider<FSItem> {
  public explorerPaths: NormalizedPaths[] = [];

  #onDidChangeTreeData: vscode.EventEmitter<FSItem | undefined | void> = new vscode.EventEmitter<FSItem | undefined | void>();

  readonly onDidChangeTreeData: vscode.Event<FSItem | undefined | void> = this.#onDidChangeTreeData.event;

  constructor() {
    this.loadPaths();

    vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration('secondaryExplorer.paths') ||
        e.affectsConfiguration('workbench.iconTheme') ||
        e.affectsConfiguration('workbench.tree.renderIcons')
      ) {
        this.loadPaths();
        this.refresh();
      }
    });
  }

  loadPaths() {
    this.explorerPaths = Settings.parsedPaths;
  }

  refresh(element?: FSItem): void {
    log('Provider refreshed');
    this.#onDidChangeTreeData.fire(element);
  }

  findItemByUri(uri: vscode.Uri): FSItem | undefined {
    return FSItem.getItem(normalizePath(uri.fsPath));
  }

  getParent(element: FSItem): vscode.ProviderResult<FSItem> {
    return element.parent;
  }

  getTreeItem(element: FSItem): vscode.TreeItem {
    element.type === 'folder'
      ? (element.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed)
      : (element.collapsibleState = vscode.TreeItemCollapsibleState.None);

    return element;
  }

  private getSortedItemsByPattern(items: FSItem[], sortOrderPattern: string[] = Settings.itemsSortOrderPattern) {
    const hasPatterns = Array.isArray(Settings.itemsSortOrderPattern) && Settings.itemsSortOrderPattern.length > 0;

    const rank = (label: string) => {
      const lower = label.toLocaleLowerCase();
      const idx = sortOrderPattern!.findIndex((p) => micromatch.isMatch(lower, p.toLocaleLowerCase()));
      return idx === -1 ? sortOrderPattern!.length : idx;
    };

    return items.sort((a, b) => {
      const aIsDir = a.type === 'folder';
      const bIsDir = b.type === 'folder';

      // Folders always before files
      if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;

      if (hasPatterns) {
        // Pattern rank comparison
        const ar = rank(String(a.label));
        const br = rank(String(b.label));
        if (ar !== br) return ar - br;
      }

      // Fallback alphabetical
      const an = String(a.label).toLocaleLowerCase();
      const bn = String(b.label).toLocaleLowerCase();
      return an < bn ? -1 : an > bn ? 1 : 0;
    });
  }

  private getRootSortedItems = (items: FSItem[]) => {
    return items.sort((a, b) => {
      const aIsDir = a.type === 'folder';
      const bIsDir = b.type === 'folder';

      // FilesFirst / FoldersFirst handling
      if (Settings.rootPathSortOrder === 'filesFirst' && aIsDir !== bIsDir) return aIsDir ? 1 : -1;
      if (Settings.rootPathSortOrder === 'foldersFirst' && aIsDir !== bIsDir) return aIsDir ? -1 : 1;

      // Mixed or fallback: alphabetical
      const an = String(a.label).toLocaleLowerCase();
      const bn = String(b.label).toLocaleLowerCase();
      return an < bn ? -1 : an > bn ? 1 : 0;
    });
  };

  private async getChildrenItems(element: FSItem) {
    const stat = await fs.stat(element.basePath);
    if (stat.isFile()) return [];

    // If list view, ignore hierarchy and show all matching files
    if (element.viewAsList ?? Settings.viewAsList) {
      const matchedFiles = await fg.glob(element.include ?? ['**/*'], {
        cwd: element.basePath,
        ignore: element.exclude,
        onlyFiles: true,
        dot: true,
        absolute: true,
      });
      const items = matchedFiles.map(
        (child) =>
          new FSItem(
            {
              ...element,
              basePath: child,
              name: path.basename(child),
              isRoot: false,
              rootIndex: -1,
            },
            element,
          ),
      );
      return this.getSortedItemsByPattern(items, element.sortOrderPattern);
    }

    // immediate children (files + dirs)
    const children = await fg(['*'], {
      cwd: element.basePath,
      dot: true,
      onlyFiles: false,
      deep: 1,
      absolute: true,
      ignore: element.exclude ?? [],
    });

    const items: FSItem[] = [];

    for (const child of children) {
      const [stats, error] = await safePromise(fs.stat(child));

      if (error) continue;

      // exclude priority (already applied, but double-check)
      if (element.exclude?.length && micromatch.isMatch(child, element.exclude, { dot: true })) continue;
      if (stats.isFile() && element.include?.length && !micromatch.isMatch(child, element.include, { dot: true })) continue;

      const showEmptyDirectories = element.showEmptyDirectories ?? Settings.showEmptyDirectories;

      const shouldCheckNested = !showEmptyDirectories && stats.isDirectory() && (element.include?.length || element.exclude?.length);

      if (shouldCheckNested) {
        // keep dir only if it contains at least one matching file
        const nestedMatches = await fg(element.include ?? ['**/*'], {
          cwd: child,
          dot: true,
          onlyFiles: true,
          absolute: true,
          ignore: element.exclude ?? [],
        });

        if (nestedMatches.length === 0) continue;
      }

      items.push(
        new FSItem(
          {
            ...element,
            basePath: child,
            name: path.basename(child),
            isRoot: false,
            rootIndex: -1,
          },
          element,
        ),
      );
    }

    return this.getSortedItemsByPattern(items, element.sortOrderPattern);
  }

  private async renderSingleRoot() {
    const pathObj = this.explorerPaths[0];
    const stat = await fs.stat(pathObj.basePath);

    return stat.isFile() ? [new FSItem({ ...pathObj, isRoot: true, rootIndex: 0 })] : await this.getChildrenItems(new FSItem(pathObj));
  }

  async renderRootItems() {
    if (this.explorerPaths.length === 1) return await this.renderSingleRoot();
    // Multiple valid paths: show each as root (file or folder)
    const items: FSItem[] = [];
    for (const [rootIndex, pathObj] of this.explorerPaths.entries()) {
      const [_, error] = await safePromise(fs.stat(pathObj.basePath));
      if (error) continue;
      items.push(new FSItem({ ...pathObj, isRoot: true, rootIndex }));
    }
    return Settings.rootPathSortOrder === 'default' ? items : this.getRootSortedItems(items);
  }

  async getChildren(element?: FSItem): Promise<FSItem[]> {
    try {
      return !element ? await this.renderRootItems() : await this.getChildrenItems(element);
    } catch {
      return [];
    }
  }
}
