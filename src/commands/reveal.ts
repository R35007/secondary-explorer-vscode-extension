import { log } from 'console';
import * as vscode from 'vscode';
import { FSItem } from '../FSItem';
import { TreeDataProvider } from '../providers/TreeDataProvider';
import { getSelectedItems } from '../utils';

export function getRevealCommands(treeView: vscode.TreeView<FSItem>, provider: TreeDataProvider) {
  const revealInExplorerView = async (item?: FSItem) => {
    try {
      const treeViewItem = item || getSelectedItems(treeView).at(-1);
      if (!treeViewItem) return;
      await vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(treeViewItem.basePath));
      await vscode.commands.executeCommand('workbench.view.explorer');
      log(`Revealed item in Explorer view: ${treeViewItem.basePath}`);
    } catch (err) {
      log(`Failed to reveal item in Explorer view: ${String(err)}`);
    }
  };

  const revealInSecondaryExplorer = async (uri: vscode.Uri) => {
    try {
      if (!uri) return;
      await vscode.commands.executeCommand('secondaryExplorerView.focus');
      const item = provider.findItemByUri(uri);

      if (!item) return;

      await treeView.reveal(item, { select: true, focus: true, expand: true });
      log(`Revealed item in Secondary Explorer: ${uri.fsPath}`);
    } catch (err) {
      log(`Failed to reveal item in Secondary Explorer: ${String(err)}`);
    }
  };

  const revealInFileExplorer = (item: FSItem) => {
    const treeViewItem = item || getSelectedItems(treeView).at(-1);
    if (!treeViewItem) return;
    const basePathUri = vscode.Uri.file(treeViewItem.basePath);
    vscode.commands.executeCommand('revealFileInOS', basePathUri);
  };

  const revealCommands = {
    revealInExplorerView,
    revealInSecondaryExplorer,
    revealInFileExplorer,
  };

  return revealCommands;
}
