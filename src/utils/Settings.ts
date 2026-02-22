import fsx from 'fs-extra';
import path from 'path';
import * as vscode from 'vscode';
import { getFormattedPatternPaths, interpolate } from './utils';

type UserPaths = {
  basePath?: string;
  name?: string;
  include?: string | string[];
  exclude?: string | string[];
};

export type NormalizedPaths = {
  basePath: string;
  name: string;
  include?: string[];
  exclude?: string[];
};

export class Settings {
  static get configuration() {
    return vscode.workspace.getConfiguration('secondaryExplorer');
  }
  static getSettings(val: string) {
    return Settings.configuration.get(val);
  }
  static setSettings(key: string, val: any) {
    return Settings.configuration.update(key, val, vscode.ConfigurationTarget.Global);
  }

  static get paths() {
    return (Settings.getSettings('paths') as Array<string | UserPaths>) || [];
  }

  static set paths(paths: Array<string | UserPaths>) {
    Settings.setSettings('paths', paths);
  }

  static get deleteBehavior() {
    return (Settings.getSettings('deleteBehavior') as 'alwaysAsk' | 'recycleBin' | 'permanent') || 'recycleBin';
  }

  static get parsedPaths() {
    const paths = Settings.paths;
    const workspaceFolders = vscode.workspace.workspaceFolders || [];
    const userHome = process.env.HOME || process.env.USERPROFILE || '';
    const defaultInclude: string[] = [];
    const defaultExclude: string[] = ['node_modules', 'dist', 'build', 'out'];

    const interpolateObject = {
      workspaceFolder: workspaceFolders[0]?.uri.fsPath || '',
      userHome,
      workspaceFolderName: workspaceFolders[0]?.name || '',
      workspaceFolderBasename: path.basename(workspaceFolders[0]?.uri.fsPath || ''),
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
        const resolvedBasePath = path.resolve(interpolateObject.workspaceFolder, basePath); // resolve with workspace folder to support multiple folders
        return {
          basePath: resolvedBasePath,
          name: folderName || path.basename(resolvedBasePath),
        };
      }
      const [variable = p.basePath, folderName] = extractVariableAndValue(p.basePath || '${workspaceFolder}') || [];
      const basePath = interpolate(variable?.replace(/\\/g, '/') || '${workspaceFolder}', interpolateObject);
      const resolvedBasePath = path.resolve(interpolateObject.workspaceFolder, basePath); // resolve with workspace folder to support multiple folders
      return {
        basePath: resolvedBasePath,
        name: interpolate(p.name || folderName || path.basename(resolvedBasePath), interpolateObject),
        include: getFormattedPatternPaths(([] as string[]).concat(p.include || defaultInclude)),
        exclude: getFormattedPatternPaths(([] as string[]).concat(p.exclude || defaultExclude)),
      };
    });

    // filter only valid and exist baseFolders
    const filtered = normalized.filter((p) => p.basePath && path.isAbsolute(p.basePath) && fsx.existsSync(p.basePath));
    return filtered;
  }
}
