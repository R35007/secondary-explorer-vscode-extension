import * as fs from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { FSItem } from '../models/FSItem';

export class SecondaryExplorerProvider implements vscode.TreeDataProvider<FSItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<FSItem | undefined | void> =
    new vscode.EventEmitter<FSItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<FSItem | undefined | void> =
    this._onDidChangeTreeData.event;

  private folderRoots: string[] = [];
  private useThemeIcons = true;

  constructor(private context: vscode.ExtensionContext) {
    this.loadFolders();
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration('secondaryExplorer.folders') ||
        e.affectsConfiguration('workbench.iconTheme') ||
        e.affectsConfiguration('workbench.tree.renderIcons')
      ) {
        this.loadFolders();
        this.refresh();
      }
    });
  }

  loadFolders() {
    const cfg = vscode.workspace.getConfiguration();
    const folders = cfg.get<string[]>('secondaryExplorer.folders') || [];
    this.folderRoots = folders.filter((p) => typeof p === 'string' && path.isAbsolute(p));

    const workbenchCfg = vscode.workspace.getConfiguration('workbench');
    const iconTheme = workbenchCfg.get<string | null>('iconTheme');
    const renderIcons = workbenchCfg.get<boolean>('tree.renderIcons', true);
    this.useThemeIcons = !!iconTheme && renderIcons;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: FSItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  private compareItems = (a: FSItem, b: FSItem) => {
    const aIsDir = a.type === 'folder' || a.type === 'root';
    const bIsDir = b.type === 'folder' || b.type === 'root';
    if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
    const an = String(a.label).toLocaleLowerCase();
    const bn = String(b.label).toLocaleLowerCase();
    if (an < bn) return -1;
    if (an > bn) return 1;
    return 0;
  };

  async getChildren(element?: FSItem): Promise<FSItem[]> {
    if (!element) {
      if (this.folderRoots.length === 1) {
        const cfg = vscode.workspace.getConfiguration();
        const showRoot = cfg.get<boolean>('secondaryExplorer.showSingleRootFolder', false);
        const base = this.folderRoots[0];
        try {
          const stat = await fs.stat(base);
          if (stat.isDirectory()) {
            if (showRoot) {
              // Show the root folder as a node
              return [new FSItem(path.basename(base) || base, base, 'root', this.useThemeIcons)];
            } else {
              // Show only the children of the root folder
              const names = await fs.readdir(base);
              const items = await Promise.all(
                names.map(async (n) => {
                  const p = path.join(base, n);
                  try {
                    const s = await fs.stat(p);
                    return new FSItem(
                      n,
                      p,
                      s.isDirectory() ? 'folder' : 'file',
                      this.useThemeIcons
                    );
                  } catch (e) {
                    return null;
                  }
                })
              );
              return (items.filter(Boolean) as FSItem[]).sort(this.compareItems);
            }
          }
          return [new FSItem(path.basename(base) || base, base, 'file', this.useThemeIcons)];
        } catch {
          return [];
        }
      }
      return this.folderRoots
        .map((f) => new FSItem(path.basename(f) || f, f, 'root', this.useThemeIcons))
        .sort(this.compareItems);
    }
    const full = element.fullPath;
    try {
      const stat = await fs.stat(full);
      if (stat.isDirectory()) {
        const names = await fs.readdir(full);
        const items = await Promise.all(
          names.map(async (n) => {
            const p = path.join(full, n);
            try {
              const s = await fs.stat(p);
              return new FSItem(n, p, s.isDirectory() ? 'folder' : 'file', this.useThemeIcons);
            } catch (e) {
              return null;
            }
          })
        );
        return (items.filter(Boolean) as FSItem[]).sort(this.compareItems);
      }
      return [];
    } catch (e) {
      return [];
    }
  }
}
