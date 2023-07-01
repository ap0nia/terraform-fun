import fs from 'node:fs'
import path from 'node:path'
import { defu } from 'defu'
import archiver from 'archiver'

type Archiver = archiver.Archiver

type GlobOptions = Parameters<Archiver['glob']>[1]

export interface ZipOptions {
  /**
   * The glob API is fucking stupid. If it's not working properly, then figure it out :shrug:
   */
  glob?: GlobOptions

  data?: archiver.EntryData
}

const [
  input,
  output,
  options = {}
] = process.argv.slice(2) as [string, string, ZipOptions]

export async function zipFolder(inputPath: string, outputPath: string, options: ZipOptions = {}) {
  const absoluteInputPath = path.resolve(inputPath)
  const parentDirectory = path.dirname(path.dirname((absoluteInputPath)))
  const directoryToZip = path.relative(parentDirectory, absoluteInputPath)

  const globOptions = defu(options.glob, {
    cwd: parentDirectory
  })

  console.log({ directoryToZip, parentDirectory, options, globOptions })

  const output = fs.createWriteStream(outputPath);

  const zipPromise = new Promise((resolve, reject) => {
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Sets the compression level.
    });

    archive.pipe(output);

    archive.on('entry', (entry) => {
      console.log('entry: ', entry)
    })

    archive.on("close", () => {
      resolve(outputPath);
    });

    archive.on("error", (err: Error) => {
      reject(err);
    });

    archive.glob(directoryToZip + '/**/*.*', globOptions, options.data);

    archive.finalize();
  });

  const zipResult = await zipPromise

  return zipResult
}
