
# Change Log

All notable changes to the "secondary-explorer" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

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
