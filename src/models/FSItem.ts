import * as vscode from 'vscode';

export type EntryType = 'file' | 'folder' | 'root';

export class FSItem extends vscode.TreeItem {
  fullPath: string;
  type: EntryType;
  constructor(label: string, fullPath: string, type: EntryType, useThemeIcons: boolean) {
    super(
      label,
      type === 'folder' || type === 'root'
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );
    this.fullPath = fullPath;
    this.type = type;
    this.contextValue = type === 'file' ? 'file' : type === 'folder' ? 'folder' : 'root';
    if (type === 'file') {
      this.command = {
        command: 'secondary-explorer.openFile',
        title: 'Open File',
        arguments: [this],
      };
      if (useThemeIcons) {
        this.resourceUri = vscode.Uri.file(fullPath);
      } else {
        this.iconPath = new vscode.ThemeIcon('file');
      }
    } else if (type === 'folder' || type === 'root') {
      if (useThemeIcons) {
        this.resourceUri = vscode.Uri.file(fullPath);
      } else {
        this.iconPath = new vscode.ThemeIcon(type === 'root' ? 'root-folder' : 'folder');
      }
    }
  }
}
