// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import * as vscode from 'vscode';
import { registerCommands } from './commands/commands';
import { SecondaryExplorerProvider } from './providers/SecondaryExplorerProvider';

export function activate(context: vscode.ExtensionContext) {
  const provider = new SecondaryExplorerProvider(context);
  const treeView = vscode.window.createTreeView('secondaryExplorerView', {
    treeDataProvider: provider,
    showCollapseAll: true,
    canSelectMany: true,
  });
  context.subscriptions.push(treeView);
  registerCommands(context, provider, treeView);

  // Restore context key logic for keybindings and view title icons
  vscode.commands.executeCommand('setContext', 'secondaryExplorerViewVisible', false);
  vscode.commands.executeCommand('setContext', 'secondaryExplorerHasSelection', false);
  context.subscriptions.push(
    treeView.onDidChangeVisibility((e) =>
      vscode.commands.executeCommand('setContext', 'secondaryExplorerViewVisible', e.visible)
    )
  );
  context.subscriptions.push(
    treeView.onDidChangeSelection((e) =>
      vscode.commands.executeCommand(
        'setContext',
        'secondaryExplorerHasSelection',
        (e.selection?.length ?? 0) > 0
      )
    )
  );
}

export function deactivate() {}
