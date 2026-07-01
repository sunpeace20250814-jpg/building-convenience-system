# V4 E2E Tests

Storage lifecycle and UI tests that run against the live `http://localhost:9527/` dev server.

## Prerequisites

1. **HTTP server running on :9527**
   - The V4 PowerShell HttpListener (`client/public/start-server.ps1`) must be listening.
   - Verify: `Test-NetConnection -ComputerName localhost -Port 9527`
2. **Playwright 1.61.0 in workspace `.pnpm` store**
   - Path: `<repo>/node_modules/.pnpm/playwright@1.61.0/node_modules/playwright/`
   - Loaded by absolute path via `createRequire` — no `pnpm install` in `client/` required.
3. **Chromium installed**
   - Path: `C:\Users\sunpe\AppData\Local\ms-playwright\chromium-1228`
   - Installed by previous `npx playwright install` runs — no extra setup.

## Tests

| Script | Purpose |
| --- | --- |
| `storage-lifecycle.test.mjs` | Select folder → reload → verify DB auto-restore (OPFS + IndexedDB handle persistence) |
| `dbstatus-visual.test.mjs` | DatabaseStatus header button — check overflow under long error text (run with `--mode before\|after`) |

## Run

```bash
# From repo root or client/
cd client

# Lifecycle (≈ 13s: 5s phase1 + 7s phase2 + setup/cleanup)
npm run test:e2e
# or directly
node tests/e2e/storage-lifecycle.test.mjs

# DBStatus UI overflow
npm run test:e2e:dbstatus
# or with mode flag
node tests/e2e/dbstatus-visual.test.mjs --mode before
```

## Lifecycle Test — What It Verifies

1. **Phase 1 — Initial folder selection**
   - Resets `v4-handle-db` IndexedDB + localStorage + OPFS subDir
   - Navigates to `http://localhost:9527/`, injects OPFS handle via `addInitScript`
   - Clicks 「選擇資料儲存資料夾」 button
   - Waits 5s, asserts:
     - `localStorage['v4-storage-backend'] === 'file-system'`
     - `document.querySelector('header')` exists
     - 0 page errors
2. **Phase 2 — Edge restart simulation**
   - `page.goto(APP_URL)` again (handle stays in IndexedDB)
   - Waits 7s, asserts same conditions (DB auto-restored from OPFS)

## Mock Strategy

`addInitScript` injects a **real OPFS `FileSystemDirectoryHandle`** as the `showDirectoryPicker` return value:

- **Why OPFS handle, not a mock object?** The adapter calls `saveHandle(handle)` which writes to IndexedDB. OPFS handles are structured-cloneable (can go through IndexedDB). A plain `{ ... }` object or `async function` would throw `DataCloneError`.
- **Why plain `function` (not `async function`)?** Wrapping the mock as an `async function` creates a function-object that can't be cloned. We return `Promise.resolve(handle)` from a regular function instead.
- **Why IIFE in `addInitScript`?** The mock needs `await navigator.storage.getDirectory()`, which can't run synchronously at the top of an init script.

## Cleanup

Both tests clean up after themselves:
- OPFS subDir: `root.removeEntry(name, { recursive: true })`
- IndexedDB: `indexedDB.deleteDatabase('v4-handle-db')`
- localStorage: `removeItem('v4-storage-backend'|'v4-lang')`

## Exit Codes

- `0` = PASS
- `1` = FAIL (assertion failed, exception thrown, or page errors > 0)