import * as fsx from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { FSItem } from '../models/FSItem';

const secondaryExplorerOutputChannel = vscode.window.createOutputChannel('SecondaryExplorer');

export function log(logString: string) {
  secondaryExplorerOutputChannel.appendLine(logString);
}

export function getSeparators() {
  const config = vscode.workspace.getConfiguration('explorer');
  const copyPathSeparator: string = config.get<string>('copyPathSeparator') || path.sep;
  const copyRelativePathSeparator: string = config.get<string>('copyRelativePathSeparator') || path.sep;
  return {
    copyPathSeparator: copyPathSeparator === 'auto' ? path.sep : copyPathSeparator,
    copyRelativePathSeparator: copyRelativePathSeparator === 'auto' ? path.sep : copyRelativePathSeparator,
  };
}

function splitNameExt(filename: string) {
  const ext = path.extname(filename);
  const name = ext ? filename.slice(0, -ext.length) : filename;
  return { name, ext };
}

export async function exists(p: string): Promise<boolean> {
  try {
    await fsx.access(p);
    return true;
  } catch {
    return false;
  }
}

export function normalizePath(input: string): string {
  return decodeURIComponent(input)
    .replace(/[\\/]+/g, getSeparators().copyPathSeparator)
    .replace('file:' + getSeparators().copyPathSeparator, '')
    .replace('file:' + path.sep, '')
    .trim();
}

export function resolveVariables(input: string, hasWorkspaceSetting?: boolean): string {
  const normInput = normalizePath(input);
  const interpolateObject = getInterpolateObject();
  const home = normalizePath(interpolateObject.userHome);
  const lowInput = normInput.toLowerCase();

  if (hasWorkspaceSetting) {
    const targets = [
      ...interpolateObject.workspaceFolders.map((p, i) => ({
        path: normalizePath(p),
        key: `\${workspaceFolders[${i}]}`,
      })),
      { path: home, key: '${userHome}' },
    ].sort((a, b) => b.path.length - a.path.length);

    const match = targets.find((t) => t.path && lowInput.startsWith(t.path.toLowerCase()));
    return match ? normInput.replace(new RegExp(match.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), match.key) : normInput;
  }

  return home && lowInput.startsWith(home.toLowerCase())
    ? normInput.replace(new RegExp(home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '${userHome}')
    : normInput;
}

// Helps to convert template literal strings to applied values.
export const interpolate = (format: string, object: object): string => {
  try {
    const keys = Object.keys(object);
    const values = Object.values(object);
    return new Function(...keys, `return \`${format}\`;`)(...values);
  } catch (error) {
    log(`Interpolate failed for format "${format}" with object ${JSON.stringify(object)}: ${String(error)}`);
    return format;
  }
};

/**
 * Resolves a promise and returns [value, error].
 * On resolve: Promise<[T, undefined]>
 * On error: Promise<[undefined, Error]>
 */
export async function safePromise<T>(promise: Promise<T>): Promise<[T, undefined] | [undefined, Error]> {
  try {
    const value = await promise;
    return [value, undefined];
  } catch (error) {
    return [undefined, error instanceof Error ? error : new Error(String(error))];
  }
}

export const getFormattedPatternPaths = (paths: string[]) =>
  paths.filter(Boolean).map((item) => {
    if (item.startsWith('**/')) return item.replace(/\\/g, '/');
    return `**/${item.replace(/\\/g, '/')}`;
  });

export function getSelectedItems(treeView: vscode.TreeView<FSItem>) {
  // Helper to filter unique items by fullPath
  function uniqueByFullPath(items: readonly FSItem[]): FSItem[] {
    const seen = new Set<string>();
    return items.filter((item) => {
      if (seen.has(item.basePath.replace(/\\/g, '/').toLowerCase())) return false;
      seen.add(item.basePath.replace(/\\/g, '/').toLowerCase());
      return true;
    });
  }

  // If nothing passed, use selection
  if (treeView.selection && treeView.selection.length > 0) return uniqueByFullPath(treeView.selection).filter((s) => !!s);
  return [];
}

export function setContext(key: string, value: any) {
  return vscode.commands.executeCommand('setContext', key, value);
}

export async function getUniqueDestPath(rootPath: string, baseName: string): Promise<string> {
  let destPath = path.join(rootPath, baseName);
  let fileIdx = 1;
  while (await exists(destPath)) {
    const { name, ext } = splitNameExt(baseName);
    destPath = path.join(rootPath, `${name}_${fileIdx}${ext}`);
    fileIdx++;
  }
  return destPath;
}

export function getWorkspaceFolderIndex(fsPath: string): number | undefined {
  const uri = vscode.Uri.file(fsPath);
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  if (!folder) return undefined; // Path is outside all workspace folders
  const index = vscode.workspace.workspaceFolders?.findIndex((f) => f.uri.toString() === folder.uri.toString());
  return index;
}

export function extractVariableAndValue(input: string): [string, string] {
  // Match ${variableName: value} followed by optional suffix
  const match = input.match(/\$\{([^:}]+):\s*([^}]*)\}([^\s]*)?/);
  if (!match) return [input, ''];

  const variable = `\${${match[1].trim()}}${match[3] || ''}`;
  const FolderName = match[2].trim();
  return [variable, FolderName];
}

export function getInterpolateObject() {
  const workspaceFolders = vscode.workspace.workspaceFolders || [];
  return {
    workspaceFolders: workspaceFolders?.map((wf) => normalizePath(wf.uri.fsPath)) || [],
    workspaceFolder: normalizePath(workspaceFolders[0]?.uri.fsPath || ''),
    workspaceFolderName: workspaceFolders[0]?.name || '',
    workspaceFolderBasename: path.basename(workspaceFolders[0]?.uri.fsPath || ''),
    userHome: normalizePath(process.env.HOME || process.env.USERPROFILE || ''),
  };
}

export async function getSettingSaveTarget() {
  const choice = await vscode.window.showInformationMessage(
    'Secondary Explorer Settings',
    {
      modal: true,
      detail: `Where should new settings be saved for this session?
              You won't be prompted again if the setting is already available in your workspace.`,
    },
    'User (Global)',
    'Workspace',
  );

  if (!choice) return;
  return choice === 'Workspace' ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
}
