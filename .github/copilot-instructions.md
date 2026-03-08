# Secondary Explorer – Copilot Instructions

## Project Overview

**Secondary Explorer** is a VS Code extension (TypeScript + Webpack) that adds a secondary file-explorer sidebar view for managing files and folders outside the default workspace explorer. Features include multi-folder support, tagging/grouping, drag-and-drop, cut/copy/paste/undo, glob filtering, file nesting, and path watching.

- Publisher: `Thinker` | Extension ID: `secondary-explorer`
- Targets VS Code `^1.109.0`, compiled to `dist/extension.js` via Webpack

---

## Build & Development Commands

```bash
# Compile once (webpack, mode=none)
npm run compile

# Watch mode (rebuilds on save) – preferred during development
npm run watch

# Production bundle (minified, hidden source map)
npm run package

# Watch TypeScript for tests
npm run watch-tests

# Lint
npm run lint

# Pre-publish (runs package)
npm run vscode:prepublish
```

> There are **no automated tests** — `pretest` compiles + lints only. Use the Extension Development Host (`F5`) for manual testing.

---

## Architecture

```
src/
  extension.ts            # Entry: activate(), deactivate(), wires everything together
  FSItem.ts               # TreeItem subclass — represents a file, folder, or tag node
  Settings.ts             # Static Settings class — reads/writes secondaryExplorer.* config
  constants.ts            # Shared constants (isWindows, NO_TAGS, defaultInclude/Exclude)
  registerPathWatchers.ts # vscode.FileSystemWatcher per configured root path
  commands/
    index.ts              # registerCommands() — maps all command IDs to handlers
    crud.ts               # File ops: open, create, rename, delete, cut/copy/paste, undo
    general.ts            # Add folder, remove/hide path, workspace operations
    reveal.ts             # Reveal in OS explorer, VS Code explorer, Secondary Explorer
    toggle.ts             # Toggle viewAsList, groupByTags, showEmptyDirs, etc.
  providers/
    TreeDataProvider.ts   # vscode.TreeDataProvider<FSItem> — builds the tree
    TreeDragAndDropController.ts  # Drag-and-drop within the view
  utils/
    index.ts              # log(), safePromise(), re-exports
    editor.ts             # Editor-related helpers
    parsing.ts            # interpolate() — variable substitution in paths
    path.ts               # normalizePath(), getUniqueDestPath(), etc.
```

### Key design patterns

- **`FSItem`** carries all display and operational state. Use `FSItem.getItem(normalizedPath)` to look up existing items by path.
- **`Settings`** is a static class. `Settings.parsedPaths` returns `NormalizedPaths[]` (resolved, validated). `Settings.paths` returns raw `UserPaths[]` from config.
- **`UndoAction`** is a discriminated union `{ type: 'move' | 'copy' | 'rename', ... }` stored in `undoState.action`.
- **Context keys** (`secondaryExplorer.hasSelection`, `hasConfiguredPaths`, `hasValidPaths`) drive view title icons and keybinding activation — always update via `setContext()` from `utils`.
- **`safePromise<T>`** wraps async calls to return `[value, undefined] | [undefined, Error]` — prefer this over bare try/catch.
- **Logging**: use `log(string)` (outputs to the _SecondaryExplorer_ output channel), never `console.log`.

---

## Conventions

- **Language**: TypeScript strict mode (`"strict": true`), target ES2022, module Node16.
- **File system**: use `fs-extra` (`fsx`) for all FS operations, not Node's `fs`.
- **Glob matching**: `fast-glob` for directory scanning; `micromatch` for pattern matching.
- **Trash**: deletes go through the `trash` npm package, not hard deletion.
- **Path normalization**: always pass paths through `normalizePath()` before comparing or storing.
- **Windows**: check `isWindows` for path separator logic; validate names against `windowsInvalidName` regex.
- **Config key prefix**: all VS Code settings use the `secondaryExplorer.` namespace.
- **Command ID prefix**: all commands use the `secondary-explorer.` namespace.

---

## Important Files to Know

| File                                                                      | Why it matters                                                  |
| ------------------------------------------------------------------------- | --------------------------------------------------------------- |
| [src/extension.ts](../src/extension.ts)                                   | Activation entry point; wires providers, commands, and watchers |
| [src/FSItem.ts](../src/FSItem.ts)                                         | Core data model for every tree node                             |
| [src/Settings.ts](../src/Settings.ts)                                     | All config read/write; `parsedPaths` is the source of truth     |
| [src/providers/TreeDataProvider.ts](../src/providers/TreeDataProvider.ts) | Tree rendering and refresh logic                                |
| [src/commands/crud.ts](../src/commands/crud.ts)                           | All destructive/mutating file operations                        |
| [package.json](../package.json)                                           | All `contributes` declarations (commands, menus, config schema) |

---

## Common Pitfalls

- **Never import `vscode` in a module that runs outside the extension host** — it's an external that doesn't exist at test time.
- **`Settings._sessionTarget`** is reset each VS Code window session; don't persist it to disk.
- **Path watchers** are recreated from scratch on every config change. The `cleanupRegistered` guard in `registerPathWatchers.ts` ensures only a single disposal entry is added to `context.subscriptions`.
- **`NO_TAGS` constant** (`'** no tags **'`) is a sentinel used to bucket untagged paths — don't use it as a real tag name.
- **Webpack bundles to a single `dist/extension.js`** — after editing source, run `npm run compile` or keep `npm run watch` running; the raw TS is never loaded directly.
