import * as path from 'path';
import * as vscode from 'vscode';
import { SecondaryExplorerProvider } from '../providers/SecondaryExplorerProvider';

export function registerPathWatchers(
  context: vscode.ExtensionContext,
  provider: SecondaryExplorerProvider,
  parsedPaths: { basePath: string }[],
) {
  // Iterate over all workspace folders
  vscode.workspace.workspaceFolders?.forEach((folder) => {
    parsedPaths.forEach((entry) => {
      // Resolve absolute path relative to workspace folder
      const absPath = path.isAbsolute(entry.basePath) ? entry.basePath : path.join(folder.uri.fsPath, entry.basePath);

      // Create a watcher scoped to this basePath
      const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(absPath, '**/*'));

      // Hook up events
      watcher.onDidCreate((uri) => {
        console.log('Created in', absPath, ':', uri.fsPath);
        provider.refresh();
      });

      watcher.onDidDelete((uri) => {
        console.log('Deleted in', absPath, ':', uri.fsPath);
        provider.refresh();
      });

      watcher.onDidChange((uri) => {
        console.log('Changed in', absPath, ':', uri.fsPath);
        provider.refresh();
      });

      // Ensure cleanup on deactivate
      context.subscriptions.push(watcher);
    });
  });
}
