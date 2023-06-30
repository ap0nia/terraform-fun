import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  bundle: true,
  minify: true,
  sourcemap: true,
  platform: 'node',
  format: ['cjs', 'esm'],
  target: 'esnext',
  clean: true,
})
