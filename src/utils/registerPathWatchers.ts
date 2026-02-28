import * as vscode from 'vscode';
import { SecondaryExplorerProvider } from '../providers/SecondaryExplorerProvider';
import { log } from './utils';

let activeWatchers: vscode.FileSystemWatcher[] = [];

export function registerPathWatchers(
  context: vscode.ExtensionContext,
  provider: SecondaryExplorerProvider,
  parsedPaths: { basePath: string }[],
) {
  // Dispose existing watchers before creating new ones
  activeWatchers.forEach((w) => w.dispose());
  activeWatchers = [];

  parsedPaths.forEach((entry) => {
    const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(entry.basePath, '**/*'));

    watcher.onDidCreate(() => provider.refresh());
    watcher.onDidDelete(() => provider.refresh());
    watcher.onDidChange(() => provider.refresh());

    context.subscriptions.push(watcher);
    activeWatchers.push(watcher);
  });

  log('Path watchers registered (cleared old ones)');
}
