# BunkMate Pro

Desktop attendance-tracking and prediction app for university students. Fully offline, local-first — all data lives in a SQLite file in the OS user-data directory.

## Stack

- **Shell**: Electron (chosen over Tauri — no Rust/Cargo toolchain was available in this environment; Electron ships with the existing Node toolchain and avoids Windows-side Rust/WebView2 setup risk for a build of this size)
- **Frontend**: React + TypeScript + Vite, bundled together with the Electron main/preload processes via `vite-plugin-electron`
- **UI**: Tailwind CSS v4 + hand-rolled shadcn/ui-style primitives (Radix + `class-variance-authority`), Recharts for analytics
- **DB**: SQLite via `better-sqlite3`, accessed only from the Electron main process (renderer talks to it over `contextBridge`/IPC)
- **ORM**: Drizzle ORM, schema in `src/db/schema.ts`, generated migrations in `electron/db/migrations`
- **State**: Zustand
- **Export**: `jspdf` / `jspdf-autotable`, `exceljs`, native CSV

## Scripts

- `npm run dev` — rebuild `better-sqlite3` for Electron's ABI, then launch Vite + Electron with HMR
- `npm run build` — typecheck (renderer, node config, and Electron main/preload) and produce production bundles
- `npm run package` — build and package a distributable via `electron-builder`
- `npm test` — rebuild `better-sqlite3` for the system Node ABI, then run Vitest
- `npm run db:generate` — generate a new Drizzle migration from `src/db/schema.ts`

## Native module ABI note

`better-sqlite3` is a native addon and must be compiled against whichever runtime loads it. Electron and the system Node.js use different ABIs, so:

- `predev`/`prepackage` rebuild it for Electron before running/packaging the app.
- `pretest` rebuilds it for plain Node before running Vitest.

Switching contexts (e.g. `npm test` right after `npm run dev`) triggers a rebuild automatically via these hooks.
