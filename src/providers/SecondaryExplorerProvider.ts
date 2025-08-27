import * as fs from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { FSItem } from '../models/FSItem';

export class SecondaryExplorerProvider implements vscode.TreeDataProvider<FSItem> {
  public getRootPaths(): string[] {
    return this.folderRoots;
  }
  private _onDidChangeTreeData: vscode.EventEmitter<FSItem | undefined | void> = new vscode.EventEmitter<FSItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<FSItem | undefined | void> = this._onDidChangeTreeData.event;

  private folderRoots: string[] = [];
  private useThemeIcons = true;

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
    const cfg = vscode.workspace.getConfiguration();
    const paths = cfg.get<string[]>('secondaryExplorer.paths') || [];
    // Only keep absolute paths that exist
    this.folderRoots = paths
      .filter((p) => typeof p === 'string' && path.isAbsolute(p))
      .filter((p) => {
        try {
          return fs.existsSync(p);
        } catch {
          return false;
        }
      });

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
    const aIsDir = a.type === 'folder';
    const bIsDir = b.type === 'folder';
    if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
    const an = String(a.label).toLocaleLowerCase();
    const bn = String(b.label).toLocaleLowerCase();
    if (an < bn) return -1;
    if (an > bn) return 1;
    return 0;
  };

  getChildrenItems = async (base: string) => {
    const names = await fs.readdir(base);
    const items = await Promise.all(
      names.map(async (n) => {
        const p = path.join(base, n);
        try {
          const s = await fs.stat(p);
          return new FSItem(n, p, s.isFile(), false); // isRoot = false
        } catch {
          return null;
        }
      }),
    );
    return (items.filter(Boolean) as FSItem[]).sort(this.compareItems);
  };

  renderSingleRoot = async () => {
    const base = this.folderRoots[0];
    const stat = await fs.stat(base);
    if (stat.isDirectory()) return await this.getChildrenItems(base); // Show only the children of the root folder
    // Only one file, show just that file
    return [new FSItem(path.basename(base) || base, base, true, true)]; // isFile = true, isRoot = true
  };

  renderNewItems = async () => {
    if (this.folderRoots.length === 1) return await this.renderSingleRoot();
    // Multiple valid paths: show each as root (file or folder)
    const items = this.folderRoots.map((f) => {
      try {
        const stat = fs.statSync(f);
        return new FSItem(path.basename(f) || f, f, stat.isFile(), true); // isRoot = true
      } catch {
        return null;
      }
    });
    return items.filter((i): i is FSItem => i !== null).sort(this.compareItems);
  };

  async getChildren(element?: FSItem): Promise<FSItem[]> {
    try {
      if (!element) return await this.renderNewItems();
      const full = element.fullPath;
      const stat = await fs.stat(full);
      if (stat.isDirectory()) return await this.getChildrenItems(full);
      return [];
    } catch (e) {
      return [];
    }
  }
}
