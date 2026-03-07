import fsx from 'fs-extra';
import path from 'path';
import * as vscode from 'vscode';
import { defaultExclude, defaultInclude, NO_TAGS, workspaceFolders } from './constants';
import { extractVariableAndValue, getFormattedPatternPaths, getInterpolateObject, getSettingSaveTarget, log, normalizePath } from './utils';
import { interpolate } from './utils/parsing';

export type UserPaths = {
  basePath?: string;
  name?: string;
  description?: string | boolean | undefined;
  tooltip?: string | vscode.MarkdownString | undefined;
  include?: string | string[];
  exclude?: string | string[];
  tags?: string[];
  hidden?: boolean;
  showEmptyDirectories?: boolean;
  viewAsList?: boolean;
  sortOrderPattern?: string[];
};

export type NormalizedPaths = {
  basePath: string;
  name: string;
  include: string[];
  exclude: string[];
  tags: string[];
  rootIndex: number;
  description?: string | boolean | undefined;
  tooltip?: string | vscode.MarkdownString | undefined;
  hidden?: boolean;
  showEmptyDirectories?: boolean;
  viewAsList?: boolean;
  sortOrderPattern?: string[];
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

  static updatePathConfig(index: number, updates: Partial<UserPaths>) {
    const updatedPaths = [...Settings.paths];
    const current = updatedPaths[index];

    if (typeof current === 'string') {
      const [variable = current, folderName] = extractVariableAndValue(current) || [];
      updatedPaths[index] = { basePath: variable, name: folderName, ...updates };
    } else {
      updatedPaths[index] = { ...current, ...updates };
    }

    Settings.paths = updatedPaths;
  }

  static updateSettingsTags(selectedIndices: number[], tags: string[], updateAll: boolean = false) {
    Settings.paths = Settings.paths.map((p, i) => {
      const isSelected = selectedIndices.includes(i);
      if (!isSelected && !updateAll) return p;

      const isObj = typeof p !== 'string';
      const current = (isObj ? p.tags : [])?.filter((t) => !!t && t !== NO_TAGS) || [];

      const updated = isSelected ? [...new Set([...current, ...tags])] : current.filter((t) => !tags.includes(t));

      // If it was a string and is unselected with no tags to change, keep it a string.
      if (!isObj && !isSelected && updated.length === 0) return p;

      if (isObj) return { ...p, tags: updated };

      const [variable = p, folderName] = extractVariableAndValue(p) || [];
      return { basePath: variable, name: folderName, tags: updated };
    });
  }

  static get paths() {
    return (Settings.getSettings('paths') as Array<string | UserPaths>) || [];
  }

  static set paths(paths: Array<string | UserPaths>) {
    Settings.setSettings('paths', paths);
  }
  static get useAbsolutePath() {
    return Settings.getSettings('useAbsolutePath') as boolean;
  }
  static set showEmptyDirectories(value: boolean) {
    Settings.setSettings('showEmptyDirectories', value);
  }
  static get showEmptyDirectories() {
    return Settings.getSettings('showEmptyDirectories') as boolean;
  }
  static set groupByTags(value: boolean) {
    Settings.setSettings('groupByTags', value);
  }
  static get groupByTags() {
    return Settings.getSettings('groupByTags') as boolean;
  }
  static get viewAsList() {
    return Settings.getSettings('viewAsList') as boolean;
  }
  static set viewAsList(value: boolean) {
    Settings.setSettings('viewAsList', value);
  }
  static get showUntaggedAtRoot() {
    return Settings.getSettings('showUntaggedAtRoot') as boolean;
  }
  static get addFoldersOnly() {
    return Settings.getSettings('addFoldersOnly') as boolean;
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
    const paths = [...Settings.paths];

    // get Normalized paths
    const normalized: NormalizedPaths[] = paths.map((p, index) => {
      try {
        const interpolateObject = getInterpolateObject();

        if (typeof p === 'string') {
          const [variable, folderName] = extractVariableAndValue(p || '${workspaceFolder}') || [];
          const interpolatedPath = interpolate(variable.replace(/\\/g, '/') || '${workspaceFolder}', interpolateObject);

          if (!interpolatedPath) return {} as NormalizedPaths;
          if (!workspaceFolders.length && !path.isAbsolute(interpolatedPath)) return {} as NormalizedPaths;

          const resolvedBasePath = normalizePath(path.resolve(interpolateObject.workspaceFolder, interpolatedPath)); // resolve with workspace folder to support multiple folders
          const basePath =
            fsx.statSync(resolvedBasePath).isFile() && Settings.addFoldersOnly ? path.dirname(resolvedBasePath) : resolvedBasePath;
          return {
            rootIndex: index,
            basePath,
            name: folderName || path.basename(basePath),
            include: getFormattedPatternPaths(defaultInclude),
            exclude: getFormattedPatternPaths(defaultExclude),
            tags: [NO_TAGS],
          };
        }
        const [variable, folderName] = extractVariableAndValue(p.basePath || '${workspaceFolder}') || [];
        const interpolatedPath = interpolate(variable?.replace(/\\/g, '/') || '${workspaceFolder}', interpolateObject);
        const resolvedBasePath = normalizePath(path.resolve(interpolateObject.workspaceFolder, interpolatedPath)); // resolve with workspace folder to support multiple folders
        const basePath =
          fsx.statSync(resolvedBasePath).isFile() && Settings.addFoldersOnly ? path.dirname(resolvedBasePath) : resolvedBasePath;
        return {
          ...p,
          rootIndex: index,
          basePath,
          name: interpolate(p.name || folderName || path.basename(basePath), interpolateObject),
          description: typeof p.description === 'string' ? interpolate(p.description, interpolateObject) : undefined,
          tooltip: p.tooltip,
          include: getFormattedPatternPaths(([] as string[]).concat(p.include || defaultInclude)),
          exclude: getFormattedPatternPaths(([] as string[]).concat(p.exclude || defaultExclude)),
          tags: p.tags && p.tags.length > 0 ? [...new Set(p.tags)] : [NO_TAGS],
        };
      } catch (err) {
        log(`Something went wrong!: ${String(err)}`);
        return {} as NormalizedPaths;
      }
    });

    // filter only valid and exist baseFolders
    const filtered = normalized.filter((p) => !!p && p.basePath && path.isAbsolute(p.basePath) && fsx.existsSync(p.basePath) && !p.hidden);
    return filtered;
  }
}
