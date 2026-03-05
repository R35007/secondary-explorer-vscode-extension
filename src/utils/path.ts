import * as fsx from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { log } from '.';

export function normalizePath(input: string): string {
  const separator = getSeparators().copyPathSeparator;
  // Escape the separator to handle backslashes safely in RegExp
  const escapedSeparator = separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    let normalized = decodeURIComponent(input)
      .replace(/[\\/]+/g, separator)
      // Use the escaped separator here
      .replace(new RegExp('file:' + escapedSeparator, 'g'), '')
      .trim();

    normalized = normalized.replace(/^([a-zA-Z]):/, (match, drive) => {
      return drive.toUpperCase() + ':';
    });

    return normalized;
  } catch (err) {
    try {
      return decodeURIComponent(input).replace(/[\\/]+/g, separator);
    } catch (err) {
      log(`Failed to normalizePath ${input}: ${String(err)}`);
      return '';
    }
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
export function splitNameExt(filename: string) {
  const ext = path.extname(filename);
  const name = ext ? filename.slice(0, -ext.length) : filename;
  return { name, ext };
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
