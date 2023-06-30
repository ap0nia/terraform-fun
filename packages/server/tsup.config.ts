import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  bundle: true,
  minify: true,
  platform: 'node',
  format: ['esm'],
  target: 'esnext',
  clean: true,
  shims: true,
  noExternal: [/.*/],
  esbuildOptions(options) {
    options.assetNames = "[name]"
  },
  loader: {
    ".env": "copy",
  },
})
