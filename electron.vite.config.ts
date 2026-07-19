import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    },
    build: {
      // @ts-expect-error — electron-vite@5's bundled `vite` build-option types (peer
      // dependency drift vs. this repo's pinned vite@5.4) don't declare `outDir` here,
      // even though electron-vite's actual runtime reads and honors it. Build-tool
      // config only, never bundled into the app — not worth a dependency bump to silence.
      outDir: 'out/main',
      rollupOptions: {
        input: { index: resolve('src/main/index.ts') }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    },
    build: {
      // @ts-expect-error — see the `main` build's outDir comment above.
      outDir: 'out/preload',
      rollupOptions: {
        input: {
          index: resolve('src/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    publicDir: resolve('public'),
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve('src/renderer'),
        '@shared': resolve('src/shared')
      }
    },
    build: {
      // @ts-expect-error — see the `main` build's outDir comment above.
      outDir: 'out/renderer',
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          popup: resolve('src/renderer/popup.html')
        }
      }
    }
  }
})
