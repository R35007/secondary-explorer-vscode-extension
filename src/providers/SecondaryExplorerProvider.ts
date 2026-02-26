import fg from 'fast-glob';
import * as fs from 'fs-extra';
import micromatch from 'micromatch';
import * as path from 'path';
import * as vscode from 'vscode';
import { FSItem } from '../models/FSItem';
import { NormalizedPaths, Settings } from '../utils/Settings';
import { safePromise, setContext } from '../utils/utils';

export class SecondaryExplorerProvider implements vscode.TreeDataProvider<FSItem> {
  public explorerPaths: NormalizedPaths[] = [];

  #onDidChangeTreeData: vscode.EventEmitter<FSItem | undefined | void> = new vscode.EventEmitter<FSItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<FSItem | undefined | void> = this.#onDidChangeTreeData.event;

  #shouldViewAsList = false;

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
  }

  loadPaths() {
    this.explorerPaths = Settings.parsedPaths;
  }

  refresh(element?: FSItem): void {
    this.#onDidChangeTreeData.fire(element);
  }

  toggleListView(): void {
    this.#shouldViewAsList = !this.#shouldViewAsList;
    setContext('secondaryExplorerRootViewAsList', this.#shouldViewAsList);
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
    // If list view, ignore hierarchy and show all matching files
    if (this.#shouldViewAsList) {
      const matchedFiles = await fg.glob(include ?? ['**/*'], { cwd: base, ignore: exclude, onlyFiles: true, dot: true });
      const items = matchedFiles.map((file) => new FSItem(path.resolve(base, file)));
      return this.getSortedItemsByPattern(items);
    }

    // immediate children (files + dirs)
    const children = await fg(['*'], {
      cwd: base,
      dot: true,
      onlyFiles: false,
      deep: 1,
      absolute: true,
      ignore: exclude ?? [],
    });

    const items: FSItem[] = [];

    for (const child of children) {
      const [stats, error] = await safePromise(fs.stat(child));

      if (error) continue;

      // exclude priority (already applied, but double-check)
      if (exclude?.length && micromatch.isMatch(child, exclude, { dot: true })) continue;
      if (stats.isFile() && include?.length && !micromatch.isMatch(child, include, { dot: true })) continue;

      const shouldCheckNested = !Settings.showEmptyDirectories && stats.isDirectory() && (include?.length || exclude?.length);

      if (shouldCheckNested) {
        // keep dir only if it contains at least one matching file
        const nestedMatches = await fg(include ?? ['**/*'], {
          cwd: child,
          dot: true,
          onlyFiles: true,
          absolute: true,
          ignore: exclude ?? [],
        });

        if (nestedMatches.length === 0) continue;
      }

      items.push(new FSItem(child, path.basename(child), include, exclude));
    }

    return this.getSortedItemsByPattern(items);
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
      const [_, error] = await safePromise(fs.stat(pathObj.basePath));
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
