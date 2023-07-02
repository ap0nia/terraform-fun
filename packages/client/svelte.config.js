import createAdapter from './src/lib/adapter/index.js'
import { vitePreprocess } from '@sveltejs/kit/vite'

/**
 * @type {import('@sveltejs/kit').Config}
 */
const config = {
  preprocess: [ vitePreprocess() ],
  kit: {
    adapter: createAdapter()
  }
}

export default config
