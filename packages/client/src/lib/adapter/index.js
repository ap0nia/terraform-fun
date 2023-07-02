import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { rollup } from 'rollup';
import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { createFilter, normalizePath } from '@rollup/pluginutils';

/** @param {string} path */
const resolve = (path) => fileURLToPath(new URL(path, import.meta.url));

/** @type {import('.').default} */
function createAdapter(opts = {}) {
  const { out = 'build', precompress, envPrefix = '', polyfill = true } = opts;

  /** @type {import('@sveltejs/kit').Adapter} */
  const adapter = {
    name: '@sveltejs/adapter-node',

    /** 
     * @param {import('@sveltejs/kit').Builder} builder
     */
    async adapt(builder) {
      // use an adjacent temporary directory so that any relative paths in eg. sourcemaps don't break
      const tmp = path.join(path.dirname(builder.getServerDirectory()), 'adapter-node');

      builder.rimraf(out);
      builder.rimraf(tmp);
      builder.mkdirp(tmp);

      builder.log.minor('Copying assets');
      builder.writeClient(`${out}/client${builder.config.kit.paths.base}`);
      builder.writePrerendered(`${out}/prerendered${builder.config.kit.paths.base}`);

      if (precompress) {
        builder.log.minor('Compressing assets');
        await Promise.all([
          builder.compress(`${out}/client`),
          builder.compress(`${out}/prerendered`)
        ]);
      }

      builder.log.minor('Building server');

      builder.writeServer(tmp);

      writeFileSync(
        `${tmp}/manifest.js`,
        `export const manifest = ${builder.generateManifest({ relativePath: './' })};\n\n` +
        `export const prerendered = new Set(${JSON.stringify(builder.prerendered.paths)});\n`
      );

      const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

      // we bundle the Vite output so that deployments only need
      // their production dependencies. Anything in devDependencies
      // will get included in the bundled code
      const bundle = await rollup({
        input: {
          handler: resolve('./handler.js'),
          index: resolve('./server.js')
        },
        external: [
          // dependencies could have deep exports, so we need a regex
          ...Object.keys(pkg.dependencies || {}).map((d) => new RegExp(`^${d}(\\/.*)?$`))
        ],
        plugins: [
          {
            name: 'adapter-node-resolve',
            resolveId(id) {
              switch (id) {
                case 'MANIFEST':
                  return `${tmp}/manifest.js`;
                case 'SERVER':
                  return `${tmp}/index.js`;
                case 'SHIMS':
                  return '\0virtual:SHIMS';
              }
            },
            load(id) {
              if (id === '\0virtual:SHIMS') {
                return polyfill
                  ? "import { installPolyfills } from '@sveltejs/kit/node/polyfills'; installPolyfills();"
                  : '';
              }
            },
            resolveImportMeta(property, { chunkId, moduleId }) {
              if (property === 'SERVER_DIR' && moduleId === resolve('./handler.js')) {
                const segments = chunkId.split('/').length - 1;

                return `new URL("${'../'.repeat(segments) || '.'}", import.meta.url)`;
              } else if (property === 'ENV_PREFIX' && moduleId === resolve('./env.js')) {
                return JSON.stringify(envPrefix);
              }
            }
          },
          nodeResolve({
            preferBuiltins: true,
            exportConditions: ['node']
          }),
          commonjs({ strictRequires: true }),
          json(),
          merge_sourcemap_plugin(tmp)
        ]
      });

      await bundle.write({
        dir: out,
        format: 'esm',
        sourcemap: true,
        chunkFileNames: 'server/chunks/[name]-[hash].js',
        // without this rollup will insert some imports to try speed up
        // module loading but it doesn't really affect anything on the server side
        hoistTransitiveImports: false
      });
    }
  };

  return adapter
}

/**
 * Load sourcemaps for files in the tmp directory so that the final ones
 * point to the original source files, instead of the generated files in outDir.
 * @param {string} tmp
 * @returns {import('rollup').Plugin}
 */
function merge_sourcemap_plugin(tmp) {
  const should_process_sourcemaps = createFilter(`${normalizePath(tmp)}/**/*.js`);

  return {
    name: 'adapter-node-sourcemap-loader',
    async load(id) {
      if (!should_process_sourcemaps(id)) return;
      if (!existsSync(`${id}.map`)) return;
      const [code, map] = await Promise.all([
        readFile(id, 'utf-8'),
        readFile(`${id}.map`, 'utf-8')
      ]);
      return { code, map };
    }
  };
}

export default createAdapter
