# Change Log

All notable changes to the "secondary-explorer" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [9.0.1] - 2026-02-25

- Fixed Drag and drop to same folder shows progress. Now we wont show progress for drag and drop on same folder
- Fixed cache issue
- Added `hidden` prop to the `secondaryExplorer.paths` configuration. If true it hides the folder from tree.
- Added - `secondaryExplorer.showEmptyDirectories`. If `true` it shows the empty directories. Defaults to `false`

## [9.0.0] - 2026-02-25

- Added drag and drop feature. Now we can move files within folder and also able to move within editor to open the file
- Added cache handling for more performance

## [8.0.0] - 2026-02-23

- Added `secondaryExplorer.rootPathSortOrder`. Helps to sort root tree item by
  - `Default` - sorted by `secondaryExplorer.paths` order
  - `Files` - Files are shown before folders, all sorted alphabetically
  - `filesFirst` - Folders are shown before files, all sorted alphabetically
  - `mixed` - Mixed sorting order (folders and files mixed based on name, sorted alphabetically)
- Added `secondaryExplorer.itemsSortOrderPattern`. Helps to sort folder items by pattern
  - Defaults to `[ "*.instructions.md", "*.prompt.md", "*.agent.md", "*.chatmode.md" ]`
- Improved view title menus
- Changed Secondary Explorer view icon

## [7.0.0] - 2026-02-22

- Automatically refresh the secondary explorer tree when there is any modification in the path
- Allowed relative paths. The paths will be relative t the first workspace folder
- Added more variables. `${workspaceFolder}`, `${workspaceFolder: Folder Name}/notes`, `${workspaceFolderName}`, `${workspaceFolderBasename}`, `${userHome: Folder Name}/paths`
- persist clipboard path even after paste
- Fixed: Missing basePath defaults to workspace folder

## [6.0.0] - 2026-02-22

- Moved the `Add to Secondary Explorer` and `Add Folder to Workspace...` context menu to last in navigation group

## [6.0.0] - 2026-02-22

- Added `secondaryExplorer.deleteBehavior` command that decides how the delete works.
  - `alwaysAsk` - Always ask before deleting (show confirmation dialog).
  - `recycleBin` - Move to recycle bin without asking. (Default)
  - `permanent` - Permanently delete without asking.
- Added `Copy to Workspace Root` in secondary explorer context that helps us to copy the selected item into workspace root folder
- Removed `New File/Folder` from secondary explorer context
- Added `New File...` and `New Folder...` to secondary explorer context
- Added `Add Folder to Workspace...` command helps to add the selected folder to the current workspace.

## [5.0.3] - 2025-09-02

- Fixed issues with "Open File" as preview.
- Fixed issues with opening multiple files.
- Fixed issues with include and exclude patterns that returns a empty folder.
- Added `secondary-explorer.openToTheSide` command that helps to open the file in side.

## [5.0.2] - 2025-09-01

- Fixed issues with "Copy Relative Path" command
- Fixed bug when opening multiple selected files in the explorer
- Improved accessibility in explorer actions and menus
- Refined context menu logic for better keyboard and screen reader support
- Minor documentation and metadata updates

## [5.0.1] - 2025-08-31

- Improved clipboard logic for cut/copy/paste actions and context key updates
- Fixed error handling for file/folder creation, renaming, and deletion
- Enhanced keyboard navigation and focus management for explorer actions
- Improved progress bar logic for bulk operations (delete/paste)
- Reduced unnecessary refreshes for better performance
- Updated command registration for accessibility and reliability

## [5.0.0] - 2025-08-30

- New: List view mode with quick toggle between Tree and List (commands: View as List / View as Tree)
- New: Path groups support include/exclude glob patterns for filtering files shown in the explorer
- New: Variable interpolation in configuration (${workspaceFolder}, ${userHome}) for flexible path definitions
- Improvement: Robust path normalization and validation; only existing absolute paths are rendered
- Improvement: Dynamic view title when a single root is configured (uses configured name or folder name)
- New: "Add to Secondary Explorer" command in default explorer/editor to quickly add paths
- Internal: Settings refactor, fast-glob based list mode, and refined context keys/menus for view mode

## [4.0.0] - 2025-08-27

- Major refactor and feature update
- Changed configuration property to `secondaryExplorer.paths` (replaces `secondaryExplorer.folders`)
- Added new commands: Cut, Copy, Paste, Reveal in File Explorer, Copy Path, Copy Relative Path, Remove From Explorer, Open in Integrated Terminal, Add to Secondary Explorer
- Improved context key logic for menu and keybinding visibility
- Updated view/item/title context menus for all commands
- Improved keyboard shortcuts and accessibility for explorer actions
- Updated icon and view configuration in package.json
- Updated README.md and documentation for new configuration and features
- Various bug fixes and internal improvements

## [3.0.0] - 2025-08-26

- Added configuration option: `secondaryExplorer.showSingleRootFolder` to control root node display when only one folder is configured
- Refactored codebase: moved explorer item logic to `src/models/FSItem.ts`, provider logic to `src/providers/SecondaryExplorerProvider.ts`, and utility functions to `src/utils/`
- Improved accessibility and keyboard navigation in explorer view and context menus
- Added new command: Remove Folder (removes root folder from configuration)
- Improved context menu and keybinding logic for all commands
- Integrated Prettier and ESLint (Flat Config) for consistent formatting and linting
- Added `.prettierrc`, updated `eslint.config.mjs`, and new scripts for formatting/linting
- Updated build and test scripts for better developer experience

## [2.0.0] - 2025-08-25

- Added cut, copy, paste commands for files and folders (context menu & keyboard shortcuts)
- Added reveal in File Explorer, copy path, and copy relative path commands
- Added open folder in new window command
- Improved rename: open editors update to new folder path after rename
- Improved open file behavior and selection handling
- Updated context menus and keybindings for new commands

## [1.0.0] - 2025-08-24

- Initial release
- Added secondary file explorer with CRUD actions (create, view, rename, delete)
