import * as fsx from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { NO_TAGS } from './constants';
import { Settings } from './Settings';
import { normalizePath } from './utils';

export type FSItemProps = {
  tag?: string;
  tags?: string[];
  basePath?: string;
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
  isRoot: boolean;
  isTag: boolean;
  rootIndex: number;
  type: 'file' | 'folder';
  tag?: string;
  tags?: string[];
  include?: string[];
  exclude?: string[];
  sortOrderPattern?: string[];
  showEmptyDirectories?: boolean;
  viewAsList?: boolean;
  parent?: FSItem;

  constructor(
    {
      tag,
      tags,
      basePath = '',
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
    if (tag) {
      super(tag, vscode.TreeItemCollapsibleState.Collapsed);
      this.basePath = '';
      this.rootIndex = -1;
      this.isRoot = false;
      this.isTag = true;
      this.type = 'folder';
      this.contextValue = 'tag';
      this.tag = tag;
      this.iconPath = new vscode.ThemeIcon('tag');

      if (tag === NO_TAGS) {
        this.label = '';
        this.description = tag;
        const tooltip = new vscode.MarkdownString();

        // 1. Enable command links and icons
        tooltip.isTrusted = true;
        tooltip.supportThemeIcons = true;

        tooltip.appendMarkdown(`#### **Unorganized Paths**\n\n`);
        tooltip.appendMarkdown(`This group contains all paths that currently have no tags assigned.\n\n`);

        const showWorkspaceSetting = Settings.hasWorkspacePathSetting || Settings._sessionTarget === vscode.ConfigurationTarget.Workspace;

        // 2. Add the link to settings
        // The syntax is [Label](command:commandId?args)
        const settingsArg = encodeURIComponent(JSON.stringify('secondaryExplorer.showUntaggedAtRoot'));
        tooltip.appendMarkdown(
          showWorkspaceSetting
            ? `$(settings-gear) [Show at root level instead of grouping](command:workbench.action.openWorkspaceSettings?${settingsArg})\n\n`
            : `$(settings-gear) [Show at root level instead of grouping](command:workbench.action.openSettings?${settingsArg})\n\n`,
        );

        tooltip.appendMarkdown(`---\n`);
        tooltip.appendMarkdown(`$(info) *Tip: Use the edit button to create or assign tags to these items.*`);

        this.tooltip = tooltip;
        this.iconPath = new vscode.ThemeIcon('tag-remove');
      }

      return;
    }

    const normalizedBasePath = normalizePath(basePath);
    const itemLabel = name || path.basename(normalizedBasePath);
    const isFile = fsx.statSync(normalizedBasePath).isFile();
    const collapsibleState = isFile ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed;

    super(itemLabel, collapsibleState);

    this.resourceUri = vscode.Uri.file(normalizedBasePath);
    this.description = isRoot ? description : undefined;
    this.tooltip = isRoot ? tooltip || `Root: ${itemLabel}` : normalizedBasePath;
    this.iconPath = isRoot && !isFile ? new vscode.ThemeIcon('root-folder') : undefined;
    // used as a viewItem in the package.json
    this.contextValue = tag ? 'tag' : isRoot ? 'root' : isFile ? 'file' : 'folder';

    this.parent = parent;
    this.rootIndex = rootIndex;
    this.isTag = false;
    this.tag = tag;
    this.tags = tags;
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
      return basePath === normalizedFsPath || normalizedFsPath.startsWith(normalizePath(basePath + path.sep));
    });

    if (withinParsedPathsIndex < 0) return;

    const getFSItem = (fsPath: string): FSItem | undefined => {
      const rootIndex = parsedPaths.findIndex((pathObj) => pathObj.basePath === fsPath);
      // If only one path is set then do not set that path as a parent
      if (rootIndex >= 0 && parsedPaths.length === 1) return undefined;

      if (rootIndex >= 0) {
        // set the tag as a parent item if Settings.groupByTags is set to true
        const parentItem = Settings.groupByTags ? new FSItem({ tag: parsedPaths[rootIndex].tags[0] }) : undefined;

        // Do not set tag as a parent if the current root item has not tag and Settings.showUntaggedAtRoot is set to true
        const shouldSetParent = Settings.showUntaggedAtRoot && parsedPaths[rootIndex].tags.includes(NO_TAGS);
        return new FSItem(
          {
            ...parsedPaths[rootIndex],
            isRoot: true,
            rootIndex,
          },
          shouldSetParent ? undefined : parentItem,
        );
      }

      const parentItem = getFSItem(normalizePath(path.dirname(fsPath)));
      return new FSItem(
        { ...parsedPaths[withinParsedPathsIndex], basePath: fsPath, name: path.basename(fsPath), isRoot: false, rootIndex: -1 },
        parentItem,
      );
    };

    return getFSItem(normalizedFsPath);
  }
}
