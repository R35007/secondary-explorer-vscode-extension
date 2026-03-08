import * as vscode from 'vscode';
import { FSItem } from '../FSItem';
import { Settings } from '../Settings';
import { getSelectedItems, log } from '../utils';

export function getToggleCommands(treeView: vscode.TreeView<FSItem>) {
  const toggleViewMode = async (item?: FSItem) => {
    try {
      log('Toggle view mode');
      const treeViewItem = item || getSelectedItems(treeView).at(-1);
      if (!treeViewItem) {
        log('No item selected');
        return;
      }

      if (treeViewItem.rootIndex < 0) {
        log('Not a root item');
        return;
      }

      Settings.updatePathConfig(treeViewItem.rootIndex, { viewAsList: !treeViewItem.viewAsList });
      vscode.window.setStatusBarMessage(`View mode set to ${!treeViewItem.viewAsList ? 'List' : 'Tree'}`, 1500);
      log(`View mode changed to ${!treeViewItem.viewAsList ? 'List' : 'Tree'} for: ${treeViewItem.basePath}`);
    } catch (err) {
      log(`Failed to toggle view mode: ${String(err)}`);
    }
  };

  const toggleEmptyDirectories = async (item?: FSItem) => {
    try {
      log('Toggle empty directories');
      const treeViewItem = item || getSelectedItems(treeView).at(-1);
      if (!treeViewItem) {
        log('No item selected');
        return;
      }

      if (treeViewItem.rootIndex < 0) {
        log('Not a root item');
        return;
      }

      Settings.updatePathConfig(treeViewItem.rootIndex, { showEmptyDirectories: !treeViewItem.showEmptyDirectories });
      vscode.window.setStatusBarMessage(`Empty directories ${!treeViewItem.showEmptyDirectories ? 'hidden' : 'shown'}`, 1500);
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
