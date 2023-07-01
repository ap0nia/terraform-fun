import fs from 'node:fs'
import path from 'node:path'
import { defu } from 'defu'
import archiver from 'archiver'

/**
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {import('./zip.d.ts').ZipOptions} options
 */
export async function zipFolder(inputPath, outputPath, options = {}) {
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

    archive.on("error", (err) => {
      reject(err);
    });

    archive.glob(directoryToZip + '/**/*.*', globOptions, options.data);

    archive.finalize();
  });

  const zipResult = await zipPromise

  return zipResult
}


const [input, output, unparsedOptions] = process.argv.slice(2)

let zipOptions = {}

try {
  zipOptions = JSON.parse(unparsedOptions ?? {})
} catch {
  // noop
}

zipFolder(input, output, zipOptions).catch((err) => {
  console.error(err);
  process.exit(1);
});
