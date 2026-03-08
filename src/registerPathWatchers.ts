import * as vscode from 'vscode';
import { TreeDataProvider } from './providers/TreeDataProvider';
import { log } from './utils';

let activeWatchers: vscode.FileSystemWatcher[] = [];
let cleanupRegistered = false;

export function registerPathWatchers(context: vscode.ExtensionContext, provider: TreeDataProvider, parsedPaths: { basePath: string }[]) {
  // Dispose existing watchers before creating new ones
  activeWatchers.forEach((w) => w.dispose());
  activeWatchers = [];

  // Register a single cleanup disposable once for the lifetime of the extension
  if (!cleanupRegistered) {
    context.subscriptions.push({ dispose: () => activeWatchers.forEach((w) => w.dispose()) });
    cleanupRegistered = true;
  }

  parsedPaths.forEach((entry) => {
    const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(entry.basePath, '**/*'));

    watcher.onDidCreate(() => provider.refresh());
    watcher.onDidDelete(() => provider.refresh());
    watcher.onDidChange(() => provider.refresh());

    activeWatchers.push(watcher);
  });

  log(`Path watchers registered for ${parsedPaths.length} path(s)`);
}
