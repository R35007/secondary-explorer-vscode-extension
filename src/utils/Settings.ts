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
  static setSettings(key: string, val: any, isGlobal = true) {
    return Settings.configuration.update(key, val, isGlobal);
  }

  static get paths() {
    return (Settings.getSettings('paths') as Array<string | UserPaths>) || [];
  }

  static set paths(paths: Array<string | UserPaths>) {
    Settings.setSettings('paths', paths);
  }

  static get parsedPaths() {
    const paths = Settings.paths;
    const workspaceFolders = vscode.workspace.workspaceFolders || [];
    const userHome = process.env.HOME || process.env.USERPROFILE || '';
    const defaultInclude: string[] = [];
    const defaultExclude: string[] = ['node_modules', 'dist', 'build', 'out'];

    // get Normalized paths
    const normalized: NormalizedPaths[] = paths.map((p) => {
      if (typeof p === 'string') {
        const basePath = interpolate(p.replace(/\\/g, '/'), { workspaceFolder: workspaceFolders[0]?.uri.fsPath || '', userHome });
        return {
          basePath,
          name: path.basename(basePath),
        };
      }
      const basePath = interpolate(p.basePath?.replace(/\\/g, '/') || `${workspaceFolders}`, {
        workspaceFolder: workspaceFolders[0]?.uri.fsPath || '',
        userHome,
      });
      return {
        basePath,
        name: p.name || path.basename(basePath),
        include: getFormattedPatternPaths(([] as string[]).concat(p.include || defaultInclude)),
        exclude: getFormattedPatternPaths(([] as string[]).concat(p.exclude || defaultExclude)),
      };
    });

    // filter only valid and exist baseFolders
    const filtered = normalized.filter((p) => p.basePath && path.isAbsolute(p.basePath) && fsx.existsSync(p.basePath));
    console.log('Filtered paths:', filtered);
    return filtered;
  }
}
