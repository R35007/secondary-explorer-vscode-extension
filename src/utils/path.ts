import * as fsx from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';

export function normalizePath(input: string): string {
  const separator = getSeparators().copyPathSeparator;

  let normalized = decodeURIComponent(input)
    // 1. Unify all slashes/backslashes to your specific separator
    .replace(/[\\/]+/g, separator)
    // 2. Strip "file:" prefixes
    .replace(new RegExp('file:' + separator, 'g'), '')
    .trim();

  // 3. Drive Letter Logic: Match "a-z" followed by ":" at the start
  // The regex ^([a-zA-Z]): catches the drive letter
  normalized = normalized.replace(/^([a-zA-Z]):/, (match, drive) => {
    return drive.toUpperCase() + ':';
  });

  return normalized;
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
