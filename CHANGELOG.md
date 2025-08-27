
# Change Log

All notable changes to the "secondary-explorer" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.


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
