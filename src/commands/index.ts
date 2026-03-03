import { log } from 'console';
import * as vscode from 'vscode';
import { FSItem } from '../FSItem';
import { TreeDataProvider } from '../providers/TreeDataProvider';
import { getCrudCommands } from './crud';
import { getGeneralCommands } from './general';
import { getRevealCommands } from './reveal';
import { getToggleCommands } from './toggle';

export function registerCommands(context: vscode.ExtensionContext, treeView: vscode.TreeView<FSItem>, provider: TreeDataProvider) {
  const commands = {
    ...getGeneralCommands(treeView, provider),
    ...getCrudCommands(treeView, provider),
    ...getRevealCommands(treeView, provider),
    ...getToggleCommands(treeView),
  };

  for (let [command, callback] of Object.entries(commands)) {
    context.subscriptions.push(vscode.commands.registerCommand(`secondary-explorer.${command}`, callback));
  }
  log('Commands registered');
}
