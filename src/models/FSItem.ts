import * as vscode from 'vscode';

export class FSItem extends vscode.TreeItem {
  fullPath: string;
  rootIndex: number;
  type: 'file' | 'folder';
  include: string[] | undefined;
  exclude: string[] | undefined;
  constructor(
    label: string,
    fullPath: string,
    isFile: boolean,
    isRoot: boolean,
    include?: string[],
    exclude?: string[],
    index: number = -1,
  ) {
    super(label, !isFile ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
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
