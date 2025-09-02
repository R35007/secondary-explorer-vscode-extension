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

  private explorerPaths: NormalizedPaths[] = [];
  private shouldViewAsList: boolean = false;

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

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  toggleListView(): void {
    this.shouldViewAsList = !this.shouldViewAsList;
    setContext('secondaryExplorerRootViewAsList', this.shouldViewAsList);
    this.refresh();
  }

  getTreeItem(element: FSItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  private compareItems = (a: FSItem, b: FSItem) => {
    const aIsDir = a.type === 'folder';
    const bIsDir = b.type === 'folder';
    if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
    const an = String(a.label).toLocaleLowerCase();
    const bn = String(b.label).toLocaleLowerCase();
    if (an < bn) return -1;
    if (an > bn) return 1;
    return 0;
  };

  getAllFilesInDirectory = async (dir: string, include: string[] = ['**/*'], exclude?: string[]) => {
    const matchedFiles = await fg.glob(include, { cwd: dir, ignore: exclude, onlyFiles: true, dot: true });

    return matchedFiles
      .map((file) => path.resolve(dir, file))
      .map((folderPath) => {
        const label = path.basename(folderPath);
        return new FSItem(label, folderPath, true, false); // isFile = true, isRoot = false
      });
  };

  getChildrenItems = async (base: string, include?: string[], exclude?: string[]) => {
    if (this.shouldViewAsList) return await this.getAllFilesInDirectory(base, include, exclude);

    const names = await fs.readdir(base);
    const items: FSItem[] = [];
    for (const label of names) {
      const fullPath = path.join(base, label);
      const [pathStats, error] = await safePromise(fs.stat(fullPath));
      if (error) continue;
      // continue if path or file matches exclude patterns or doesn't match include patterns
      if (exclude?.length && micromatch.isMatch(fullPath, exclude, { dot: true })) continue;
      if (pathStats.isFile() && include?.length && !micromatch.isMatch(fullPath, include, { dot: true })) continue;
      if (
        pathStats.isDirectory() &&
        (include?.length || exclude?.length) &&
        !(await this.getChildrenItems(fullPath, include, exclude)).length
      ) {
        continue;
      }

      items.push(new FSItem(label, fullPath, pathStats.isFile(), false, include, exclude)); // isRoot = false
    }
    return items.sort(this.compareItems);
  };

  renderSingleRoot = async () => {
    const pathObj = this.explorerPaths[0];
    const stat = await fs.stat(pathObj.basePath);

    // Only one file, show just that file
    if (stat.isFile()) {
      return [new FSItem(pathObj.name, pathObj.basePath, true, true, pathObj.include, pathObj.exclude, 0)];
    }
    // isFile = true, isRoot = true

    return await this.getChildrenItems(pathObj.basePath, pathObj.include, pathObj.exclude); // Show only the children of the root folder
  };

  renderRootItems = async () => {
    if (this.explorerPaths.length === 1) return await this.renderSingleRoot();
    // Multiple valid paths: show each as root (file or folder)
    const items: FSItem[] = [];
    for (const [index, pathObj] of this.explorerPaths.entries()) {
      const [stat, error] = await safePromise(fs.stat(pathObj.basePath));
      if (error) continue;
      items.push(new FSItem(pathObj.name, pathObj.basePath, stat.isFile(), true, pathObj.include, pathObj.exclude, index)); // isRoot = true, pass index
    }
    return items.sort(this.compareItems);
  };

  async getChildren(element?: FSItem): Promise<FSItem[]> {
    try {
      if (!element) return await this.renderRootItems();
      const full = element.fullPath;
      const stat = await fs.stat(full);
      if (stat.isDirectory()) return await this.getChildrenItems(full, element.include, element.exclude);
      return [];
    } catch (e) {
      return [];
    }
  }
}
