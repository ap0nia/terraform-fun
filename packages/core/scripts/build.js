import { build } from 'esbuild'

async function main() {
  build({
    entryPoints: ['src/lambda.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'esnext',
    outdir: 'dist',
    assetNames: "[name]",
    loader: {
      ".env": "copy",
    },
  })
}

main()
