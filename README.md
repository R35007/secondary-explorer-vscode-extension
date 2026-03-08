## <img src="images/logo.png" alt="Secondary Explorer Logo" width="32" /> Secondary Explorer

> Adds a secondary explorer view to manage files and folders, create, view, rename, delete, cut, copy, paste, undo, and more—outside the default workspace explorer.

---

[![Buy Me a Coffee](https://r35007.github.io/Siva_Profile/images//buymeacoffee.png)](https://buymeacoffee.com/r35007)

## Preview

<img src="https://raw.githubusercontent.com/R35007/Assets/refs/heads/main/Secondary_Explorer/preview_v14.jpg" width="1000px">

---

## Features

- 📁 **Secondary Explorer View**: Manage files and folders in a dedicated sidebar.
- 🏷️ **Tagging & Grouping**: Assign custom tags to root paths and group your explorer view by categories for better organization.
- 🗂️ **Multi-Folder Support**: Display and organize multiple local folders.
- ➡️ **Drag and Drop**: Easily move files and folders within the secondary explorer.
- 🔀 **Tree/List Toggle**: Switch between hierarchical tree and flat list views at the path level.
- 🗄️ **File & Folder Operations**: Create, view, rename, delete files/folders.
- 🔎 **Pattern Filtering**: Filter files/folders per root using include/exclude glob patterns (e.g., show only Markdown files: `*.md`).
- ✂️ **Cut, Copy, Paste**: Move or duplicate files/folders.
- ↩️ **Undo**: Undo the last cut+paste, copy+paste, rename, or drag-and-drop move with `Ctrl+Z`.
- 🗂️ **File Nesting**: Respects VS Code's native `explorer.fileNesting.enabled` and `explorer.fileNesting.patterns` settings to nest related files under a parent.
- 🗑️ **Confirm Delete**: Respects the native `explorer.confirmDelete` setting.
- 🗂️ **Multi-Selection Support**: Supports Multi file or folder selection for Cut, Copy, Paste and Delete operations.
- 🗂️ **Reveal & Copy Path**: Reveal in File Explorer, copy absolute/relative paths. Respects the native `explorer.copyPathSeparator` and `explorer.copyRelativePathSeparator` settings.
- 🪟 **Open Folder in New Window**: Open any folder in a new VS Code window.
- 🖉 **Improved Rename**: Renaming a folder updates open editors.
- 🔄 **Quick Actions**: Refresh, open settings, and perform file operations.
- 🗂️ **Copy to Workspace Root**: Copy folder from secondary explorer to workspace root folder.
- 🗂️ **Add Folder to Workspace**: Add selected folder to workspace.
- 🗑️ **Remove From Explorer**: Remove a configured root folder (does not delete from disk but removes from settings).
- 🙈 **Hide From Explorer**: Hide a configured root folder (does not remove from settings. Sets hidden to true).
- 👻 **Hide Empty Directories**: Toggle visibility of empty folders to keep your view clean.
- 🧭 **Quick Add**: Add selection to Secondary Explorer from the default explorer/editor context menu.
- 📋 **Output Logs**: All operations are logged to the `SecondaryExplorer` output channel for easy debugging.

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

- **New File/Folder**: Create files or folders directly via the toolbar or context menu.
- **Rename/Delete**: Rename or delete files and folders through the right-click menu.
- **Cut/Copy/Paste**: Move or duplicate items using context menu actions or standard keyboard shortcuts.
- **Undo**: Press `Ctrl+Z` to revert the last move, copy+paste, or rename operation.
- **Drag and Drop**: Move files and folders effortlessly within the Secondary Explorer.
- **Reveal in File Explorer**: Open any file or folder in your OS file explorer.
- **Reveal in Explorer View**: Quickly locate any item within the default VS Code Explorer.
- **Reveal in Secondary Explorer**: Locate and focus any file or folder within the Secondary Explorer view.
- **Copy Path/Relative Path**: Copy absolute or relative paths to your clipboard with a single click. Respects the native `explorer.copyPathSeparator` and `explorer.copyRelativePathSeparator` settings.
- **Open Folder in New Window**: Launch any folder in a fresh VS Code window.
- **Open in Integrated Terminal**: Open the terminal at the specific path of any selected file or folder.
- **Open to the Side**: Open files in a side-by-side editor group.
- **Open File**: Click or press `Enter` to open files immediately.
- **Add Folder to Workspace**: Add the selected folder to your current VS Code workspace.
- **Copy to Workspace Root**: Copy a file or folder directly to the root of your workspace.
- **Move to Workspace Root**: Move a file or folder directly to the root of your workspace.

### Keyboard Shortcuts

These are the following shortcut keys when focused in Secondary Explorer

- `Enter`: Open File.
- `Ctrl+N`: Create new FIle or Folder.
- `Delete`: Remove selected file or folder.
- `Ctrl+X`: Cut selected file or folder
- `Ctrl+C`: Copy selected file or folder
- `Ctrl+V`: Paste into selected folder
- `Ctrl+Z`: Undo the last move, copy+paste, or rename
- `F2`: Rename selected file or folder

You can also toggle the view mode from the view title toolbar:

- View as List / View as Tree

---

## Configuration

You can configure which folders and files appear in the **Secondary Explorer** through VS Code settings. Multi-root workspaces are supported:

- Use `${workspaceFolder}` to target first workspace folder.
- Use `${workspaceFolders[<WorkspaceFolderIndex>]}` - Eg: `${workspaceFolders[1]}` - to target specific workspace folder using index.
- Use `${workspaceFolder:FolderName}` to target a specific workspace folder with a custom name to show in the explorer. Eg: `${workspaceFolder:Docs}`.
- Use `${workspaceFolderName}` or `${workspaceFolderBasename}` inside `name` values for dynamic labels.
- Use `${userHome}` to reference the user’s home directory (recommended on macOS instead of `~`).

---

### Available Settings

```jsonc
{
  "secondaryExplorer.paths": [
    // Simple paths
    "${workspaceFolders[0]}/docs",
    "${workspaceFolders[0]:Docs}/guides",
    "${userHome}/notes",
    "C:/path/to/folder",
    "C:/path/to/folder/file.txt",

    // Rich object configuration
    {
      "basePath": "${workspaceFolders[0]}", // supports variables like ${workspaceFolder}, ${workspaceFolders[1]} ${userHome}
      "name": "${workspaceFolderName} - Docs", // dynamic labels
      "description": "${workspaceFolder}", // Shows only on the root item
      "tooltip": "Workspace Folder", // Shows only on the root item. By default shows the absolute path of the item
      "hidden": false, // hide this folder if true
      "showEmptyDirectories": false, // override global empty directory setting
      "viewAsList": true, // force list view for this path
      "sortOrderPattern": ["*.md", "*.txt"], // custom sorting pattern
      "include": ["*.md", "*.txt"], // include only matching file patterns
      "exclude": ["node_modules", "dist", "build", "out"], // exclude files or folders
      "tags": ["Docs", "Tests"], // provide tags to group path items
    },
  ],

  "secondaryExplorer.deleteBehavior": "recycleBin", // "alwaysAsk" | "recycleBin" | "permanent"
  "secondaryExplorer.rootPathSortOrder": "default", // "default" | "filesFirst" | "foldersFirst" | "mixed"
  "secondaryExplorer.groupByTags": false, // group paths by tags
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
      "tags": ["Others"],
    },
    {
      "basePath": "${userHome}/repo",
      "name": "${workspaceFolderName} Docs",
      "description": "Documents",
      "tooltip": "Shows only markdown and text files",
      "include": ["**/*.{md,markdown,txt}"],
      "tags": ["Documents", "Markdowns", "Assets"],
    },
    {
      "basePath": "${workspaceFolders[0]}",
      "name": "Workspace Images",
      "include": ["**/*.{png,jpg,jpeg,gif,svg,webp,avif,bmp,tiff,ico,icns,heic,heif}"],
      "viewAsList": true,
      "sortOrderPattern": ["*.png", "*.jpg", "*.jpeg", "*.gif", "*.svg"],
      "tags": ["Assets", "Images"],
    },
    {
      "basePath": "${workspaceFolders[1]}",
      "name": "Workspace Tests",
      "showEmptyDirectories": false,
      "include": ["*.test.{js,ts,tsx,jsx}", "*.spec.{js,ts,tsx,jsx}"],
      "tags": ["Tests"],
    },
  ],
  "secondaryExplorer.groupByTags": true,
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
