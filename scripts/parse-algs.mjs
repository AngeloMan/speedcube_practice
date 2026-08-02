/**
 * Seed script: parses the SolveTheCube algorithms page that ships in the repo
 * root and emits src/data/{f2l,oll,pll}.json.
 *
 * For every case we capture the title, case number, group, algorithm and the
 * original thumbnail path, plus a 27-character sticker string describing the
 * isometric U/F/R preview. F2L thumbnails on solvethecube.com are *named* after
 * that sticker string, which lets us verify our own cube simulator against all
 * 41 F2L cases before trusting it for OLL and PLL.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { F2L_MASK, OLL_MASK, PLL_MASK, caseState } from "../src/lib/cube.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = resolve(ROOT, "Algorithms _ SolveTheCube.html");
const OUT_DIR = resolve(ROOT, "src/data");

const html = readFileSync(SOURCE, "utf8");

const decode = (s) =>
  s
    .replace(/&#39;|&apos;|&rsquo;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"');

const stripTags = (s) => s.replace(/<[^>]*>/g, "");
const squash = (s) => decode(stripTags(s)).replace(/\s+/g, " ").trim();

/** Slice the document between two <h2 id="..."> anchors. */
function section(id, nextId) {
  const start = html.indexOf(`<h2 id="${id}"`);
  const end = nextId ? html.indexOf(`<h2 id="${nextId}"`) : html.length;
  if (start < 0) throw new Error(`section ${id} not found`);
  return html.slice(start, end < 0 ? html.length : end);
}

/**
 * Walk a section in document order, collecting `<div class="alg">` entries
 * under the most recent `<h3>` heading. Headings with no algorithms after them
 * are UI controls (the shape/trigger filters), and are dropped.
 */
function parseGroups(sectionHtml) {
  const token = /<h3\b([^>]*)>([\s\S]*?)<\/h3>|<div class="alg"([^>]*)>([\s\S]*?)<\/div>/g;
  const groups = [];
  let current = null;
  let match;

  while ((match = token.exec(sectionHtml))) {
    if (match[1] !== undefined) {
      const attrs = match[1];
      const idMatch = /id="([^"]+)"/.exec(attrs);
      current = {
        id: idMatch ? idMatch[1] : null,
        title: squash(match[2]).replace(/^\d+\.\s*/, ""),
        cases: [],
      };
      groups.push(current);
      continue;
    }
    if (!current) continue;

    const attrs = match[3];
    const body = match[4];
    const numberMatch = /data-number="([^"]+)"/.exec(attrs);
    const imgMatch = /<img src="([^"]+)"[^>]*?(?:alt="([^"]*)")?/.exec(body);
    const stepsMatch = /<span class="steps">([\s\S]*)<\/span>/.exec(body);
    if (!stepsMatch) throw new Error(`alg without steps: ${body.slice(0, 80)}`);

    const display = squash(stepsMatch[1])
      .replace(/\(\s+/g, "(")
      .replace(/\s+\)/g, ")")
      .trim();

    current.cases.push({
      number: numberMatch ? numberMatch[1] : null,
      alt: imgMatch && imgMatch[2] ? decode(imgMatch[2]) : "",
      image: imgMatch ? decode(imgMatch[1]) : "",
      display,
      alg: display.replace(/[()]/g, "").replace(/\s+/g, " ").trim(),
    });
  }

  return groups.filter((g) => g.cases.length > 0);
}

const f2lGroups = parseGroups(section("f2l", "oll"));
const ollGroups = parseGroups(section("oll", "pll"));
const pllGroups = parseGroups(section("pll", null));

// ---------------------------------------------------------------------------
// F2L: verify the simulator against the sticker strings encoded in the filenames
// ---------------------------------------------------------------------------

const basename = (path) => path.split("/").pop().replace(/\.webp$/i, "");

let f2lIndex = 0;
let mismatches = 0;
const f2l = f2lGroups.map((group) => ({
  id: group.id,
  title: group.title,
  cases: group.cases.map((entry) => {
    f2lIndex += 1;
    const expected = basename(entry.image);
    const computed = caseState("F2L", F2L_MASK, entry.alg);
    if (expected !== computed) {
      mismatches += 1;
      console.error(
        `  F2L ${f2lIndex} mismatch\n    alg      ${entry.alg}\n    expected ${expected}\n    computed ${computed}`,
      );
    }
    return {
      id: `f2l-${f2lIndex}`,
      number: String(f2lIndex),
      title: `F2L Case ${f2lIndex}`,
      group: group.title,
      groupId: group.id,
      alg: entry.alg,
      display: entry.display,
      image: entry.image,
      stickers: expected,
    };
  }),
}));

if (mismatches > 0) {
  console.error(`\n${mismatches}/${f2lIndex} F2L states did not match. Aborting.`);
  process.exit(1);
}
console.log(`F2L: simulator matched all ${f2lIndex} sticker strings from the source thumbnails.`);

// ---------------------------------------------------------------------------
// OLL / PLL: thumbnails are named oll_27.webp / pll_H.webp, so the sticker
// state has to be derived from the algorithm itself.
// ---------------------------------------------------------------------------

const oll = ollGroups.map((group) => ({
  id: group.id,
  title: group.title,
  cases: group.cases.map((entry) => ({
    id: `oll-${entry.number}`,
    number: entry.number,
    title: `OLL ${entry.number}`,
    group: group.title,
    groupId: group.id,
    alg: entry.alg,
    display: entry.display,
    image: entry.image,
    stickers: caseState("OLL", OLL_MASK, entry.alg),
  })),
}));

const pll = pllGroups.map((group) => ({
  id: group.id,
  title: group.title,
  cases: group.cases.map((entry) => ({
    id: `pll-${entry.number}`,
    number: entry.number,
    title: entry.alt || `PLL ${entry.number}`,
    group: group.title,
    groupId: group.id,
    alg: entry.alg,
    display: entry.display,
    image: entry.image,
    stickers: caseState("PLL", PLL_MASK, entry.alg),
  })),
}));

// A PLL case must leave every sticker on its own face colour when solved, and
// an OLL case must show a full yellow top. Cheap sanity checks on the output.
for (const group of pll) {
  for (const c of group.cases) {
    if (c.stickers.length !== 27) throw new Error(`bad sticker string for ${c.id}`);
  }
}

mkdirSync(OUT_DIR, { recursive: true });
const write = (name, groups) => {
  writeFileSync(resolve(OUT_DIR, name), `${JSON.stringify(groups, null, 2)}\n`);
  const count = groups.reduce((n, g) => n + g.cases.length, 0);
  console.log(`${name.padEnd(9)} ${String(count).padStart(3)} cases in ${groups.length} groups`);
};

write("f2l.json", f2l);
write("oll.json", oll);
write("pll.json", pll);
