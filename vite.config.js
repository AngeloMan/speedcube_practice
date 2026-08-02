import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/*
 * A note on the build options below.
 *
 * cubing.js runs its random-state scramble search in a Web Worker. Vite emits
 * that worker as an ES module which imports the `__vitePreload` helper from the
 * app's entry chunk — so parts of the main bundle are evaluated inside a worker,
 * where there is no `document`. Left alone this throws
 * `ReferenceError: document is not defined` on every scramble.
 *
 * Three things keep the worker clean, and all three are load bearing
 * (scripts/test-solve-mode.mjs fails if any one is removed):
 *   - `modulePreload: false` drops the polyfill IIFE that calls
 *     `document.createElement("link")` at the top of the entry chunk.
 *   - `cssCodeSplit: false` stops the stylesheet being listed as a dependency
 *     of the worker's dynamic import, which sends the helper looking for
 *     `document.head` to inject a <link> into.
 *   - `src/main.jsx` only mounts React when a `document` exists.
 */
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: false },
  // cubing.js ships its random-state solvers as code-split ES module workers.
  worker: { format: "es" },
  optimizeDeps: { exclude: ["cubing"] },
  build: {
    target: "es2022",
    modulePreload: false,
    cssCodeSplit: false,
  },
});
