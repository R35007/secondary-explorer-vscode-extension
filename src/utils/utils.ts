import * as fs from 'fs-extra';
import * as path from 'path';

export function splitNameExt(filename: string) {
  const ext = path.extname(filename);
  const name = ext ? filename.slice(0, -ext.length) : filename;
  return { name, ext };
}

export async function existsAsync(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
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
export const interpolate = (object: object, format: string = '') => {
  try {
    const keys = Object.keys(object);
    const values = Object.values(object);
    return new Function(...keys, `return \`${format}\`;`)(...values);
  } catch (error) {
    console.log(error);
    return format;
  }
};
