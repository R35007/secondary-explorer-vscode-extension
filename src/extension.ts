// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

type EntryType = 'file' | 'folder' | 'root';

class FSItem extends vscode.TreeItem {
	fullPath: string;
	type: EntryType;
	constructor(label: string, fullPath: string, type: EntryType, useThemeIcons: boolean) {
		super(
			label,
			type === 'folder' || type === 'root' ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
		);
		this.fullPath = fullPath;
		this.type = type;
		this.contextValue = type === 'file' ? 'file' : type === 'folder' ? 'folder' : 'root';
		if (type === 'file') {
			// Open on single click
			this.command = { command: 'secondary-explorer.openFile', title: 'Open File', arguments: [this] };
			if (useThemeIcons) {
				this.resourceUri = vscode.Uri.file(fullPath); // let file icon theme pick icon
			} else {
				// Force product icon when no icon theme
				this.iconPath = new vscode.ThemeIcon('file');
			}
		} else if (type === 'folder' || type === 'root') {
			if (useThemeIcons) {
				// set resourceUri so icon themes can provide folder icons
				this.resourceUri = vscode.Uri.file(fullPath);
			} else {
				// Use product icons explicitly; distinct icon for root
				this.iconPath = new vscode.ThemeIcon(type === 'root' ? 'root-folder' : 'folder');
			}
		}
	}
}

class SecondaryExplorerProvider implements vscode.TreeDataProvider<FSItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<FSItem | undefined | void> = new vscode.EventEmitter<FSItem | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<FSItem | undefined | void> = this._onDidChangeTreeData.event;

	private folderRoots: string[] = [];
	private useThemeIcons = true;

	constructor(private context: vscode.ExtensionContext) {
		this.loadFolders();
		vscode.workspace.onDidChangeConfiguration(e => {
			if (
				e.affectsConfiguration('secondaryExplorer.folders') ||
				e.affectsConfiguration('workbench.iconTheme') ||
				e.affectsConfiguration('workbench.tree.renderIcons')
			) {
				this.loadFolders();
				this.refresh();
			}
		});
	}

	loadFolders() {
		const cfg = vscode.workspace.getConfiguration();
		const folders = cfg.get<string[]>('secondaryExplorer.folders') || [];
		// Only keep local absolute paths
		this.folderRoots = folders.filter(p => typeof p === 'string' && path.isAbsolute(p));

		// Determine whether a file icon theme is active and icons should render in trees
		const workbenchCfg = vscode.workspace.getConfiguration('workbench');
		const iconTheme = workbenchCfg.get<string | null>('iconTheme');
		const renderIcons = workbenchCfg.get<boolean>('tree.renderIcons', true);
		this.useThemeIcons = !!iconTheme && renderIcons;
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: FSItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
		return element;
	}

	private compareItems = (a: FSItem, b: FSItem) => {
		// Folder/root first, then files; then alphabetical case-insensitive
		const aIsDir = a.type === 'folder' || a.type === 'root';
		const bIsDir = b.type === 'folder' || b.type === 'root';
		if (aIsDir !== bIsDir) {
			return aIsDir ? -1 : 1;
		}
		const an = String(a.label).toLocaleLowerCase();
		const bn = String(b.label).toLocaleLowerCase();
		if (an < bn) { return -1; }
		if (an > bn) { return 1; }
		return 0;
	};

	async getChildren(element?: FSItem): Promise<FSItem[]> {
		if (!element) {
			// If exactly one root is configured, flatten it: show its children at the top level
			if (this.folderRoots.length === 1) {
				const base = this.folderRoots[0];
				try {
					const stat = await fs.promises.stat(base);
					if (stat.isDirectory()) {
						const names = await fs.promises.readdir(base);
						const items = await Promise.all(names.map(async n => {
							const p = path.join(base, n);
							try {
								const s = await fs.promises.stat(p);
								return new FSItem(n, p, s.isDirectory() ? 'folder' : 'file', this.useThemeIcons);
							} catch {
								return null;
							}
						}));
						return (items.filter(Boolean) as FSItem[]).sort(this.compareItems);
					}
					// Not a directory: show the single file
					return [new FSItem(path.basename(base) || base, base, 'file', this.useThemeIcons)];
				} catch {
					return [];
				}
			}
			// Multiple roots configured: show one node per configured folder
			return this.folderRoots
				.map(f => new FSItem(path.basename(f) || f, f, 'root', this.useThemeIcons))
				.sort(this.compareItems);
		}
		const full = element.fullPath;
		try {
			const stat = await fs.promises.stat(full);
			if (stat.isDirectory()) {
				const names = await fs.promises.readdir(full);
				const items = await Promise.all(names.map(async n => {
					const p = path.join(full, n);
					try {
						const s = await fs.promises.stat(p);
						return new FSItem(n, p, s.isDirectory() ? 'folder' : 'file', this.useThemeIcons);
					} catch (e) {
						return null;
					}
				}));
				return (items.filter(Boolean) as FSItem[]).sort(this.compareItems);
			}
			return [];
		} catch (e) {
			return [];
		}
	}
}

export function activate(context: vscode.ExtensionContext) {
	// Clipboard state for cut/copy/paste
	let clipboard: { type: 'cut' | 'copy'; items: FSItem[] } | null = null;

	// Cut command
	context.subscriptions.push(vscode.commands.registerCommand('secondary-explorer.cutEntry', async (item?: FSItem) => {
		const sel = getSelectedItem(item);
		if (!sel) { return; }
		clipboard = { type: 'cut', items: [sel] };
		vscode.window.setStatusBarMessage(`Cut: ${sel.label}`, 1500);
	}));

	// Copy command
	context.subscriptions.push(vscode.commands.registerCommand('secondary-explorer.copyEntry', async (item?: FSItem) => {
		const sel = getSelectedItem(item);
		if (!sel) { return; }
		clipboard = { type: 'copy', items: [sel] };
		vscode.window.setStatusBarMessage(`Copied: ${sel.label}`, 1500);
	}));

	// Paste command
	context.subscriptions.push(vscode.commands.registerCommand('secondary-explorer.pasteEntry', async (target?: FSItem) => {
		if (!clipboard || clipboard.items.length === 0) {
			vscode.window.setStatusBarMessage('Clipboard is empty', 1500);
			return;
		}
		const dest = getSelectedItem(target);
		if (!dest) { return; }
		let destPath = dest.fullPath;
		if (dest.type === 'file') {
			destPath = path.dirname(dest.fullPath);
		}
		for (const item of clipboard.items) {
			const baseName = path.basename(item.fullPath);
			const newPath = path.join(destPath, baseName);
			try {
				if (clipboard.type === 'copy') {
					// Copy file/folder
					await copyRecursive(item.fullPath, newPath);
				} else if (clipboard.type === 'cut') {
					await fs.promises.rename(item.fullPath, newPath);
				}
			} catch (e) {
				vscode.window.showErrorMessage(`Paste failed: ${String(e)}`);
			}
		}
		clipboard = null;
		provider.refresh();
	}));

	// Helper for recursive copy
	async function copyRecursive(src: string, dest: string) {
		const stat = await fs.promises.stat(src);
		if (stat.isDirectory()) {
			await fs.promises.mkdir(dest, { recursive: true });
			const entries = await fs.promises.readdir(src);
			for (const entry of entries) {
				await copyRecursive(path.join(src, entry), path.join(dest, entry));
			}
		} else {
			await fs.promises.copyFile(src, dest);
		}
	}

	// Reveal in File Explorer
	context.subscriptions.push(vscode.commands.registerCommand('secondary-explorer.revealInFileExplorer', async (item?: FSItem) => {
		const sel = getSelectedItem(item);
		if (!sel) { return; }
		await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(sel.fullPath));
	}));

	// Copy Path
	context.subscriptions.push(vscode.commands.registerCommand('secondary-explorer.copyPath', async (item?: FSItem) => {
		const sel = getSelectedItem(item);
		if (!sel) { return; }
		await vscode.env.clipboard.writeText(sel.fullPath);
		vscode.window.setStatusBarMessage('Path copied to clipboard', 1500);
	}));

	// Copy Relative Path
	context.subscriptions.push(vscode.commands.registerCommand('secondary-explorer.copyRelativePath', async (item?: FSItem) => {
		const sel = getSelectedItem(item);
		if (!sel) { return; }
		let relPath = sel.fullPath;
		// Try workspace folder first
		const workspaceFolders = vscode.workspace.workspaceFolders;
		let found = false;
		if (workspaceFolders && workspaceFolders.length > 0) {
			for (const folder of workspaceFolders) {
				const folderPath = folder.uri.fsPath;
				if (sel.fullPath.startsWith(folderPath + path.sep) || sel.fullPath === folderPath) {
					relPath = path.relative(folderPath, sel.fullPath);
					found = true;
					break;
				}
			}
		}
		// If not found, use secondary explorer root
		if (!found) {
			// Use the deepest matching root
			const roots = provider['folderRoots'] || [];
			let bestRoot = '';
			for (const root of roots) {
				if (sel.fullPath.startsWith(root + path.sep) || sel.fullPath === root) {
					if (root.length > bestRoot.length) {
						bestRoot = root;
					}
				}
			}
			if (bestRoot) {
				relPath = path.relative(bestRoot, sel.fullPath);
			}
		}
		await vscode.env.clipboard.writeText(relPath);
		vscode.window.setStatusBarMessage('Relative path copied to clipboard', 1500);
	}));
	// Command to pick a folder and set it in settings
	context.subscriptions.push(vscode.commands.registerCommand('secondary-explorer.pickFolder', async () => {
		const folders = await vscode.window.showOpenDialog({
			canSelectFolders: true,
			canSelectFiles: false,
			canSelectMany: false,
			openLabel: 'Select Folder'
		});
		if (folders && folders.length > 0) {
			const folderPath = folders[0].fsPath;
			const cfg = vscode.workspace.getConfiguration();
			await cfg.update('secondaryExplorer.folders', [folderPath], vscode.ConfigurationTarget.Global);
		}
	}));
	const provider = new SecondaryExplorerProvider(context);

	const treeView = vscode.window.createTreeView('secondaryExplorerView', { treeDataProvider: provider, showCollapseAll: true });
	context.subscriptions.push(treeView);

	// Context keys for keybindings
	vscode.commands.executeCommand('setContext', 'secondaryExplorerViewVisible', false);
	vscode.commands.executeCommand('setContext', 'secondaryExplorerHasSelection', false);
	context.subscriptions.push(treeView.onDidChangeVisibility(e => {
		vscode.commands.executeCommand('setContext', 'secondaryExplorerViewVisible', e.visible);
	}));
	context.subscriptions.push(treeView.onDidChangeSelection(e => {
		vscode.commands.executeCommand('setContext', 'secondaryExplorerHasSelection', (e.selection?.length ?? 0) > 0);
	}));

	// Helpers
	const pathSepRegex = /[\\/]/;
	const windowsInvalidName = /[<>:"|?*]/; // basic check, OS will still enforce
	const isWindows = process.platform === 'win32';

	function isSubpath(base: string, target: string): boolean {
		const rel = path.relative(path.resolve(base), path.resolve(target));
		return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
	}

	function sanitizeRelative(input: string): string {
		// Normalize slashes to platform separator
		return input.replace(/[\\/]+/g, path.sep).trim();
	}

	async function exists(p: string): Promise<boolean> {
		try { await fs.promises.access(p); return true; } catch { return false; }
	}

	function getSelectedItem(passed?: FSItem) {
		if (passed) { return passed; }
		if (treeView.selection && treeView.selection.length > 0) { return treeView.selection[0]; }
		return undefined;
	}

	context.subscriptions.push(vscode.commands.registerCommand('secondary-explorer.refresh', () => provider.refresh()));

	context.subscriptions.push(vscode.commands.registerCommand('secondary-explorer.openSettings', () => {
		vscode.commands.executeCommand('workbench.action.openSettings', 'secondaryExplorer.folders');
	}));

	context.subscriptions.push(vscode.commands.registerCommand('secondary-explorer.openFile', async (item: FSItem) => {
	// Always get selection if no argument
		let sel: FSItem | undefined = item;
		if (!sel) {
			sel = getSelectedItem();
		}
		if (!sel || sel.type !== 'file') {
			return;
		}
		const uri = vscode.Uri.file(sel.fullPath);
		await vscode.commands.executeCommand('vscode.open', uri, { preview: true, preserveFocus: true });
		try {
			await treeView.reveal(sel, { select: true, focus: true });
		} catch {}
	}));

	// Collapse all nodes in Secondary Explorer
	context.subscriptions.push(vscode.commands.registerCommand('secondary-explorer.collapseAll', async () => {
		await vscode.commands.executeCommand('workbench.actions.treeView.collapseAll', 'secondaryExplorerView');
	}));

	// Consolidated create command: if input has extension => file, else folder; supports nested paths
	context.subscriptions.push(vscode.commands.registerCommand('secondary-explorer.createEntry', async (parent?: FSItem) => {
		// Determine base path (folder to create within)
		const cfg = vscode.workspace.getConfiguration();
		const folders = cfg.get<string[]>('secondaryExplorer.folders') || [];
		if (folders.length === 0) {
			vscode.window.showErrorMessage('No secondary folders configured. Open settings to add one.');
			return;
		}
		let basePath = folders[0];
		const sel = getSelectedItem(parent);
		if (folders.length === 1) {
			// Single configured folder: create under selection if present, else at root
			if (sel) {
				basePath = sel.type === 'file' ? path.dirname(sel.fullPath) : sel.fullPath;
			} else {
				basePath = folders[0];
			}
		} else {
			// Multiple roots: if a selection exists, prefer it; otherwise default to first configured root
			if (sel) {
				basePath = sel.type === 'file' ? path.dirname(sel.fullPath) : sel.fullPath;
			}
		}

		// Compute a display path relative to the configured root (rootName/relative)
		const cfg2 = vscode.workspace.getConfiguration();
		const roots = (cfg2.get<string[]>('secondaryExplorer.folders') || []).map(r => path.resolve(r));
		const resolvedBase = path.resolve(basePath);
		let chosenRoot = roots.find(r => r === resolvedBase || (resolvedBase.startsWith(r + path.sep))) || roots[0] || resolvedBase;
		// Prefer the deepest matching root if multiple
		for (const r of roots) {
			if (resolvedBase === r || (resolvedBase.startsWith(r + path.sep))) {
				if (r.length > chosenRoot.length) { chosenRoot = r; }
			}
		}
		const relFromRoot = path.relative(chosenRoot, resolvedBase);
		const displayRel = relFromRoot ? relFromRoot.split(path.sep).join('/') : '';
		const displayBase = path.basename(chosenRoot) + (displayRel ? '/' + displayRel : '');

		const value = await vscode.window.showInputBox({
			prompt: `Create in ${displayBase}`,
			placeHolder: 'name or nested/path (folder) | nested/path/file.ext',
			validateInput: async (raw: string) => {
				const input = raw.trim();
				if (!input) { return 'Name is required'; }
				if (path.isAbsolute(input)) { return 'Provide a relative path, not absolute'; }
				const rel = sanitizeRelative(input);
				const leaf = path.basename(rel);
				if (isWindows && windowsInvalidName.test(leaf)) { return 'Name contains invalid characters'; }
				const target = path.resolve(basePath, rel);
				if (!isSubpath(basePath, target)) { return 'Path must be within the selected folder'; }
				if (await exists(target)) { return 'File or folder already exists'; }
				return undefined;
			}
		});
		if (!value) { return; }

		const rel = sanitizeRelative(value);
		const target = path.resolve(basePath, rel);
		try {
			const leaf = path.basename(rel);
			const hasExt = !!path.extname(leaf) || (leaf.startsWith('.') && leaf.length > 1); // treat dotfiles as files
			if (hasExt) {
				await fs.promises.mkdir(path.dirname(target), { recursive: true });
				await fs.promises.writeFile(target, '');
				provider.refresh();
				const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(target));
				await vscode.window.showTextDocument(doc);
			} else {
				await fs.promises.mkdir(target, { recursive: true });
				provider.refresh();
			}
		} catch (e) {
			vscode.window.showErrorMessage('Failed to create entry: ' + String(e));
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('secondary-explorer.deleteEntry', async (item?: FSItem) => {
		const sel = getSelectedItem(item);
		if (!sel) {
			vscode.window.showInformationMessage('No item selected to delete.');
			return;
		}
		if (sel.type === 'root') {
			vscode.window.showWarningMessage('Configured root folders cannot be deleted from disk here. Remove them in Settings instead.');
			return;
		}
		const confirmed = await vscode.window.showWarningMessage(`Delete ${sel.label}? This cannot be undone.`, { modal: true }, 'Delete');
		if (confirmed !== 'Delete') { return; }
		try {
			const stat = await fs.promises.stat(sel.fullPath);
			if (stat.isDirectory()) {
				await fs.promises.rm(sel.fullPath, { recursive: true, force: true });
			} else {
				await fs.promises.unlink(sel.fullPath);
			}
			provider.refresh();
		} catch (e) {
			vscode.window.showErrorMessage('Failed to delete: ' + String(e));
		}
	}));

	// Rename command with inline-like UX: preselect basename and validate
	context.subscriptions.push(vscode.commands.registerCommand('secondary-explorer.renameEntry', async (item?: FSItem) => {
		const sel = getSelectedItem(item);
		if (!sel) { return; }
		const oldLabel = String(sel.label);
		const ext = sel.type === 'file' ? path.extname(oldLabel) : '';
		const base = ext ? oldLabel.slice(0, -ext.length) : oldLabel;
		const input = await vscode.window.showInputBox({
			prompt: `Rename ${oldLabel}`,
			value: oldLabel,
			valueSelection: [0, base.length],
			validateInput: async (raw: string) => {
				const name = raw.trim();
				if (!name) { return 'Name is required'; }
				if (pathSepRegex.test(name)) { return 'Name must not contain path separators'; }
				if (isWindows && windowsInvalidName.test(name)) { return 'Name contains invalid characters'; }
				if (name === oldLabel) { return 'Name unchanged'; }
				const candidate = path.join(path.dirname(sel.fullPath), name);
				if (await exists(candidate)) { return 'A file or folder with that name already exists'; }
				return undefined;
			}
		});
		if (!input) { return; }
		const targetPath = path.join(path.dirname(sel.fullPath), input.trim());
		try {
			await fs.promises.rename(sel.fullPath, targetPath);
			provider.refresh();
			if (sel.type === 'file') {
				const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(targetPath));
				await vscode.window.showTextDocument(doc);
			} else if (sel.type === 'folder') {
				// Reopen any open files from the renamed folder at their new path
				const openEditors = vscode.window.visibleTextEditors;
				for (const editor of openEditors) {
					const docUri = editor.document.uri;
					if (docUri.scheme === 'file' && docUri.fsPath.startsWith(sel.fullPath + path.sep)) {
						// Compute new path
						const rel = path.relative(sel.fullPath, docUri.fsPath);
						const newFilePath = path.join(targetPath, rel);
						// Check if file exists at new path
						try {
							await fs.promises.access(newFilePath);
							const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(newFilePath));
							await vscode.window.showTextDocument(doc, editor.viewColumn);
						} catch {}
					}
				}
			}
		} catch (e) {
			vscode.window.showErrorMessage('Failed to rename: ' + String(e));
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('secondary-explorer.openFolderInNewWindow', async () => {
		let folderPath: string | undefined;
		const sel = treeView.selection && treeView.selection.length > 0 ? treeView.selection[0] : undefined;
		if (sel) {
			folderPath = sel.type === 'file' ? path.dirname(sel.fullPath) : sel.fullPath;
		} else {
			// No selection: check if only one folder is configured
			const cfg = vscode.workspace.getConfiguration();
			const folders = cfg.get<string[]>('secondaryExplorer.folders') || [];
			if (folders.length === 1) {
				folderPath = folders[0];
			} else {
				vscode.window.showInformationMessage('Please select a file or folder to open its folder in a new window.');
				return;
			}
		}
		await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(folderPath), { forceNewWindow: true });
	}));
}

export function deactivate() {}
