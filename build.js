import fs from 'node:fs'
import { build } from 'esbuild'

/**
 * @see https://github.com/evanw/esbuild/issues/1921#issuecomment-1491470829
 */
const js = `\
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createRequire as topLevelCreateRequire } from 'module';
const require = topLevelCreateRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
`;

async function buildLambda() {
  fs.rmSync('dist', { recursive: true, force: true })

  build({
    entryPoints: ['src/lambda.ts'],
    bundle: true,
    minify: true,
    sourcemap: true,
    platform: 'node',
    format: 'esm',
    target: 'esnext',
    outdir: 'dist/lib',
    banner: { js },
    external: ['build/Debug/pty.node']
  })

  fs.mkdirSync('dist/lib/node_modules', { recursive: true })
  fs.cpSync('node_modules/@cdktf/node-pty-prebuilt-multiarch/prebuilds', 'dist/prebuilds', { recursive: true })
  fs.cpSync('node_modules/@cdktf/hcl2json/main.wasm.gz', 'dist/main.wasm.gz', { recursive: true })
  fs.cpSync('node_modules/jsii', 'dist/lib/node_modules/jsii', { recursive: true })
  fs.cpSync('node_modules/jsii-pacmak', 'dist/lib/node_modules/jsii-pacmak', { recursive: true })
}


buildLambda()
