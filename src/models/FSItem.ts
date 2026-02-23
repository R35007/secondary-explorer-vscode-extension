import * as fsx from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';

export class FSItem extends vscode.TreeItem {
  fullPath: string;
  rootIndex: number;
  type: 'file' | 'folder';
  include: string[] | undefined;
  exclude: string[] | undefined;
  constructor(fullPath: string, name?: string, include?: string[], exclude?: string[], isRoot?: boolean, index: number = -1) {
    const itemLabel = name || path.basename(fullPath);
    const isFile = fsx.statSync(fullPath).isFile();
    const collapsibleState = isFile ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed;

    super(itemLabel, collapsibleState);

    this.fullPath = fullPath;
    this.rootIndex = index;
    this.contextValue = isRoot ? 'root' : isFile ? 'file' : 'folder';
    this.type = isFile ? 'file' : 'folder';
    this.include = include;
    this.exclude = exclude;

    if (isFile) {
      this.command = {
        command: 'secondary-explorer.openFile',
        title: 'Open File',
        arguments: [this],
      };
      this.resourceUri = vscode.Uri.file(fullPath);
      this.iconPath = new vscode.ThemeIcon('file');
    } else {
      this.resourceUri = vscode.Uri.file(fullPath);
      this.iconPath = new vscode.ThemeIcon(isRoot ? 'root-folder' : 'folder');
    }
  }
}
