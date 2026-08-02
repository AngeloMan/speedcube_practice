import "./index.css";

/*
 * Mounting is split out and guarded, because this entry chunk does not only run
 * on the page.
 *
 * Vite puts its `__vitePreload` helper in the entry chunk, and cubing.js's
 * random-state search worker imports that helper — so the entry chunk is
 * evaluated inside a Web Worker too. A worker has no DOM, so mounting from here
 * unguarded throws `document is not defined` on every scramble. Keeping the app
 * behind a guarded dynamic import means React is never even parsed in the
 * worker.
 */
if (typeof document !== "undefined") {
  import("./bootstrap.jsx");
}
