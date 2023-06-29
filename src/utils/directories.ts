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

