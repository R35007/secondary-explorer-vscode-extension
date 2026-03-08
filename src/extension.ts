// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import * as fsx from 'fs-extra';
import * as path from 'path';
import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { UndoAction } from './commands/crud';
import { TreeDataProvider, TreeDragAndDropController } from './providers';
import { registerPathWatchers } from './registerPathWatchers';
import { Settings } from './Settings';
import { log, setContext } from './utils';

export async function activate(context: vscode.ExtensionContext) {
  log('Activating Secondary Explorer extension…');

  // Restore context key logic for keybindings and view title icons
  await setContext('secondaryExplorer.hasSelection', false);
  await setContext('secondaryExplorer.hasConfiguredPaths', Settings.paths.length > 0);
  await setContext('secondaryExplorer.hasValidPaths', false);

  const provider = new TreeDataProvider();
  const undoState: { action: UndoAction | null } = { action: null };
  const treeView = vscode.window.createTreeView('secondaryExplorerView', {
    treeDataProvider: provider,
    showCollapseAll: true,
    canSelectMany: true,
    dragAndDropController: new TreeDragAndDropController(provider, undoState),
  });
  context.subscriptions.push(treeView);

  registerCommands(context, treeView, provider, undoState);

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
      e.affectsConfiguration('secondaryExplorer.groupByTags') ||
      e.affectsConfiguration('secondaryExplorer.viewAsList') ||
      e.affectsConfiguration('secondaryExplorer.showEmptyDirectories') ||
      e.affectsConfiguration('secondaryExplorer.showUntaggedAtRoot') ||
      e.affectsConfiguration('secondaryExplorer.addFoldersOnly') ||
      e.affectsConfiguration('secondaryExplorer.rootPathSortOrder') ||
      e.affectsConfiguration('secondaryExplorer.itemsSortOrderPattern')
    ) {
      log('Configuration changed, refreshing view');

      if (e.affectsConfiguration('secondaryExplorer.paths')) {
        provider.loadPaths();
        registerPathWatchers(context, provider, Settings.parsedPaths);
        updateViewTitle();
      }

      provider.refresh();
    }
  });

  context.subscriptions.push(treeView.onDidChangeSelection((e) => setContext('secondaryExplorer.hasSelection', e.selection.length > 0)));

  await setContext('secondaryExplorer.isActivated', true);
  log('Secondary Explorer extension activated successfully');
}

export function deactivate() {
  log('Secondary Explorer extension deactivated');
}
