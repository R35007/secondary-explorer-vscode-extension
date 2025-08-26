# Change Log

All notable changes to the "secondary-explorer" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.


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
