/**
 * Render smoke test: every non-WebGL surface must produce markup without
 * throwing. Catches the geometry/lookup mistakes that only show up when a
 * component actually walks the data.
 */
import { build } from "vite";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// --- CSS regression guard ---------------------------------------------------
// cubing.js relies on `:host { display: grid }` to stretch its shadow wrapper,
// which carries `contain: size`. An author rule outranks `:host`, so setting
// `display` on the host collapses the wrapper to 0px and the cube disappears.
{
  const css = readFileSync(join(process.cwd(), "src/index.css"), "utf8");
  const block = css.match(/twisty-player\s*\{[^}]*\}/g) ?? [];
  for (const rule of block) {
    if (/(^|[^-])display\s*:/.test(rule)) {
      throw new Error(
        "src/index.css sets `display` on twisty-player. That overrides " +
          "`:host { display: grid }` and collapses the player to zero height.",
      );
    }
  }
  if (!block.some((rule) => /min-height/.test(rule))) {
    throw new Error("twisty-player needs a min-height; a 0px host is never rendered.");
  }
}

// A zero-height container means cubing.js never builds a scene at all, so the
// viewer must not be sized with a percentage height against an auto-height box.
{
  const modal = readFileSync(join(process.cwd(), "src/components/PracticeModal.jsx"), "utf8");
  if (!/absolute inset-0/.test(modal)) {
    throw new Error("PracticeModal must position the viewer with absolute insets.");
  }
}

// Minimal browser shims for the persisted store.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, v),
  removeItem: (k) => store.delete(k),
};
globalThis.window = { location: { hash: "" }, addEventListener() {}, removeEventListener() {} };

// Emit inside the project so bare imports (react, react-dom) still resolve.
const dir = join(process.cwd(), "node_modules", ".speedcube-ssr");
mkdirSync(dir, { recursive: true });
const entry = join(dir, "entry.jsx");
writeFileSync(
  entry,
  `
  import { renderToString } from "react-dom/server";
  import CubeThumb from ${JSON.stringify(join(process.cwd(), "src/components/CubeThumb.jsx"))};
  import MoveDiagram from ${JSON.stringify(join(process.cwd(), "src/components/MoveDiagram.jsx"))};
  import CaseCard from ${JSON.stringify(join(process.cwd(), "src/components/CaseCard.jsx"))};
  import Sidebar from ${JSON.stringify(join(process.cwd(), "src/components/Sidebar.jsx"))};
  import NotationPage from ${JSON.stringify(join(process.cwd(), "src/pages/NotationPage.jsx"))};
  import SettingsPage from ${JSON.stringify(join(process.cwd(), "src/pages/SettingsPage.jsx"))};
  import AlgorithmsPage from ${JSON.stringify(join(process.cwd(), "src/pages/AlgorithmsPage.jsx"))};
  import f2l from ${JSON.stringify(join(process.cwd(), "src/data/f2l.json"))};
  import oll from ${JSON.stringify(join(process.cwd(), "src/data/oll.json"))};
  import pll from ${JSON.stringify(join(process.cwd(), "src/data/pll.json"))};
  export { renderToString, CubeThumb, MoveDiagram, CaseCard, Sidebar, NotationPage, SettingsPage, AlgorithmsPage, f2l, oll, pll };
  `,
);

const result = await build({
  logLevel: "error",
  build: {
    ssr: entry,
    outDir: dir,
    write: true,
    rollupOptions: { output: { entryFileNames: "bundle.mjs" } },
  },
  plugins: [(await import("@vitejs/plugin-react")).default()],
});
void result;

const mod = await import(`file://${join(dir, "bundle.mjs")}`);
const {
  renderToString,
  CubeThumb,
  MoveDiagram,
  CaseCard,
  Sidebar,
  NotationPage,
  SettingsPage,
  AlgorithmsPage,
  f2l,
  oll,
  pll,
} = mod;
const { createElement: h } = await import("react");

let rendered = 0;
const render = (label, element) => {
  const html = renderToString(element);
  if (!html || html.length < 20) throw new Error(`${label} rendered nothing`);
  rendered += 1;
  return html;
};

// Every case in the seed data must draw.
for (const groups of [f2l, oll, pll]) {
  for (const group of groups) {
    for (const item of group.cases) {
      if (item.stickers.length !== 27) throw new Error(`${item.id} has a bad sticker string`);
      const html = render(item.id, h(CubeThumb, { stickers: item.stickers }));
      // 27 stickers + 3 face backdrops = 30 polygons.
      const polygons = html.match(/<polygon/g)?.length ?? 0;
      if (polygons !== 30) throw new Error(`${item.id} drew ${polygons} polygons`);
      render(`${item.id} card`, h(CaseCard, { caseData: item, index: 1, onOpen() {} }));
    }
  }
}

// Every move diagram must find an arrow to draw.
for (const move of ["U", "D", "F", "B", "L", "R", "u", "d", "f", "b", "l", "r", "M", "E", "S", "x", "y", "z"]) {
  const html = render(`diagram ${move}`, h(MoveDiagram, { move }));
  if (!html.includes("<line")) throw new Error(`no arrow drawn for ${move}`);
}

render("sidebar", h(Sidebar, { category: "f2l", groups: f2l, activeGroup: "all", query: "", onCategoryChange() {}, onGroupChange() {}, onQueryChange() {} }));
render("notation page", h(NotationPage));
render("settings page", h(SettingsPage));
render("algorithms page", h(AlgorithmsPage));

console.log(`rendered ${rendered} components without error`);
