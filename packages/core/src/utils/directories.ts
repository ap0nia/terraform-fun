import fs from 'node:fs'
import path from 'node:path'

export function getDirectories(source: string) {
  return fs.existsSync(source)
    ? fs
      .readdirSync(source)
      .map((name) => path.join(source, name))
      .filter(source => fs.lstatSync(source).isDirectory())
    : [];
};


export function isFileReadable(filename: string): boolean {
  try {
    // The "throwIfNoEntry" is a performance optimization for cases where the file does not exist
    if (!fs.statSync(filename, { throwIfNoEntry: false })) {
      return false;
    }

    // Check if current process has read permission to the file
    fs.accessSync(filename, fs.constants.R_OK);

    return true;
  } catch {
    return false;
  }
}

// https://github.com/vitejs/vite/issues/2820#issuecomment-812495079
const ROOT_FILES = [
  // '.git',

  // https://pnpm.io/workspaces/
  "pnpm-workspace.yaml",

  // https://rushjs.io/pages/advanced/config_files/
  // 'rush.json',

  // https://nx.dev/latest/react/getting-started/nx-setup
  // 'workspace.json',
  // 'nx.json',

  // https://github.com/lerna/lerna#lernajson
  "lerna.json",
];

// npm: https://docs.npmjs.com/cli/v7/using-npm/workspaces#installing-workspaces
// yarn: https://classic.yarnpkg.com/en/docs/workspaces/#toc-how-to-use-it
export function hasWorkspacePackageJSON(root: string): boolean {
  const currentDirectoryPackageJson = path.join(root, "package.json");

  if (!isFileReadable(currentDirectoryPackageJson)) {
    return false;
  }

  const content = JSON.parse(fs.readFileSync(currentDirectoryPackageJson, "utf-8")) || {};
  return !!content.workspaces;
}

export function hasRootFile(root: string): boolean {
  return ROOT_FILES.some((file) => fs.existsSync(path.join(root, file)));
}

export function hasPackageJSON(root: string) {
  const currentDirectoryPackageJson = path.join(root, "package.json");
  return fs.existsSync(currentDirectoryPackageJson);
}

/**
 * Search up for the nearest `package.json`, i.e. the current project root.
 */
export function getProjectDirectory(current: string, root = current): string {
  if (hasPackageJSON(current)) return current;

  const currentDirectory = path.dirname(current);

  // reach the fs root
  if (!currentDirectory || currentDirectory === current) return root;

  return getProjectDirectory(currentDirectory, root);
}

/**
 * Search up for the nearest workspace root.
 */
export function getWorkspaceRoot(
  current: string,
  root = getProjectDirectory(current)
): string {
  if (hasRootFile(current)) return current;
  if (hasWorkspacePackageJSON(current)) return current;

  const currentDirectory = path.dirname(current);

  // reach the fs root
  if (!currentDirectory || currentDirectory === current) return root;

  return getWorkspaceRoot(currentDirectory, root);
}
