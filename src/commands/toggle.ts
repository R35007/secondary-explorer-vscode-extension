import { log } from 'console';
import * as vscode from 'vscode';
import { FSItem } from '../FSItem';
import { Settings } from '../Settings';
import { getSelectedItems } from '../utils';

export function getToggleCommands(treeView: vscode.TreeView<FSItem>) {
  const toggleViewMode = async (item?: FSItem) => {
    try {
      const treeViewItem = item || getSelectedItems(treeView).at(-1);
      if (!treeViewItem) return;

      if (treeViewItem.rootIndex < 0) return;

      Settings.updatePathConfig(treeViewItem.rootIndex, { viewAsList: !treeViewItem.viewAsList });
      vscode.window.setStatusBarMessage('Path set to hidden from Secondary Explorer', 1500);
      log(`View mode changed to ${!treeViewItem.viewAsList ? 'List' : 'Tree'} for: ${treeViewItem.basePath}`);
    } catch (err) {
      log(`Failed to toggle view mode: ${String(err)}`);
    }
  };

  const toggleEmptyDirectories = async (item?: FSItem) => {
    try {
      const treeViewItem = item || getSelectedItems(treeView).at(-1);
      if (!treeViewItem) return;

      if (treeViewItem.rootIndex < 0) return;

      Settings.updatePathConfig(treeViewItem.rootIndex, { showEmptyDirectories: !treeViewItem.showEmptyDirectories });
      vscode.window.setStatusBarMessage('Path set to hidden from Secondary Explorer', 1500);
      log(`${!treeViewItem.showEmptyDirectories ? 'Hiding' : 'Showing'} empty directories for: ${treeViewItem.basePath}`);
    } catch (err) {
      log(`Failed to toggle empty directory visibility: ${String(err)}`);
    }
  };

  const toggleCommands = {
    viewAsList: () => (Settings.viewAsList = true),
    viewAsTree: () => (Settings.viewAsList = false),
    showEmptyDirectories: () => (Settings.showEmptyDirectories = true),
    hideEmptyDirectories: () => (Settings.showEmptyDirectories = false),
    groupByTags: () => (Settings.groupByTags = true),
    groupByNone: () => (Settings.groupByTags = false),
    toggleViewMode,
    toggleEmptyDirectories,
  };

  return toggleCommands;
}
