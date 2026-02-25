import fg from 'fast-glob';
import * as fs from 'fs-extra';
import micromatch from 'micromatch';
import * as path from 'path';
import * as vscode from 'vscode';
import { FSItem } from '../models/FSItem';
import { NormalizedPaths, Settings } from '../utils/Settings';
import { safePromise, setContext } from '../utils/utils';

export class SecondaryExplorerProvider implements vscode.TreeDataProvider<FSItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<FSItem | undefined | void> = new vscode.EventEmitter<FSItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<FSItem | undefined | void> = this._onDidChangeTreeData.event;

  public explorerPaths: NormalizedPaths[] = [];
  private shouldViewAsList = false;

  // Cache for directory listings
  private cache = new Map<string, FSItem[]>();

  constructor(private context: vscode.ExtensionContext) {
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

    // File system watcher to invalidate cache
    const watcher = vscode.workspace.createFileSystemWatcher('**/*');
    watcher.onDidCreate((uri) => this.invalidateCache(uri.fsPath));
    watcher.onDidDelete((uri) => this.invalidateCache(uri.fsPath));
    watcher.onDidChange((uri) => this.invalidateCache(uri.fsPath));
  }

  private invalidateCache(fullPath: string) {
    const dir = path.dirname(fullPath);
    this.cache.delete(dir);
    this.cache.delete(fullPath);
    this.refresh();
  }

  loadPaths() {
    this.explorerPaths = Settings.parsedPaths;
  }

  refresh(element?: FSItem): void {
    if (!element) this.cache.clear(); // Clear cache on full refresh
    this._onDidChangeTreeData.fire(element);
  }

  toggleListView(): void {
    this.shouldViewAsList = !this.shouldViewAsList;
    setContext('secondaryExplorerRootViewAsList', this.shouldViewAsList);
    this.refresh();
  }

  getTreeItem(element: FSItem): vscode.TreeItem {
    element.type === 'folder'
      ? (element.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed)
      : (element.collapsibleState = vscode.TreeItemCollapsibleState.None);

    return element;
  }

  private getSortedItemsByPattern(items: FSItem[]) {
    const hasPatterns = Array.isArray(Settings.itemsSortOrderPattern) && Settings.itemsSortOrderPattern.length > 0;

    const rank = (label: string) => {
      const lower = label.toLocaleLowerCase();
      const idx = Settings.itemsSortOrderPattern!.findIndex((p) => micromatch.isMatch(lower, p.toLocaleLowerCase()));
      return idx === -1 ? Settings.itemsSortOrderPattern!.length : idx;
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

  private async getChildrenItems(base: string, include?: string[], exclude?: string[]) {
    // Use cache if available
    if (this.cache.has(base)) {
      return this.cache.get(base)!;
    }

    let items: FSItem[] = [];

    if (this.shouldViewAsList) {
      const matchedFiles = await fg.glob(include ?? ['**/*'], {
        cwd: base,
        ignore: exclude,
        onlyFiles: true,
        dot: true,
      });
      items = matchedFiles.map((file) => new FSItem(path.resolve(base, file)));
    } else {
      const names = await fs.readdir(base);
      for (const label of names) {
        const fullPath = path.join(base, label);
        const [pathStats, error] = await safePromise(fs.stat(fullPath));
        if (error) continue;
        // continue if path or file matches exclude patterns or doesn't match include patterns
        if (exclude?.length && micromatch.isMatch(fullPath, exclude, { dot: true })) continue;
        if (pathStats.isFile() && include?.length && !micromatch.isMatch(fullPath, include, { dot: true })) continue;

        items.push(new FSItem(fullPath, label, include, exclude));
      }
    }

    const sorted = this.getSortedItemsByPattern(items);
    this.cache.set(base, sorted);
    return sorted;
  }

  private async renderSingleRoot() {
    const pathObj = this.explorerPaths[0];
    const stat = await fs.stat(pathObj.basePath);

    // Only one file, show just that file
    if (stat.isFile()) {
      return [new FSItem(pathObj.basePath, pathObj.name, pathObj.include, pathObj.exclude, true, 0)];
    }
    // isFile = true, isRoot = true

    return await this.getChildrenItems(pathObj.basePath, pathObj.include, pathObj.exclude);
  }

  private async renderRootItems() {
    if (this.explorerPaths.length === 1) return await this.renderSingleRoot();
    // Multiple valid paths: show each as root (file or folder)
    const items: FSItem[] = [];
    for (const [index, pathObj] of this.explorerPaths.entries()) {
      const [stat, error] = await safePromise(fs.stat(pathObj.basePath));
      if (error) continue;
      items.push(new FSItem(pathObj.basePath, pathObj.name, pathObj.include, pathObj.exclude, true, index));
    }
    return Settings.rootPathSortOrder === 'default' ? items : this.getRootSortedItems(items);
  }

  async getChildren(element?: FSItem): Promise<FSItem[]> {
    try {
      if (!element) return await this.renderRootItems();
      const full = element.fullPath;
      const stat = await fs.stat(full);
      if (stat.isDirectory()) return await this.getChildrenItems(full, element.include, element.exclude);
      return [];
    } catch {
      return [];
    }
  }
}
