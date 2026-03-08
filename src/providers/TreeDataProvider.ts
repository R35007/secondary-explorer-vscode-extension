import fg from 'fast-glob';
import * as fs from 'fs-extra';
import micromatch from 'micromatch';
import path from 'path';
import * as vscode from 'vscode';
import { NO_TAGS } from '../constants';
import { FSItem } from '../FSItem';
import { NormalizedPaths, Settings } from '../Settings';
import { log, normalizePath, safePromise, setContext } from '../utils';
export class TreeDataProvider implements vscode.TreeDataProvider<FSItem> {
  public explorerPaths: NormalizedPaths[] = [];
  public tags: string[] = [];

  #onDidChangeTreeData: vscode.EventEmitter<FSItem | undefined | void> = new vscode.EventEmitter<FSItem | undefined | void>();

  readonly onDidChangeTreeData: vscode.Event<FSItem | undefined | void> = this.#onDidChangeTreeData.event;

  constructor() {
    this.loadPaths();

    vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration('workbench.iconTheme') ||
        e.affectsConfiguration('workbench.tree.renderIcons') ||
        e.affectsConfiguration('explorer.fileNesting.enabled') ||
        e.affectsConfiguration('explorer.fileNesting.patterns')
      ) {
        this.refresh();
      }
    });
  }

  loadPaths() {
    this.explorerPaths = Settings.parsedPaths;
    setContext('secondaryExplorer.hasConfiguredPaths', Settings.paths.length > 0);
    // 1. Get unique tags and filter out the "NO_TAGS" value
    const rawTags = [...new Set(this.explorerPaths.map((p) => p.tags).flat())];

    // 2. Sort alphabetical tags and append NO_TAGS if it was present
    this.tags = [
      ...rawTags.filter((t) => t !== NO_TAGS).sort((a, b) => a.localeCompare(b)),
      ...(rawTags.includes(NO_TAGS) ? [NO_TAGS] : []),
    ];
  }

  refresh(element?: FSItem): void {
    this.#onDidChangeTreeData.fire(element);
  }

  findItemByUri(uri: vscode.Uri): FSItem | undefined {
    return FSItem.getItem(normalizePath(uri.fsPath));
  }

  getParent(element: FSItem): vscode.ProviderResult<FSItem> {
    return element.parent;
  }

  getTreeItem(element: FSItem): vscode.TreeItem {
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

    return this.applyFileNesting(this.getSortedItemsByPattern(items, element.sortOrderPattern));
  }

  private applyFileNesting(items: FSItem[]): FSItem[] {
    if (!Settings.fileNestingEnabled) return items;
    const patterns = Settings.fileNestingPatterns;
    if (!patterns || Object.keys(patterns).length === 0) return items;

    const files = items.filter((item) => item.type === 'file');
    const folders = items.filter((item) => item.type === 'folder');

    // Map from parent file basePath -> nested child FSItems
    const nestingMap = new Map<string, FSItem[]>();
    // Set of child paths that are nested under a parent
    const nestedPaths = new Set<string>();

    for (const [parentGlob, childGlobsStr] of Object.entries(patterns)) {
      const childGlobs = childGlobsStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      for (const parentFile of files) {
        // A file that is already nested cannot also act as a parent
        if (nestedPaths.has(parentFile.basePath)) continue;

        const parentName = path.basename(parentFile.basePath);
        if (!micromatch.isMatch(parentName, parentGlob, { dot: true, nocase: true })) continue;

        // Extract what the first '*' captured in the parent glob
        const captures = micromatch.capture(parentGlob, parentName, { dot: true, nocase: true });
        const capture = captures ? (captures[0] ?? parentName) : parentName;

        // Resolve $(capture) placeholders in each child glob
        const resolvedChildPatterns = childGlobs.map((g) => g.replace(/\$\(capture\)/g, capture));

        for (const childFile of files) {
          if (childFile.basePath === parentFile.basePath) continue;
          if (nestedPaths.has(childFile.basePath)) continue;

          const childName = path.basename(childFile.basePath);
          if (resolvedChildPatterns.some((p) => micromatch.isMatch(childName, p, { dot: true, nocase: true }))) {
            if (!nestingMap.has(parentFile.basePath)) nestingMap.set(parentFile.basePath, []);
            nestingMap.get(parentFile.basePath)!.push(childFile);
            nestedPaths.add(childFile.basePath);
          }
        }
      }
    }

    const result: FSItem[] = [...folders];
    for (const file of files) {
      if (nestedPaths.has(file.basePath)) continue; // hidden — rendered as child of its parent
      const children = nestingMap.get(file.basePath);
      if (children?.length) {
        file.nestedChildren = children;
        file.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        // ThemeIcon.File + resourceUri tells VS Code to resolve the icon via the
        // file icon theme as a *file* (isDirectory=false), avoiding the folder icon
        // that collapsible state would otherwise trigger.
        file.iconPath = new vscode.ThemeIcon('file');
      }
      result.push(file);
    }

    return result;
  }

  private async renderSingleRoot() {
    const pathObj = this.explorerPaths[0];
    const stat = await fs.stat(pathObj.basePath);

    return stat.isFile() ? [new FSItem({ ...pathObj, isRoot: true })] : await this.getChildrenItems(new FSItem(pathObj));
  }

  private async renderMultipleRoot(explorerPaths = this.explorerPaths, parent?: FSItem) {
    const items: FSItem[] = [];
    for (const [_, pathObj] of explorerPaths.entries()) {
      const [_, error] = await safePromise(fs.stat(pathObj.basePath));
      if (error) continue;
      items.push(new FSItem({ ...pathObj, isRoot: true }, parent));
    }
    return Settings.rootPathSortOrder === 'default' ? items : this.getRootSortedItems(items);
  }

  async renderRootItems() {
    if (!this.explorerPaths.length) return [];
    if (this.explorerPaths.length === 1) return await this.renderSingleRoot();
    if (Settings.groupByTags && this.tags.length && Settings.showUntaggedAtRoot) {
      const noTagItems = await this.renderMultipleRoot(this.explorerPaths.filter((p) => p.tags?.includes(NO_TAGS)));
      const taggedItems = this.tags.filter((tag) => tag !== NO_TAGS).map((tag) => new FSItem({ tag }));
      return [...noTagItems, ...taggedItems];
    }
    if (Settings.groupByTags && this.tags.length && !Settings.showUntaggedAtRoot) return this.tags.map((tag) => new FSItem({ tag }));
    return await this.renderMultipleRoot();
  }

  async getChildren(element?: FSItem): Promise<FSItem[]> {
    try {
      if (!element) {
        const items = await this.renderRootItems();
        setContext('secondaryExplorer.hasValidPaths', items.length > 0);
        return items;
      }
      if (element.isTag) {
        const parentItem = new FSItem({ tag: element.tag });
        return await this.renderMultipleRoot(
          this.explorerPaths.filter((p) => p.tags?.includes(element.tag!)),
          parentItem,
        );
      }
      // File nesting: return pre-computed nested children for a parent file
      if (element.nestedChildren?.length) return element.nestedChildren;
      return await this.getChildrenItems(element as FSItem);
    } catch (err) {
      log(`Something went wrong!: ${String(err)}`);
      return [];
    }
  }
}
