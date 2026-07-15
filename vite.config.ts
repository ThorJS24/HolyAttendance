import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron/simple'
import path from 'node:path'
import fs from 'node:fs'

// The production main.cjs bundle is flattened into dist-electron/, so the
// SQL migration files (read from disk at runtime, not imported as modules)
// need to be copied alongside it — otherwise initDb()'s migrate() call is a
// silent no-op against a freshly created database.
function copyMigrationsPlugin(): Plugin {
  return {
    name: 'bunkmate:copy-migrations',
    closeBundle() {
      const src = path.resolve(__dirname, 'electron/db/migrations')
      const dest = path.resolve(__dirname, 'dist-electron/migrations')
      fs.cpSync(src, dest, { recursive: true })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          plugins: [copyMigrationsPlugin()],
          build: {
            outDir: 'dist-electron',
            lib: {
              entry: 'electron/main.ts',
              formats: ['cjs'],
              fileName: () => 'main.cjs',
            },
            rollupOptions: {
              external: ['better-sqlite3', 'electron'],
            },
            rolldownOptions: {
              external: ['better-sqlite3', 'electron'],
            },
          },
        },
      },
      preload: {
        input: 'electron/preload.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'],
              output: {
                format: 'cjs',
                entryFileNames: 'preload.cjs',
              },
            },
          },
        },
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
