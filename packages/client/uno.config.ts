import { defineConfig } from 'unocss'
import { presetUno } from 'unocss/preset-uno'
import { presetIcons } from 'unocss/preset-icons'
import { FileSystemIconLoader } from '@iconify/utils/lib/loader/node-loaders'

export default defineConfig({
  presets: [
    presetUno(),
    presetIcons({
      collections: {
        'vercel': FileSystemIconLoader('./src/lib/icons')
      }
    })
  ]
})
