// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import * as vscode from 'vscode';
import { registerCommands } from './commands/commands';
import { FSItem } from './models/FSItem';
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

  // Dynamically set view title if only one folder
  function updateViewTitle() {
    const cfg = vscode.workspace.getConfiguration();
    const paths = cfg.get<string[]>('secondaryExplorer.paths') || [];
    if (paths.length === 1) {
      const fs = require('fs');
      const pathMod = require('path');
      try {
        const stat = fs.statSync(paths[0]);
        if (stat.isDirectory()) {
          treeView.title = pathMod.basename(paths[0]);
          return;
        }
      } catch {}
    }
    // Default title
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
  vscode.commands.executeCommand('setContext', 'secondaryExplorerSelectedType', '');
  context.subscriptions.push(
    treeView.onDidChangeVisibility((e) => vscode.commands.executeCommand('setContext', 'secondaryExplorerViewVisible', e.visible)),
  );
  function updateSelectionContext(selection: readonly FSItem[]) {
    let selectedType = '';
    let isRoot = false;
    if (Array.isArray(selection) && selection.length > 0) {
      const roots = provider.getRootPaths();
      isRoot = selection.some((item) => roots.includes(item.fullPath));
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
