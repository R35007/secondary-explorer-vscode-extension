// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import * as fsx from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { registerCommands } from './commands/commands';
import { SecondaryExplorerProvider } from './providers/SecondaryExplorerProvider';
import { Settings } from './utils/Settings';

export function activate(context: vscode.ExtensionContext) {
  // Restore context key logic for keybindings and view title icons
  vscode.commands.executeCommand('setContext', 'secondaryExplorerHasSelection', false);
  vscode.commands.executeCommand('setContext', 'secondaryExplorerRootViewAsList', false);

  const provider = new SecondaryExplorerProvider(context);
  const treeView = vscode.window.createTreeView('secondaryExplorerView', {
    treeDataProvider: provider,
    showCollapseAll: true,
    canSelectMany: true,
  });
  context.subscriptions.push(treeView);

  registerCommands(context, provider, treeView);

  // Dynamically set view title if only one folder
  function updateViewTitle() {
    if (Settings.parsedPaths.length === 1) {
      const stat = fsx.statSync(Settings.parsedPaths[0].basePath);
      if (stat.isDirectory()) {
        treeView.title = Settings.parsedPaths[0].name || path.basename(Settings.parsedPaths[0].basePath);
        return;
      }
    }
    treeView.title = 'Secondary Explorer';
  }
  updateViewTitle();
  vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('secondaryExplorer.paths')) {
      updateViewTitle();
    }
  });

  context.subscriptions.push(treeView.onDidChangeVisibility((e) => provider.refresh()));
  context.subscriptions.push(
    treeView.onDidChangeSelection((e) =>
      vscode.commands.executeCommand('setContext', 'secondaryExplorerHasSelection', e.selection.length > 0),
    ),
  );
}

export function deactivate() {}
