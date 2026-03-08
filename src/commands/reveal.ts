import * as vscode from 'vscode';
import { FSItem } from '../FSItem';
import { TreeDataProvider } from '../providers/TreeDataProvider';
import { getSelectedItems, log } from '../utils';

export function getRevealCommands(treeView: vscode.TreeView<FSItem>, provider: TreeDataProvider) {
  const revealInExplorerView = async (item?: FSItem) => {
    try {
      log('Reveal in Explorer view');
      const treeViewItem = item || getSelectedItems(treeView).at(-1);
      if (!treeViewItem) {
        log('No item selected');
        return;
      }
      await vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(treeViewItem.basePath));
      await vscode.commands.executeCommand('workbench.view.explorer');
      log(`Revealed item in Explorer view: ${treeViewItem.basePath}`);
    } catch (err) {
      log(`Failed to reveal item in Explorer view: ${String(err)}`);
    }
  };

  const revealInSecondaryExplorer = async (uri: vscode.Uri) => {
    try {
      log('Reveal in Secondary Explorer');
      if (!uri) {
        log('No URI provided');
        return;
      }
      await vscode.commands.executeCommand('secondaryExplorerView.focus');
      const item = provider.findItemByUri(uri);

      if (!item) {
        log('Item not found in Secondary Explorer');
        return;
      }

      await treeView.reveal(item, { select: true, focus: true, expand: true });
      log(`Revealed item in Secondary Explorer: ${uri.fsPath}`);
    } catch (err) {
      log(`Failed to reveal item in Secondary Explorer: ${String(err)}`);
    }
  };

  const revealInFileExplorer = (item: FSItem) => {
    const treeViewItem = item || getSelectedItems(treeView).at(-1);
    if (!treeViewItem) {
      log('No item selected');
      return;
    }
    log('Reveal in file explorer');
    const basePathUri = vscode.Uri.file(treeViewItem.basePath);
    vscode.commands.executeCommand('revealFileInOS', basePathUri);
    log(`Revealed in file explorer: ${treeViewItem.basePath}`);
  };

  const revealCommands = {
    revealInExplorerView,
    revealInSecondaryExplorer,
    revealInFileExplorer,
  };

  return revealCommands;
}
