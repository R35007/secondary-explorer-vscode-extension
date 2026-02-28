// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import * as fsx from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { registerCommands } from './commands/commands';
import { SecondaryExplorerDragAndDrop } from './providers/SecondaryExplorerDargAndDropProvider';
import { SecondaryExplorerProvider } from './providers/SecondaryExplorerProvider';
import { registerPathWatchers } from './utils/registerPathWatchers';
import { Settings } from './utils/Settings';
import { log, setContext } from './utils/utils';

export function activate(context: vscode.ExtensionContext) {
  log('Activating Secondary Explorer extension…');

  // Restore context key logic for keybindings and view title icons
  setContext('secondaryExplorerHasSelection', false);
  setContext('secondaryExplorerRootViewAsList', Settings.viewAsList);
  setContext('secondaryExplorerShowEmptyDirectories', Settings.showEmptyDirectories);

  const provider = new SecondaryExplorerProvider();
  log('SecondaryExplorerProvider created');

  const treeView = vscode.window.createTreeView('secondaryExplorerView', {
    treeDataProvider: provider,
    showCollapseAll: true,
    canSelectMany: true,
    dragAndDropController: new SecondaryExplorerDragAndDrop(provider),
  });
  context.subscriptions.push(treeView);
  log('TreeView registered');

  registerCommands(context, provider, treeView);
  log('Commands registered');

  if (Settings.parsedPaths.length) {
    registerPathWatchers(context, provider, Settings.parsedPaths);
  }

  // Dynamically set view title if only one folder
  function updateViewTitle() {
    if (Settings.parsedPaths.length === 1) {
      const stat = fsx.statSync(Settings.parsedPaths[0].basePath);
      if (stat.isDirectory()) {
        treeView.description = Settings.parsedPaths[0].basePath;
        treeView.title = Settings.parsedPaths[0].name || path.basename(Settings.parsedPaths[0].basePath);
        return;
      }
    }
    treeView.title = 'Secondary Explorer';
  }

  updateViewTitle();
  vscode.workspace.onDidChangeConfiguration((e) => {
    if (
      e.affectsConfiguration('secondaryExplorer.paths') ||
      e.affectsConfiguration('secondaryExplorer.deleteBehavior') ||
      e.affectsConfiguration('secondaryExplorer.viewAsList') ||
      e.affectsConfiguration('secondaryExplorer.showEmptyDirectories') ||
      e.affectsConfiguration('secondaryExplorer.rootPathSortOrder') ||
      e.affectsConfiguration('secondaryExplorer.itemsSortOrderPattern')
    ) {
      log('Configuration changed!');
      provider.refresh();
    }
    if (e.affectsConfiguration('secondaryExplorer.paths')) {
      registerPathWatchers(context, provider, Settings.parsedPaths);
      updateViewTitle();
    }
  });

  context.subscriptions.push(treeView.onDidChangeSelection((e) => setContext('secondaryExplorerHasSelection', e.selection.length > 0)));
  log('Secondary Explorer extension activated successfully');
}

export function deactivate() {
  log('Secondary Explorer extension deactivated');
}
