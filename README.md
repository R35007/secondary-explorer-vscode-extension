## <img src="images/logo.png" alt="Secondary Explorer Logo" width="32" /> Secondary Explorer

> Adds a secondary explorer view to manage files and folders, create, view, rename, delete, cut, copy, paste, and more—outside the default workspace explorer.

---

[![Buy Me a Coffee](https://r35007.github.io/Siva_Profile/images//buymeacoffee.png)](https://buymeacoffee.com/r35007)

## Preview

<img src="./images/preview.jpg" width="1000px">

---

## Features

- 📁 **Secondary Explorer View**: Manage files and folders in a dedicated sidebar.
- 🗂️ **Multi-Folder Support**: Display and organize multiple local folders.
- ➡️ **Drag and Drop**: Easily move files and folders within the secondary explorer.
- 🔀 **Tree/List Toggle**: Switch between hierarchical tree and flat list views.
- 🗄️ **File & Folder Operations**: Create, view, rename, delete files/folders.
- 🔎 **Pattern Filtering**: Filter files/folders per root using include/exclude glob patterns (e.g., show only Markdown files: `*.md`).
- ✂️ **Cut, Copy, Paste**: Move or duplicate files/folders.
- 🗂️ **Multi-Selection Support**: Supports Multi file or folder selection for Cut, Copy, Paste and Delete operations.
- 🗂️ **Reveal & Copy Path**: Reveal in File Explorer, copy absolute/relative paths.
- 🪟 **Open Folder in New Window**: Open any folder in a new VS Code window.
- 🖉 **Improved Rename**: Renaming a folder updates open editors.
- 🔄 **Quick Actions**: Refresh, open settings, and perform file operations.
- 🗂️ **Copy to Workspace Root**: Copy folder from secondary explorer to workspace root folder
- 🗂️ **Add Folder to Workspace**: Add selected folder to workspace
- 🗑️ **Remove From Explorer**: Remove a configured root folder (does not delete from disk but removes from settings).
- 🙈 **Hide From Explorer**: Hide a configured root folder (does not remove from settings. Sets hidden to true).
- 🧭 **Quick Add**: Add selection to Secondary Explorer from the default explorer/editor context menu.

---

## Getting Started

### Installation

1. Open the Extensions view in VS Code (`Ctrl+Shift+X`).
2. Search for `Secondary Explorer`.
3. Click **Install**.

---

## Usage

### Adding Folders

1. Click the **Secondary Explorer** icon in the sidebar.
2. If no folders are configured, click **Add Folder to Explorer**
3. Add local folder paths to display in the secondary explorer.

### File & Folder Operations

- **New File/Folder**: Use the toolbar or context menu to create file or folders.
- **Rename/Delete**: Right-click to renaming a file or folder.
- **Cut/Copy/Paste**: Use context menu or keyboard shortcuts to move or duplicate files/folders.
- **Drag And Drop**: Drag files/folders to move them within the secondary explorer.
- **Reveal in File Explorer**: Right-click to reveal any file/folder in your OS file explorer.
- **Reveal in Explorer View**: Right-click to reveal any file/folder in vscode file explorer view.
- **Reveal in Secondary Explorer View**: Right-click to reveal any file/folder in secondary explorer view.
- **Copy Path/Relative Path**: Right-click to copy absolute or relative path to clipboard.
- **Open Folder in New Window**: Right-click any file or folder to open it in a new VS Code window.
- **Open In Integrated Terminal**: Right-click any file or folder to open it in a VS Code Integrated Terminal.
- **Open to the Side**: Right-click any file to open the file to the side.
- **Open File**: Click or Enter to open files.
- **Add Folder to Workspace**: Click or Enter to add the current folder to workspace.
- **Copy to Workspace root**: Click or Enter to copy the current file or folder to workspace root folder.
- **Move to Workspace root**: Click or Enter to move the current file or folder to workspace root folder.

### Keyboard Shortcuts

These are the following shortcut keys when focused in Secondary Explorer

- `Enter`: Open File.
- `Ctrl+N`: Create new FIle or Folder.
- `Delete`: Remove selected file or folder.
- `Ctrl+X`: Cut selected file or folder
- `Ctrl+C`: Copy selected file or folder
- `Ctrl+V`: Paste into selected folder
- `F2`: Rename selected file or folder

You can also toggle the view mode from the view title toolbar:

- View as List / View as Tree

---

## Configuration

You can configure which folders and files appear in the **Secondary Explorer** through VS Code settings. Multi-root workspaces are supported:

- Use `${workspaceFolder}` to target every root folder.
- Use `${workspaceFolder:FolderName}` to target a specific workspace folder with a custom name to show in the explorer. Eg: `${workspaceFolder:Docs}`.
- Use `${workspaceFolderName}` or `${workspaceFolderBasename}` inside `name` values for dynamic labels.
- Use `${userHome}` to reference the user’s home directory (recommended on macOS instead of `~`).

---

### Available Settings

```jsonc
{
  "secondaryExplorer.paths": [
    // Simple paths
    "${workspaceFolder}/docs",
    "${workspaceFolder:Docs}/guides",
    "${userHome}/notes",
    "C:/path/to/folder",
    "C:/path/to/folder/file.txt",

    // Rich object configuration
    {
      "basePath": "${workspaceFolder}", // supports variables like ${workspaceFolder}, ${userHome}
      "name": "${workspaceFolderName} - Docs", // dynamic labels
      "description": "${workspaceFolder}", // Shows only on the root item
      "tooltip": "Workspace Folder", // Shows only on the root item. By default shows the absolute path of the item
      "hidden": false, // hide this folder if true
      "showEmptyDirectories": false, // override global empty directory setting
      "viewAsList": true, // force list view for this path
      "sortOrderPattern": ["*.md", "*.txt"], // custom sorting pattern
      "include": ["*.md", "*.txt"], // include only matching file patterns
      "exclude": ["node_modules", "dist", "build", "out"], // exclude files or folders
    },
  ],

  "secondaryExplorer.deleteBehavior": "recycleBin", // "alwaysAsk" | "recycleBin" | "permanent"
  "secondaryExplorer.rootPathSortOrder": "default", // "default" | "filesFirst" | "foldersFirst" | "mixed"
  "secondaryExplorer.showEmptyDirectories": false, // global empty directory visibility
  "secondaryExplorer.viewAsList": false, // global list view mode
  "secondaryExplorer.itemsSortOrderPattern": ["*.instructions.md", "*.prompt.md", "*.agent.md", "*.chatmode.md", "SKILL.md"], // global sorting pattern
}
```

### Example configuration:

```jsonc
{
  "secondaryExplorer.paths": [
    {
      "basePath": "${workspaceFolder}",
      "name": "All Workspace Files",
      "include": ["**/*"],
      "exclude": ["node_modules", "dist", "build", "out", ".vscode-test"],
    },
    {
      "basePath": "${userHome}/repo",
      "name": "${workspaceFolderName} Docs",
      "description": "Documents"
      "tooltip": "Shows only markdown and text files"
      "include": ["**/*.{md,markdown,txt}"],
    },
    {
      "basePath": "${workspaceFolder}",
      "name": "Workspace Images",
      "include": ["**/*.{png,jpg,jpeg,gif,svg,webp,avif,bmp,tiff,ico,icns,heic,heif}"],
      "viewAsList": true,
      "sortOrderPattern": ["*.png", "*.jpg", "*.jpeg", "*.gif", "*.svg"],
    },
    {
      "basePath": "${workspaceFolder}",
      "name": "Workspace Tests",
      "showEmptyDirectories": false,
      "include": ["*.test.{js,ts,tsx,jsx}", "*.spec.{js,ts,tsx,jsx}"],
    },
  ],
  "secondaryExplorer.viewAsList": false,
  "secondaryExplorer.showEmptyDirectories": false,
  "secondaryExplorer.deleteBehavior": "recycleBin",
  "secondaryExplorer.rootPathSortOrder": "foldersFirst",
  "secondaryExplorer.itemsSortOrderPattern": ["*.instructions.md", "*.prompt.md", "*.agent.md", "*.chatmode.md", "SKILL.md"],
}
```

---

> [!NOTE]
>
> - `exclude` always takes priority over `include`. accepts both file and folder patterns (e.g., `node_modules`, `*.log`).
>   - By default, it excludes `["node_modules", "dist", "build", "out"]`. Set an empty list `[]` to include all of these in the tree.
> - `include` accepts only file patterns (e.g., `*.md`).
>   - By default , in includes `[**/*]` which means all files.
> - If you set `include: ["*.md"]` and `exclude: ["node_modules"]`, all Markdown files inside `node_modules` will be excluded from the tree view, even if they match the include pattern.

> [!WARNING] Limitations
>
> - Files and folders can be moved or dragged from the native VS Code explorer into the secondary explorer, or within the secondary explorer itself. Moving items from the secondary explorer back to the native explorer is not supported due to API restrictions.
> - Cut, copy, and paste operations between the secondary explorer and the native VS Code explorer are also not supported.
> - As a workaround, use the `Copy to Workspace Root` or `Move to Workspace Root` commands from the secondary explorer context menu to transfer items into the native VS Code workspace.

> [!TIP]  
> On macOS, it’s recommended to use the `${userHome}` variable to reference the home directory instead of `~`, due to API limitations.  
> For example:
>
> ```json
> {
>   "basePath": ["${userHome}/Documents"],
>   "include": ["*.md"]
> }
> ```
>
> This ensures paths resolve correctly, whereas using `~/Documents` may not work as expected.

---

<div align="center">

**Happy Coding! 🚀**

Made with ❤️ by [Sivaraman](https://github.com/R35007)

</div>
