import initSqlJs from 'sql.js'
import type { SqlJsStatic } from 'sql.js'
// Vite turns this import into the URL of the wasm file, so it is copied into the build and cached.
// The package has a separate browser build, and its wasm file has a matching name.
import wasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url'

let loading: Promise<SqlJsStatic> | null = null

// Loads the SQL engine once and shares it. The wasm file is about 650 KB, so the game starts loading
// it at startup, and the first challenge usually finds it ready.
export function loadSql(): Promise<SqlJsStatic> {
  if (loading === null) {
    loading = initSqlJs({ locateFile: () => wasmUrl })
    // If loading fails (for example offline on the very first visit), allow a later retry.
    loading.catch(() => {
      loading = null
    })
  }
  return loading
}
