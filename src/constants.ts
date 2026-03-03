import * as vscode from 'vscode';

export const isWindows = process.platform === 'win32';
export const windowsInvalidName = /[<>:"|?*]/;

export const NO_TAGS = '** no tags **';
export const workspaceFolders = vscode.workspace.workspaceFolders || [];
export const defaultInclude: string[] = ['*'];
export const defaultExclude: string[] = ['node_modules', 'dist', 'build', 'out'];
