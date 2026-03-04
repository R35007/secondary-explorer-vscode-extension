import * as vscode from 'vscode';
import { FSItem } from '../FSItem';
import { normalizePath } from './path';

export function getSelectedItems(treeView: vscode.TreeView<FSItem>) {
  // Helper to filter unique items by fullPath
  function uniqueByFullPath(items: readonly FSItem[]): FSItem[] {
    const seen = new Set<string>();
    return items.filter((item) => {
      if (seen.has(normalizePath(item.basePath).toLowerCase())) return false;
      seen.add(normalizePath(item.basePath).toLowerCase());
      return true;
    });
  }

  // If nothing passed, use selection
  if (treeView.selection && treeView.selection.length > 0) return uniqueByFullPath(treeView.selection).filter((s) => !!s);
  return [];
}
export function setContext(key: string, value: any) {
  return vscode.commands.executeCommand('setContext', key, value);
}
export function getWorkspaceFolderIndex(fsPath: string): number | undefined {
  const uri = vscode.Uri.file(fsPath);
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  if (!folder) return undefined; // Path is outside all workspace folders
  const index = vscode.workspace.workspaceFolders?.findIndex((f) => f.uri.toString() === folder.uri.toString());
  return index;
}
export async function getSettingSaveTarget() {
  const choice = await vscode.window.showInformationMessage(
    'Secondary Explorer Settings',
    {
      modal: true,
      detail: `Where should new settings be saved for this session?
              You won't be prompted again if the setting is already available in your workspace.`,
    },
    'User (Global)',
    'Workspace',
  );

  if (!choice) return;
  return choice === 'Workspace' ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
}

export async function pickTags(existingTags: string[], preSelectedTags: string[] = []): Promise<string[] | undefined> {
  const quickPick = vscode.window.createQuickPick();
  quickPick.canSelectMany = true;
  quickPick.ignoreFocusOut = true;
  quickPick.title = 'Manage Tags';
  quickPick.placeholder = 'Select tags or type to create a new one...';

  const updateItems = (filterValue: string = '') => {
    // 1. Track currently checked labels to preserve selection state
    const currentSelected = new Set(quickPick.selectedItems.map((i) => i.label));
    const normalizedFilter = filterValue.toLowerCase().trim();

    // 2. Build the full list (Always include all existing tags)
    const allItems: vscode.QuickPickItem[] = existingTags.map((label) => ({
      label,
      alwaysShow: true, // This is the secret property to bypass filtering
      picked: currentSelected.has(label),
    }));

    // 3. Add "New Tag" at the top if unique
    const tagExists = existingTags.some((t) => t.toLowerCase() === normalizedFilter);
    if (normalizedFilter && !tagExists) {
      allItems.unshift({
        label: filterValue.trim(),
        description: '(New Tag)',
        alwaysShow: true,
      });
    }

    quickPick.items = allItems;

    // 4. Force the selection state (including auto-checking the new input)
    quickPick.selectedItems = allItems.filter(
      (i) => currentSelected.has(i.label) || (i.label.toLowerCase() === normalizedFilter && i.description === '(New Tag)'),
    );
  };

  // Initial load
  const initialItems = existingTags.map((label) => ({ label, alwaysShow: true }));
  quickPick.items = initialItems;
  quickPick.selectedItems = initialItems.filter((i) => preSelectedTags.includes(i.label));

  quickPick.onDidChangeValue((value) => updateItems(value));

  return new Promise<string[] | undefined>((resolve) => {
    let resolved = false;

    quickPick.onDidAccept(() => {
      resolved = true;
      const selectedLabels = quickPick.selectedItems.map((item) => item.label);

      // Case-insensitive deduplication
      const uniqueMap = new Map<string, string>();
      selectedLabels.forEach((label) => {
        const key = label.toLowerCase();
        if (!uniqueMap.has(key)) uniqueMap.set(key, label);
      });

      resolve(Array.from(uniqueMap.values()));
      quickPick.hide();
    });

    quickPick.onDidHide(() => {
      if (!resolved) resolve(undefined);
      quickPick.dispose();
    });

    quickPick.show();
  });
}

export async function pickPaths(parsedPaths: any[], tags: string | string[]) {
  const tagList = Array.isArray(tags) ? tags : [tags];
  const displayTag = tagList.join(', ');

  const items = parsedPaths.map((p) => {
    const isObj = typeof p !== 'string';
    const pathTags = isObj ? p.tags || [] : [];

    // Check if ALL provided tags are already present in this path
    const hasAllTags = tagList.every((t) => pathTags.includes(t));

    return {
      label: p.name || 'Unnamed Path',
      description: p.basePath,
      detail: p.description || undefined,
      picked: hasAllTags,
      rootIndex: p.rootIndex,
    };
  });

  const selections = await vscode.window.showQuickPick(items, {
    canPickMany: true,
    title: `Assign Tag: ${displayTag}`,
    placeHolder: `Select paths to include these tags`,
  });

  return selections ? [...new Set(selections.map((s) => s.rootIndex))] : null;
}
