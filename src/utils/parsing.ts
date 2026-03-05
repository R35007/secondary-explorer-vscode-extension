import * as path from 'path';
import * as vscode from 'vscode';
import { normalizePath } from './path';

export function resolveVariables(input: string, hasWorkspaceSetting?: boolean, useAbsolutePath?: boolean): string {
  const normInput = normalizePath(input);
  const interpolateObject = getInterpolateObject();
  const home = normalizePath(interpolateObject.userHome);
  const lowInput = normInput.toLowerCase();

  if (useAbsolutePath) return normInput;

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
export const getFormattedPatternPaths = (paths: string[]) =>
  paths.filter(Boolean).map((item) => {
    if (item.startsWith('**/')) return item.replace(/\\/g, '/');
    return `**/${item.replace(/\\/g, '/')}`;
  });

export const interpolate = (format: string, object: object): string => {
  try {
    const keys = Object.keys(object);
    const values = Object.values(object);
    return new Function(...keys, `return \`${format}\`;`)(...values);
  } catch (error) {
    return format;
  }
};
