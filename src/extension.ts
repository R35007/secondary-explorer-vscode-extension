// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import * as fsx from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { registerCommands } from './commands/commands';
import { FSItem } from './models/FSItem';
import { SecondaryExplorerProvider } from './providers/SecondaryExplorerProvider';
import { Settings } from './utils/Settings';

export function activate(context: vscode.ExtensionContext) {
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
    if (Settings.paths.length === 1) {
      const stat = fsx.statSync(Settings.paths[0].basePath);
      if (stat.isDirectory()) {
        treeView.title = Settings.paths[0].name || path.basename(Settings.paths[0].basePath);
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

  // Restore context key logic for keybindings and view title icons
  vscode.commands.executeCommand('setContext', 'secondaryExplorerViewVisible', false);
  vscode.commands.executeCommand('setContext', 'secondaryExplorerSelectedIsRoot', false);
  vscode.commands.executeCommand('setContext', 'secondaryExplorerHasSelection', false);
  vscode.commands.executeCommand('setContext', 'secondaryExplorerRootViewAsList', false);
  vscode.commands.executeCommand('setContext', 'secondaryExplorerSelectedType', '');
  context.subscriptions.push(
    treeView.onDidChangeVisibility((e) => vscode.commands.executeCommand('setContext', 'secondaryExplorerViewVisible', e.visible)),
  );
  function updateSelectionContext(selection: readonly FSItem[]) {
    let selectedType = '';
    let isRoot = false;
    if (Array.isArray(selection) && selection.length > 0) {
      const roots = Settings.paths;
      isRoot = selection.some((item) => roots.some((ep) => ep.basePath === item.fullPath));
      // If all selected are folders, type is 'folder', if all are files, 'file', else ''
      const allFolders = selection.every((item) => item.type === 'folder');
      const allFiles = selection.every((item) => item.type === 'file');
      if (allFolders) selectedType = 'folder';
      else if (allFiles) selectedType = 'file';
    }
    vscode.commands.executeCommand('setContext', 'secondaryExplorerSelectedIsRoot', isRoot);
    vscode.commands.executeCommand('setContext', 'secondaryExplorerSelectedType', selectedType);
    vscode.commands.executeCommand('setContext', 'secondaryExplorerHasSelection', true);
  }

  context.subscriptions.push(
    treeView.onDidChangeSelection((e) => {
      updateSelectionContext(e.selection);
    }),
  );
}

export function deactivate() {}
