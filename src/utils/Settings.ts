import fsx from 'fs-extra';
import path from 'path';
import * as vscode from 'vscode';
import { defaultExclude, defaultInclude, workspaceFolders } from './constants';
import {
  extractVariableAndValue,
  getFormattedPatternPaths,
  getInterpolateObject,
  getSettingSaveTarget,
  interpolate,
  normalizePath,
} from './utils';

export type UserPaths = {
  basePath?: string;
  name?: string;
  description?: string | boolean | undefined;
  tooltip?: string | vscode.MarkdownString | undefined;
  include?: string | string[];
  exclude?: string | string[];
  hidden?: boolean;
  showEmptyDirectories?: boolean;
  viewAsList?: boolean;
  sortOrderPattern?: string[];
};

export type NormalizedPaths = {
  basePath: string;
  name: string;
  description?: string | boolean | undefined;
  tooltip?: string | vscode.MarkdownString | undefined;
  include?: string[];
  exclude?: string[];
  hidden?: boolean;
  showEmptyDirectories?: boolean;
  viewAsList?: boolean;
  sortOrderPattern?: string[];
  rootIndex?: number;
};

export class Settings {
  // This lives only as long as the current window/session
  public static _sessionTarget: vscode.ConfigurationTarget | undefined;

  static get configuration() {
    return vscode.workspace.getConfiguration('secondaryExplorer');
  }
  static getSettings(val: string) {
    return Settings.configuration.get(val);
  }
  static hasWorkspaceSetting(key: string) {
    const inspect = Settings.configuration.inspect(key);
    return inspect?.workspaceValue !== undefined || inspect?.workspaceFolderValue !== undefined;
  }

  static get hasWorkspacePathSetting() {
    return Settings.hasWorkspaceSetting('paths');
  }

  static async setSettings(key: string, val: any) {
    // 1. If the setting already exists in the workspace, update it there (No prompt)
    if (Settings.hasWorkspaceSetting(key)) {
      return Settings.configuration.update(key, val, vscode.ConfigurationTarget.Workspace);
    }

    // 2. If we haven't asked the user in THIS session yet, prompt them
    if (Settings._sessionTarget === undefined) {
      const choice = await getSettingSaveTarget();
      if (!choice) return;
      Settings._sessionTarget = choice;
    }

    // 3. Save using the choice made in this session
    return Settings.configuration.update(key, val, Settings._sessionTarget);
  }

  static get paths() {
    return (Settings.getSettings('paths') as Array<string | UserPaths>) || [];
  }

  static set paths(paths: Array<string | UserPaths>) {
    Settings.setSettings('paths', paths);
  }
  static set showEmptyDirectories(value: boolean) {
    Settings.setSettings('showEmptyDirectories', value);
  }
  static get showEmptyDirectories() {
    return Settings.getSettings('showEmptyDirectories') as boolean;
  }
  static get viewAsList() {
    return Settings.getSettings('viewAsList') as boolean;
  }
  static set viewAsList(value: boolean) {
    Settings.setSettings('viewAsList', value);
  }
  static get deleteBehavior() {
    return (Settings.getSettings('deleteBehavior') as 'alwaysAsk' | 'recycleBin' | 'permanent') || 'recycleBin';
  }
  static get rootPathSortOrder() {
    return (Settings.getSettings('rootPathSortOrder') as 'default' | 'filesFirst' | 'foldersFirst') || 'default';
  }
  static get itemsSortOrderPattern() {
    return (Settings.getSettings('itemsSortOrderPattern') as string[]) || [];
  }

  static get parsedPaths() {
    const paths = Settings.paths;

    // get Normalized paths
    const normalized: NormalizedPaths[] = paths.map((p, index) => {
      const interpolateObject = getInterpolateObject();

      if (typeof p === 'string') {
        const [variable, folderName] = extractVariableAndValue(p || '${workspaceFolder}') || [];
        const basePath = interpolate(variable.replace(/\\/g, '/') || '${workspaceFolder}', interpolateObject);

        if (!basePath) return {} as NormalizedPaths;
        if (!workspaceFolders.length && !path.isAbsolute(basePath)) return {} as NormalizedPaths;

        const resolvedBasePath = normalizePath(path.resolve(interpolateObject.workspaceFolder, basePath)); // resolve with workspace folder to support multiple folders
        return {
          rootIndex: index,
          basePath: resolvedBasePath,
          name: folderName || path.basename(resolvedBasePath),
          include: getFormattedPatternPaths(defaultInclude),
          exclude: getFormattedPatternPaths(defaultExclude),
        };
      }
      const [variable, folderName] = extractVariableAndValue(p.basePath || '${workspaceFolder}') || [];
      const basePath = interpolate(variable?.replace(/\\/g, '/') || '${workspaceFolder}', interpolateObject);
      const resolvedBasePath = normalizePath(path.resolve(interpolateObject.workspaceFolder, basePath)); // resolve with workspace folder to support multiple folders
      return {
        ...p,
        rootIndex: index,
        basePath: resolvedBasePath,
        name: interpolate(p.name || folderName || path.basename(resolvedBasePath), interpolateObject),
        description: typeof p.description === 'string' ? interpolate(p.description, interpolateObject) : undefined,
        tooltip: p.tooltip,
        include: getFormattedPatternPaths(([] as string[]).concat(p.include || defaultInclude)),
        exclude: getFormattedPatternPaths(([] as string[]).concat(p.exclude || defaultExclude)),
      };
    });

    // filter only valid and exist baseFolders
    const filtered = normalized.filter((p) => p.basePath && path.isAbsolute(p.basePath) && fsx.existsSync(p.basePath) && !p.hidden);
    return filtered;
  }
}
