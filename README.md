## <img src="images/logo.png" alt="Secondary Explorer Logo" width="32" /> Secondary Explorer

Secondary Explorer adds a dedicated file browser to VS Code for folders and files that sit outside your main workspace flow. It gives you a clean second explorer for reference material, notes, assets, generated output, external repositories, and other paths you want nearby without cluttering the default Explorer.

[![Buy Me a Coffee](https://r35007.github.io/Siva_Profile/images//buymeacoffee.png)](https://buymeacoffee.com/r35007)

## Preview

<img src="https://raw.githubusercontent.com/R35007/Assets/refs/heads/main/Secondary_Explorer/preview_v14.jpg" width="1000" alt="Secondary Explorer preview">

## Features

- 📁 **Secondary Explorer View**: Manage folders and files in a dedicated sidebar outside the default Explorer.
- 🏷️ **Tagging, Grouping, and Custom Display**: Organize roots with tags, custom names, descriptions, tooltips, and icons.
- 🔀 **Flexible Views and Filtering**: Switch between tree and list modes, apply include and exclude patterns, and control empty-directory visibility.
- 🗄️ **File and Folder Operations**: Create, open, rename, delete, cut, copy, paste, drag and drop, and undo supported actions.
- 🗂️ **Workspace and Path Utilities**: Copy absolute or relative paths, reveal items, add folders to the workspace, and move or copy content to the workspace root.
- 🧩 **Native VS Code Integration**: Respects file nesting, delete confirmation, path separator preferences, and logs actions to the `SecondaryExplorer` output channel.

## What You Can Do

| Area            | Capabilities                                                                 |
| --------------- | ---------------------------------------------------------------------------- |
| Browsing        | Manage files and folders in a separate explorer view                         |
| Grouping        | Organize roots with tags and optional untagged behavior                      |
| Filtering       | Include only target file patterns and exclude noisy folders                  |
| Display         | Switch between list and tree views, apply custom labels and icons            |
| File operations | Create, rename, delete, cut, copy, paste, drag and drop, undo                |
| Navigation      | Open files, open to the side, reveal in Explorer views, open in terminal     |
| Workspace flow  | Add folders to the workspace, copy to workspace root, move to workspace root |
| Utilities       | Copy absolute path, copy relative path, inspect actions through output logs  |

## File and Folder Operations

Secondary Explorer supports the file tasks you need most without leaving the editor.

- Create files and folders, then open them normally or to the side.
- Rename, delete, cut, copy, paste, drag and drop, and undo supported changes.
- Open the integrated terminal at the selected location or open a folder in a new window.
- Reveal items in the OS file explorer, the native Explorer, or Secondary Explorer itself.
- Copy absolute or relative paths, add folders to the workspace, and copy or move content to the workspace root.

## Getting Started

### Install

1. Open the Extensions view in VS Code.
2. Search for `Secondary Explorer`.
3. Install the extension.
4. Open the `Secondary Explorer` view from the activity bar.

### Add your first path

You can start in any of these ways:

1. Use `Add File/Folder to Secondary Explorer...` from the view title.
2. Right-click a file or folder in the native Explorer and choose `Add to Secondary Explorer`.
3. Use the same `Add to Secondary Explorer` action from the editor title.

If no paths are configured yet, the view shows a welcome action so you can add one immediately.

## Keyboard Shortcuts

These shortcuts apply when the Secondary Explorer view is focused.

| Shortcut     | Action                            |
| ------------ | --------------------------------- |
| `Ctrl+N`     | Create a new file                 |
| `Ctrl+X`     | Cut selected item(s)              |
| `Ctrl+C`     | Copy selected item(s)             |
| `Ctrl+Alt+C` | Copy the absolute path            |
| `Ctrl+V`     | Paste into the selected target    |
| `F2`         | Rename the selected item          |
| `Delete`     | Delete the selected item          |
| `Ctrl+Z`     | Undo the last supported operation |

### Quick view actions

The view title also provides quick access to:

- create file
- create folder
- refresh the view
- add a file or folder
- group by tags
- switch between list and tree mode
- show or hide empty directories
- open settings

## Configuration

Secondary Explorer uses the `secondaryExplorer.*` settings namespace.

### Supported variables

- `${workspaceFolder}`: first workspace folder
- `${workspaceFolders[0]}`: workspace folder by index
- `${workspaceFolders[1]:Docs}`: workspace folder by index with a custom display label
- `${workspaceFolder:Docs}`: first workspace folder with a custom display label
- `${workspaceFolderName}`: current workspace folder name
- `${workspaceFolderBasename}`: current workspace folder base name
- `${userHome}`: user home directory

### Main settings

| Setting                                   | Description                                                                                    |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `secondaryExplorer.paths`                 | Defines the roots shown in the view. Each item can be a simple string path or a richer object. |
| `secondaryExplorer.useAbsolutePath`       | Adds paths as absolute values instead of workspace-relative variables when possible.           |
| `secondaryExplorer.deleteBehavior`        | Controls deletion with `alwaysAsk`, `recycleBin`, or `permanent`.                              |
| `secondaryExplorer.groupByTags`           | Groups configured roots into tag folders.                                                      |
| `secondaryExplorer.viewAsList`            | Shows items as a flat list instead of a tree.                                                  |
| `secondaryExplorer.showEmptyDirectories`  | Shows or hides empty directories globally.                                                     |
| `secondaryExplorer.showUntaggedAtRoot`    | Keeps untagged paths at the root instead of under a no-tags group.                             |
| `secondaryExplorer.addFoldersOnly`        | When adding a file, stores its parent folder instead.                                          |
| `secondaryExplorer.rootPathSortOrder`     | Sorts roots with `default`, `filesFirst`, `foldersFirst`, or `mixed`.                          |
| `secondaryExplorer.itemsSortOrderPattern` | Applies global pattern-based ordering to items.                                                |

### Path object properties

Use an object entry inside `secondaryExplorer.paths` when you want full control.

| Property               | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `basePath`             | Source path for the root                         |
| `name`                 | Display name shown in the view                   |
| `description`          | Optional description for the root                |
| `tooltip`              | Custom tooltip text                              |
| `icon`                 | ThemeIcon name or absolute path to an SVG or PNG |
| `include`              | File patterns to include                         |
| `exclude`              | File or folder patterns to exclude               |
| `tags`                 | Tags used for grouping                           |
| `hidden`               | Hides the root from the view                     |
| `showEmptyDirectories` | Per-root override for empty-directory visibility |
| `viewAsList`           | Per-root override for list mode                  |
| `sortOrderPattern`     | Per-root custom item order                       |

### Example configuration

```jsonc
{
  "secondaryExplorer.paths": [
    // Simple paths

    "${workspaceFolder",
    "${workspaceFolders[0]}/guides",
    "${workspaceFolders[0]:Docs}/docs",
    "${userHome}/workspace",
    "${userHome: Notes}/notes",
    "C:/path/to/folder",
    "C:/path/to/folder/file.txt",

    // Rich objects
    {
      "basePath": "${workspaceFolder}",
      "name": "All Workspace Files",
      "tags": ["Workspace"],
    },
    {
      "basePath": "${workspaceFolder}",
      "name": "Tests",
      "showEmptyDirectories": false,
      "include": ["*.test.{js,jsx,ts,tsx}", "*.spec.{js,jsx,ts,tsx}"],
      "tags": ["Tests"],
    },
    {
      "basePath": "${workspaceFolders[0]}",
      "name": "Project Docs",
      "description": "Documentation and guides",
      "icon": "book",
      "include": ["**/*.{md,markdown,txt}"],
      "exclude": ["node_modules", "dist", "build", "out"],
      "tags": ["Docs"],
    },
    {
      "basePath": "${workspaceFolders[1]}/images",
      "name": "Assets",
      "icon": "file-media",
      "viewAsList": true,
      "include": ["**/*.{png,jpg,jpeg,svg,webp,avif}"],
      "sortOrderPattern": ["*.svg", "*.png", "*.jpg"],
      "tags": ["Assets"],
    },
    {
      "basePath": "${userHome}/notes",
      "name": "Personal Notes",
      "tooltip": "Quick access outside the workspace",
      "showEmptyDirectories": false,
      "tags": ["Reference"],
    },
  ],
  "secondaryExplorer.groupByTags": true,
  "secondaryExplorer.viewAsList": false,
  "secondaryExplorer.showEmptyDirectories": false,
  "secondaryExplorer.deleteBehavior": "recycleBin",
  "secondaryExplorer.rootPathSortOrder": "foldersFirst",
  "secondaryExplorer.itemsSortOrderPattern": ["*.instructions.md", "*.prompt.md", "*.agent.md", "*.chatmode.md", "*.md"],
}
```

### Configuration notes

- `exclude` takes priority over `include`.
- By default, exclude rules cover `node_modules`, `dist`, `build`, and `out`.
- `include` applies to file patterns.
- If a file matches `include` but also matches `exclude`, it stays excluded.

## Notes and Limitations

- Moving items from the native VS Code Explorer into Secondary Explorer is supported.
- Moving items from Secondary Explorer back into the native Explorer is not supported because of VS Code API limitations.
- Cut, copy, and paste between the native Explorer and Secondary Explorer are not supported.
- Use `Copy to Workspace Root` or `Move to Workspace Root` when you need to bring content into the active workspace.
- On macOS, prefer `${userHome}` instead of `~` so paths resolve correctly.

## Output and Troubleshooting

Secondary Explorer logs operations to the `SecondaryExplorer` output channel. If a path does not appear, a command does not behave as expected, or a configuration entry resolves incorrectly, check that output channel first.

## Closing Summary

Secondary Explorer gives VS Code a polished second file browser for everything your main workspace should not have to carry. It combines flexible path management, tagging, filtering, file operations, workspace actions, and native editor integration in one focused view.

If you regularly work across documentation folders, notes, assets, generated files, or reference repositories, it keeps them visible and manageable without overloading the default Explorer.

---

<div align="center">

**Happy Coding! 🚀**

Made with ❤️ by [Sivaraman](https://github.com/R35007)

</div>
