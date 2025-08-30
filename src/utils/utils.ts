import * as fsx from 'fs-extra';
import * as micromatch from 'micromatch';
import * as path from 'path';

export function splitNameExt(filename: string) {
  const ext = path.extname(filename);
  const name = ext ? filename.slice(0, -ext.length) : filename;
  return { name, ext };
}

export async function existsAsync(p: string): Promise<boolean> {
  try {
    await fsx.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function exists(p: string): Promise<boolean> {
  try {
    await fsx.access(p);
    return true;
  } catch {
    return false;
  }
}

export function sanitizeRelative(input: string): string {
  return input.replace(/[\\/]+/g, path.sep).trim();
}

export function isSubpath(base: string, target: string): boolean {
  const rel = path.relative(path.resolve(base), path.resolve(target));
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

// Helps to convert template literal strings to applied values.
export const interpolate = (format: string, object: object) => {
  try {
    const keys = Object.keys(object);
    const values = Object.values(object);
    return new Function(...keys, `return \`${format}\`;`)(...values);
  } catch (error) {
    console.log(error);
    return format;
  }
};

/**
 * Resolves a promise and returns [value, error].
 * On resolve: Promise<[T, undefined]>
 * On error: Promise<[undefined, Error]>
 */
export async function safePromise<T>(promise: Promise<T>): Promise<[T, undefined] | [undefined, Error]> {
  try {
    const value = await promise;
    return [value, undefined];
  } catch (error) {
    return [undefined, error instanceof Error ? error : new Error(String(error))];
  }
}

export const getFormattedPatternPaths = (paths: string[]) => paths.filter(Boolean).map((item) => `**/${item.replace(/\\/g, '/')}`);

/**
 * Recursively checks if any nested file or folder matches the given patterns.
 * @param {string} folderPath - The root folder to start searching from.
 * @param {string[]} patterns - List of glob-like patterns to match against.
 * @returns {Promise<boolean>} - True if any child matches, false otherwise.
 */
export async function hasMatchingChild(folderPath: string, patterns: string[] = ['**/*']): Promise<boolean> {
  if (!(await fsx.pathExists(folderPath))) return false;

  const stack = [folderPath];

  while (stack.length > 0) {
    const currentPath = stack.pop() as string;
    const [entries, error] = await safePromise(fsx.promises.readdir(currentPath, { withFileTypes: true }));
    if (error) continue;

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(folderPath, fullPath);

      // return true if any file or folder matches the patterns
      if (micromatch.isMatch(relativePath, patterns)) return true;

      // If it's a directory, add to stack to check its children
      if (entry.isDirectory()) stack.push(fullPath);
    }
  }

  return false;
}
