import * as fsx from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';

export type FSItemProps = {
  basePath: string;
  include?: string[];
  exclude?: string[];
  name?: string;
  isRoot?: boolean;
  showEmptyDirectories?: boolean;
  viewAsList?: boolean;
  index?: number;
  sortOrderPattern?: string[];
};

export class FSItem extends vscode.TreeItem {
  basePath: string;
  rootIndex: number;
  type: 'file' | 'folder';
  include: string[] | undefined;
  exclude: string[] | undefined;
  sortOrderPattern: string[] | undefined;
  isRoot: boolean;
  showEmptyDirectories: boolean | undefined;
  viewAsList: boolean | undefined;

  constructor({
    basePath,
    name,
    index = -1,
    isRoot = false,
    showEmptyDirectories,
    viewAsList,
    include,
    exclude,
    sortOrderPattern,
  }: FSItemProps) {
    const itemLabel = name || path.basename(basePath);
    const isFile = fsx.statSync(basePath).isFile();
    const collapsibleState = isFile ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed;

    super(itemLabel, collapsibleState);

    this.basePath = basePath;
    this.rootIndex = index;
    this.contextValue = isRoot ? 'root' : isFile ? 'file' : 'folder';
    this.isRoot = isRoot;
    this.type = isFile ? 'file' : 'folder';
    this.include = include;
    this.exclude = exclude;
    this.showEmptyDirectories = showEmptyDirectories;
    this.viewAsList = viewAsList;
    this.sortOrderPattern = sortOrderPattern;

    this.iconPath = undefined;
    if (isFile) {
      this.command = {
        command: 'secondary-explorer.openFile',
        title: 'Open File',
        arguments: [this],
      };
      this.resourceUri = vscode.Uri.file(basePath);
    } else {
      this.resourceUri = vscode.Uri.file(basePath);
    }
  }
}
