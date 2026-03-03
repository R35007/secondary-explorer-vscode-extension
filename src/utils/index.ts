import * as vscode from 'vscode';
export * from './editor';
export * from './parsing';
export * from './path';

const secondaryExplorerOutputChannel = vscode.window.createOutputChannel('SecondaryExplorer');

export function log(logString: string) {
  secondaryExplorerOutputChannel.appendLine(logString);
}

export async function safePromise<T>(promise: Promise<T>): Promise<[T, undefined] | [undefined, Error]> {
  try {
    const value = await promise;
    return [value, undefined];
  } catch (error) {
    return [undefined, error instanceof Error ? error : new Error(String(error))];
  }
}
