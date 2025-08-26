<h1>
<img src="images/logo.png" alt="Secondary Explorer Logo" width="32" /> 
<span>Secondary Explorer</span>
</h1>

> Adds a secondary explorer view to manage files and folders, create, view, rename, and delete outside the default workspace explorer.

---

<a href="https://buymeacoffee.com/r35007" target="_blank">
	<img src="https://r35007.github.io/Siva_Profile/images//buymeacoffee.png" alt="Buy Me a Coffee" height="50" />
</a>

## Preview

<img src="./images/preview.png" width="1000px">

---

## Features

- 📁 **Secondary Explorer View**: Manage files and folders in a dedicated sidebar, separate from the default workspace explorer.
- 🗂️ **Multi-Folder Support**: Configure multiple local folders to display and organize. Optionally show the root folder node when only one folder is configured.
- 📝 **File & Folder Operations**: Create, view, rename, delete, cut, copy, and paste files/folders directly from the secondary explorer.
- ✂️ **Cut, Copy, Paste**: Move or duplicate files/folders with context menu or keyboard shortcuts.
- 🗂️ **Reveal & Copy Path**: Reveal files/folders in File Explorer, copy absolute or relative paths.
- 🪟 **Open Folder in New Window**: Open any folder in a new VS Code window directly from the explorer.
- 🖉 **Improved Rename**: Renaming a folder updates open editors to the new path automatically.
- 🔄 **Quick Actions**: Refresh, open settings, and perform file operations with context menus and keybindings.
- 🗑️ **Remove Folder**: Remove a configured root folder from the secondary explorer (does not delete from disk).

---

## Getting Started

### Installation

1. Open the Extensions view in VS Code (`Ctrl+Shift+X`).
2. Search for `Secondary Explorer`.
3. Click **Install**.

### Activation

The extension activates automatically on startup and adds a new "Secondary Explorer" view to the sidebar.

---

## Usage

### Adding Folders

1. Click the **Secondary Explorer** icon in the sidebar.
2. If no folders are configured, click **Pick a Folder** or use the command palette (`Ctrl+Shift+P`) and run `Secondary Explorer: Settings`.
3. Add local folder paths to display in the secondary explorer.

### File & Folder Operations

- **New File/Folder**: Use the toolbar or context menu to create entries.
- **Rename/Delete**: Right-click or use the toolbar for quick actions. Renaming a folder updates open editors to the new path.
- **Cut/Copy/Paste**: Use context menu or keyboard shortcuts to move or duplicate files/folders.
- **Reveal in File Explorer**: Right-click to reveal any file/folder in your OS file explorer.
- **Copy Path/Relative Path**: Right-click to copy absolute or relative path to clipboard.
- **Open Folder in New Window**: Right-click any folder to open it in a new VS Code window.
- **Open File**: Double-click or use the context menu to open files.

### Keyboard Shortcuts

- `Delete`: Remove selected file or folder (when focused in Secondary Explorer).
- `Ctrl+X`: Cut selected file or folder
- `Ctrl+C`: Copy selected file or folder
- `Ctrl+V`: Paste into selected folder
- `F2`: Rename selected file or folder

---

## Configuration

You can configure folders to display via VS Code settings:

```jsonc
// settings.json
"secondaryExplorer.folders": [
  "C:/path/to/folder1",
  "C:/path/to/folder2"
],
"secondaryExplorer.showSingleRootFolder": false // Optional: show root folder node when only one folder is configured
```

- **Workspace-level configuration recommended.**

---

## Troubleshooting

> [!IMPORTANT]
> If the Secondary Explorer view does not appear, reload the VS Code window or check your folder configuration in settings.

- Ensure folder paths are valid and accessible.
- If you have only one folder configured, you can choose to show the root folder node or just its children via the `secondaryExplorer.showSingleRootFolder` setting.
- For issues, check the [Issues](https://github.com/R35007/secondary-explorer-vscode-extension/issues) page on GitHub.

---

## Acknowledgements

Built by [Sivaraman](mailto:sendmsg2siva@gmail.com) — MIT License.

---

> [!TIP]
> For more details, see the [CHANGELOG.md](CHANGELOG.md) and [LICENSE.md](LICENSE.md) files.
