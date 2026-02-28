import * as fsx from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { FSItem } from '../models/FSItem';

const secondaryExplorerOutputChannel = vscode.window.createOutputChannel('SecondaryExplorer');

export function log(logString: string) {
  secondaryExplorerOutputChannel.appendLine(logString);
}

export function splitNameExt(filename: string) {
  const ext = path.extname(filename);
  const name = ext ? filename.slice(0, -ext.length) : filename;
  return { name, ext };
}

export async function existsAsync(p: string): Promise<boolean> {
  try {
    await fsx.access(p);
    return true;
  } catch {
    return false;
  }
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
    .replace(/[\\/]+/g, path.sep)
    .replace('file:' + path.sep, '')
    .trim();
}

export function replaceVariablePath(filePath: string, userHome: string, workspaceFolder?: string) {
  const normalizeDriveLetter = (path: string) => path.replace(/^([a-zA-Z]):/, (match, drive) => drive.toLowerCase() + ':');

  const normalizedFilePath = normalizePath(normalizeDriveLetter(filePath));
  const normalizedUserHome = normalizePath(normalizeDriveLetter(userHome));
  const normalizedWorkspaceFolder = workspaceFolder ? normalizePath(normalizeDriveLetter(workspaceFolder)) : '';

  if (normalizedWorkspaceFolder) {
    return normalizedFilePath.replace(normalizedWorkspaceFolder, '${workspaceFolder}').replace(normalizedUserHome, '${userHome}');
  }

  return normalizedFilePath.replace(normalizedUserHome, '${userHome}');
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
  while (await existsAsync(destPath)) {
    const { name, ext } = splitNameExt(baseName);
    destPath = path.join(rootPath, `${name}_${fileIdx}${ext}`);
    fileIdx++;
  }
  return destPath;
}
