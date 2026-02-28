import * as fsx from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { Settings } from '../utils/Settings';
import { normalizePath } from '../utils/utils';

export type FSItemProps = {
  basePath: string;
  description?: string | boolean | undefined;
  tooltip?: string | vscode.MarkdownString | undefined;
  include?: string[];
  exclude?: string[];
  name?: string;
  isRoot?: boolean;
  showEmptyDirectories?: boolean;
  viewAsList?: boolean;
  rootIndex?: number;
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
  parent: FSItem | undefined;

  constructor(
    {
      basePath,
      name,
      description,
      tooltip,
      rootIndex = -1,
      isRoot = false,
      showEmptyDirectories,
      viewAsList,
      include,
      exclude,
      sortOrderPattern,
    }: FSItemProps,
    parent?: FSItem,
  ) {
    const normalizedBasePath = normalizePath(basePath);
    const itemLabel = name || path.basename(normalizedBasePath);
    const isFile = fsx.statSync(normalizedBasePath).isFile();
    const collapsibleState = isFile ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed;

    super(itemLabel, collapsibleState);

    this.resourceUri = vscode.Uri.file(normalizedBasePath);
    this.description = isRoot ? description : undefined;
    this.tooltip = isRoot ? tooltip : normalizedBasePath;
    this.iconPath = undefined;
    // used as a viewItem in the package.json
    this.contextValue = isRoot ? 'root' : isFile ? 'file' : 'folder';

    this.parent = parent;
    this.rootIndex = rootIndex;
    this.isRoot = isRoot;
    this.type = isFile ? 'file' : 'folder';

    // Users configurations
    this.basePath = normalizedBasePath;
    this.include = include;
    this.exclude = exclude;
    this.showEmptyDirectories = showEmptyDirectories;
    this.viewAsList = viewAsList;
    this.sortOrderPattern = sortOrderPattern;

    if (isFile) {
      this.command = {
        command: 'secondary-explorer.openFile',
        title: 'Open File',
        arguments: [this],
      };
      this.resourceUri = vscode.Uri.file(normalizedBasePath);
    }
  }

  static getItem(fsPath: string): FSItem | undefined {
    const normalizedFsPath = normalizePath(fsPath);
    const parsedPaths = Settings.parsedPaths;

    const withinParsedPathsIndex = parsedPaths.findIndex(({ basePath }) => {
      return basePath === normalizedFsPath || normalizedFsPath.startsWith(basePath + path.sep);
    });

    if (withinParsedPathsIndex < 0) return;

    const getFSItem = (fsPath: string): FSItem => {
      const rootIndex = parsedPaths.findIndex((pathObj) => pathObj.basePath === fsPath);
      if (rootIndex >= 0) return new FSItem({ ...parsedPaths[rootIndex], isRoot: true, rootIndex });
      return new FSItem(
        { ...parsedPaths[withinParsedPathsIndex], basePath: fsPath, name: path.basename(fsPath), isRoot: false, rootIndex: -1 },
        getFSItem(normalizePath(path.dirname(fsPath))),
      );
    };

    return getFSItem(normalizedFsPath);
  }
}
