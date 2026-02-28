import fsx from 'fs-extra';
import path from 'path';
import * as vscode from 'vscode';
import { getFormattedPatternPaths, interpolate, normalizePath } from './utils';

type UserPaths = {
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
};

export class Settings {
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

  static async setSettings(key: string, val: any) {
    // Update at workspace level if present
    if (Settings.hasWorkspaceSetting(key)) return Settings.configuration.update(key, val, vscode.ConfigurationTarget.Workspace);
    // Otherwise update globally
    return Settings.configuration.update(key, val, vscode.ConfigurationTarget.Global);
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
    const workspaceFolders = vscode.workspace.workspaceFolders || [];
    const defaultInclude: string[] = ['*'];
    const defaultExclude: string[] = ['node_modules', 'dist', 'build', 'out'];

    const interpolateObject = {
      workspaceFolder: workspaceFolders[0]?.uri.fsPath || '',
      workspaceFolderName: workspaceFolders[0]?.name || '',
      workspaceFolderBasename: path.basename(workspaceFolders[0]?.uri.fsPath || ''),
      userHome: process.env.HOME || process.env.USERPROFILE || '',
    };

    function extractVariableAndValue(input: string) {
      // Match ${variableName: value} followed by optional suffix
      const match = input.match(/\$\{([^:}]+):\s*([^}]*)\}([^\s]*)?/);
      if (!match) return null;

      const variableWithSuffix = `\${${match[1].trim()}}${match[3] || ''}`;
      const value = match[2].trim();
      return [variableWithSuffix, value];
    }

    // get Normalized paths
    const normalized: NormalizedPaths[] = paths.map((p) => {
      if (typeof p === 'string') {
        const [variable = p, folderName] = extractVariableAndValue(p || '${workspaceFolder}') || [];
        const basePath = interpolate(variable.replace(/\\/g, '/') || '${workspaceFolder}', interpolateObject);

        if (!basePath) return {} as NormalizedPaths;
        if (!workspaceFolders.length && !path.isAbsolute(basePath)) return {} as NormalizedPaths;

        const resolvedBasePath = normalizePath(path.resolve(interpolateObject.workspaceFolder, basePath)); // resolve with workspace folder to support multiple folders
        return {
          basePath: resolvedBasePath,
          name: folderName || path.basename(resolvedBasePath),
          include: getFormattedPatternPaths(defaultInclude),
          exclude: getFormattedPatternPaths(defaultExclude),
        };
      }
      const [variable = p.basePath, folderName] = extractVariableAndValue(p.basePath || '${workspaceFolder}') || [];
      const basePath = interpolate(variable?.replace(/\\/g, '/') || '${workspaceFolder}', interpolateObject);
      const resolvedBasePath = normalizePath(path.resolve(interpolateObject.workspaceFolder, basePath)); // resolve with workspace folder to support multiple folders
      return {
        ...p,
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
