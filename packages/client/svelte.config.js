import { vitePreprocess } from '@sveltejs/kit/vite'
// import adapter from '@sveltejs/adapter-node'
// import adapter from '@ap0nia/sveltekit-adapter-node'
import adapter from '@ap0nia/sveltekit-adapter-lambda'

/**
 * @type {import('@sveltejs/kit').Config}
 */
const config = {
  preprocess: [ vitePreprocess() ],
  kit: {
    adapter: adapter()
  }
}

export default config
