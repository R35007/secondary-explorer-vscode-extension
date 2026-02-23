## <img src="images/logo.png" alt="Secondary Explorer Logo" width="32" /> Secondary Explorer

> Adds a secondary explorer view to manage files and folders, create, view, rename, delete, cut, copy, paste, and more—outside the default workspace explorer.

---

[![Buy Me a Coffee](https://r35007.github.io/Siva_Profile/images//buymeacoffee.png)](https://buymeacoffee.com/r35007)

## Preview

<img src="./images/preview.png" width="1000px">

---

## Features

- 📁 **Secondary Explorer View**: Manage files and folders in a dedicated sidebar.
- 🗂️ **Multi-Folder Support**: Display and organize multiple local folders.
- 🔀 **Tree/List Toggle**: Switch between hierarchical tree and flat list views.
- **File & Folder Operations**: Create, view, rename, delete files/folders.
- 🔎 **Pattern Filtering**: Filter files/folders per root using include/exclude glob patterns (e.g., show only Markdown files: `*.md`).
- ✂️ **Cut, Copy, Paste**: Move or duplicate files/folders.
- 🗂️ **Multi-Selection Support**: Supports Multi file or folder selection for Cut, Copy, Paste and Delete operations.
- 🗂️ **Reveal & Copy Path**: Reveal in File Explorer, copy absolute/relative paths.
- 🪟 **Open Folder in New Window**: Open any folder in a new VS Code window.
- 🖉 **Improved Rename**: Renaming a folder updates open editors.
- 🔄 **Quick Actions**: Refresh, open settings, and perform file operations.
- 🗑️ **Remove Folder**: Remove a configured root folder (does not delete from disk).
- 🧭 **Quick Add**: Add selection to Secondary Explorer from the default explorer/editor context menu.

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
2. If no folders are configured, click **Add Folder to Explorer** or use the command palette (`Ctrl+Shift+P`) and run `Secondary Explorer: Settings`.
3. Add local folder paths to display in the secondary explorer.

### File & Folder Operations

- **New File/Folder**: Use the toolbar or context menu to create file or folders.
- **Rename/Delete**: Right-click to renaming a file or folder.
- **Cut/Copy/Paste**: Use context menu or keyboard shortcuts to move or duplicate files/folders.
- **Reveal in File Explorer**: Right-click to reveal any file/folder in your OS file explorer.
- **Copy Path/Relative Path**: Right-click to copy absolute or relative path to clipboard.
- **Open Folder in New Window**: Right-click any file or folder to open it in a new VS Code window.
- **Open In Integrated Terminal**: Right-click any file or folder to open it in a VS Code Integrated Terminal.
- **Open to the Side**: Right-click any file to open the file to the side.
- **Open File**: Click or Enter to open files.
- **Add Folder to Workspace**: Click or Enter to add the current folder to workspace.
- **Copy to Workspace root**: Click or Enter to copy the current file or folder to workspace root folder.

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

Configure folders to display via VS Code settings. Multi-root workspaces are supported—use `${workspaceFolder}` to target every root folder, or `${workspaceFolder:FolderName}` to target a specific one (matching either the workspace folder name or its basename). You can also use `${workspaceFolderName}`, and `${workspaceFolderBasename}` inside `name` values for dynamic labels.

```jsonc
// settings.json
"secondaryExplorer.paths": [
  "${workspaceFolder}/docs",
  "${workspaceFolder:Docs}/guides",

  "${userHome}/notes",
  "${userHome: Notes}/notes",

  "C:/path/to/folder",
  "C:/path/to/folder/file.txt",
  // Or rich objects with filtering and custom name
  {
    "basePath": "${workspaceFolder}",
    "name": "${workspaceFolderName} - Docs",
    "include": ["*.md", "*.txt"], // include: only file patterns
    "exclude": ["node_modules", "dist", "build", "out"] // exclude: file or folder patterns
  }
],
"secondaryExplorer.deleteBehavior": "recycleBin", // "alwaysAsk" or "recycleBin" or "permanent"
"secondaryExplorer.rootPathSortOrder": "default", // "default" or "filesFirst" or "foldersFirst" or "mixed"
"secondaryExplorer.itemsSortOrderPattern": [
  "*.instructions.md",
  "*.prompt.md",
  "*.agent.md",
  "*.chatmode.md"
],
```

Example configuration:

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
      "basePath": "${workspaceFolder}",
      "name": "${WorkspaceFolderName} Docs",
      "include": ["**/*.{md,markdown,txt,rtf,adoc,asciidoc,restructuredtext,org,html,htm,pdf,docx,odt}"],
      "exclude": ["node_modules", "dist", "build", "out", ".vscode-test"],
    },
    {
      "basePath": "${workspaceFolder}",
      "name": "Workspace Images",
      "include": ["**/*.{png,jpg,jpeg,gif,svg,webp,avif,bmp,tiff,ico,icns,heic,heif}"],
      "exclude": ["node_modules", "dist", "build", "out", ".vscode-test"],
    },
  ],
  "secondaryExplorer.deleteBehavior": "alwaysAsk",
  "secondaryExplorer.rootPathSortOrder": "foldersFirst",
  "secondaryExplorer.itemsSortOrderPattern": ["*.instructions.md", "*.prompt.md", "*.agent.md", "*.chatmode.md"],
}
```

**Include/Exclude Logic:**

- `exclude` always takes priority over `include`.
- `include` accepts only file patterns (e.g., `*.md`).
- `exclude` accepts both file and folder patterns (e.g., `node_modules`, `*.log`).
- For example: If you set `include: ["*.md"]` and `exclude: ["node_modules"]`, all Markdown files inside `node_modules` will be excluded from the tree view, even if they match the include pattern.

**Workspace-level configuration recommended.**

Notes:

- Paths can be absolute or relative (`.`, `..`, `sub/folder`). Relative entries are resolved against each workspace folder, and paths must exist on disk to render.
- Include/Exclude accept glob patterns; include is applied to files, and folders are expanded only if children match include.
- Variable interpolation is supported in string and object forms: ${workspaceFolder}, ${userHome}.

---

## Acknowledgements

Built by [Sivaraman](mailto:sendmsg2siva@gmail.com) — MIT License.

---

> **TIP**
> For more details, see the [CHANGELOG.md](CHANGELOG.md) and [LICENSE.md](LICENSE.md) files.
