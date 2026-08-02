/**
 * Minimal, dependency-free 3x3x3 facelet simulator.
 *
 * Every facelet is modelled as a (position, normal) pair in a right-handed
 * frame with x = right (R), y = up (U), z = front (F). Moves are implemented as
 * geometric rotations of a layer, so face turns, slices, wide moves and whole
 * cube rotations all fall out of the same primitive with no lookup tables.
 *
 * Facelet indices follow the usual URFDLB layout (U 0-8, R 9-17, F 18-26,
 * D 27-35, L 36-44, B 45-53), each face read row-major:
 *   U with B at the top, D with F at the top, R/L/F/B with U at the top.
 */

export const FACE_ORDER = ["U", "R", "F", "D", "L", "B"];

const NORMALS = {
  U: [0, 1, 0],
  D: [0, -1, 0],
  R: [1, 0, 0],
  L: [-1, 0, 0],
  F: [0, 0, 1],
  B: [0, 0, -1],
};

// position of facelet (face, row, col) in cube coordinates
function faceletPosition(face, r, c) {
  switch (face) {
    case "U": return [c - 1, 1, r - 1];
    case "D": return [c - 1, -1, 1 - r];
    case "F": return [c - 1, 1 - r, 1];
    case "B": return [1 - c, 1 - r, -1];
    case "R": return [1, 1 - r, 1 - c];
    case "L": return [-1, 1 - r, c - 1];
    default: throw new Error(`bad face ${face}`);
  }
}

const KEY = (pos, normal) => `${pos.join(",")}|${normal.join(",")}`;

// index -> {pos, normal}, and the reverse lookup used after each rotation
export const FACELETS = [];
const LOOKUP = new Map();
for (let f = 0; f < FACE_ORDER.length; f++) {
  const face = FACE_ORDER[f];
  for (let i = 0; i < 9; i++) {
    const pos = faceletPosition(face, Math.floor(i / 3), i % 3);
    const normal = NORMALS[face];
    const index = f * 9 + i;
    FACELETS[index] = { pos, normal, face, index };
    LOOKUP.set(KEY(pos, normal), index);
  }
}

// Clockwise rotations about each positive axis, as seen from that axis.
const ROT = {
  x: ([x, y, z]) => [x, z, -y],
  y: ([x, y, z]) => [-z, y, x],
  z: ([x, y, z]) => [y, -x, z],
};

const AXIS_OF = { x: 0, y: 1, z: 2 };

/**
 * A move is: an axis, the set of layer coordinates it turns, and how many
 * quarter turns (in the positive/clockwise-about-axis direction).
 */
const MOVE_DEFS = {
  // outer face turns
  R: { axis: "x", layers: [1], dir: 1 },
  L: { axis: "x", layers: [-1], dir: -1 },
  U: { axis: "y", layers: [1], dir: 1 },
  D: { axis: "y", layers: [-1], dir: -1 },
  F: { axis: "z", layers: [1], dir: 1 },
  B: { axis: "z", layers: [-1], dir: -1 },
  // slices (M follows L, E follows D, S follows F)
  M: { axis: "x", layers: [0], dir: -1 },
  E: { axis: "y", layers: [0], dir: -1 },
  S: { axis: "z", layers: [0], dir: 1 },
  // wide turns
  r: { axis: "x", layers: [1, 0], dir: 1 },
  l: { axis: "x", layers: [-1, 0], dir: -1 },
  u: { axis: "y", layers: [1, 0], dir: 1 },
  d: { axis: "y", layers: [-1, 0], dir: -1 },
  f: { axis: "z", layers: [1, 0], dir: 1 },
  b: { axis: "z", layers: [-1, 0], dir: -1 },
  // whole cube rotations
  x: { axis: "x", layers: [1, 0, -1], dir: 1 },
  y: { axis: "y", layers: [1, 0, -1], dir: 1 },
  z: { axis: "z", layers: [1, 0, -1], dir: 1 },
};

// Cache the 54-element permutation for each (base move, amount) pair.
const permCache = new Map();

function permutationFor(base, quarterTurns) {
  const cacheKey = `${base}${quarterTurns}`;
  const cached = permCache.get(cacheKey);
  if (cached) return cached;

  const def = MOVE_DEFS[base];
  if (!def) throw new Error(`unknown move: ${base}`);
  const rot = ROT[def.axis];
  const axisIndex = AXIS_OF[def.axis];
  const turns = ((quarterTurns * def.dir) % 4 + 4) % 4;

  // perm[destination] = source
  const perm = new Array(54);
  for (let i = 0; i < 54; i++) perm[i] = i;

  for (const facelet of FACELETS) {
    if (!def.layers.includes(facelet.pos[axisIndex])) continue;
    let pos = facelet.pos;
    let normal = facelet.normal;
    for (let t = 0; t < turns; t++) {
      pos = rot(pos);
      normal = rot(normal);
    }
    const dest = LOOKUP.get(KEY(pos, normal));
    if (dest === undefined) throw new Error(`lost facelet ${facelet.index}`);
    perm[dest] = facelet.index;
  }
  permCache.set(cacheKey, perm);
  return perm;
}

/** Which facelet indices a single move displaces. */
export function affectedFacelets(token) {
  const { base, quarterTurns } = parseMove(token);
  const perm = permutationFor(base, quarterTurns);
  const moved = new Map();
  for (let dest = 0; dest < 54; dest++) {
    if (perm[dest] !== dest) moved.set(perm[dest], dest);
  }
  return moved; // source index -> destination index
}

const MOVE_RE = /^([RLUDFBMESrludfbxyz]|[RLUDFB]w)([0-9]*)('?)$/;

/** Parse "R", "U2", "R2'", "Rw'", "M2" ... into {base, quarterTurns}. */
export function parseMove(token) {
  const match = MOVE_RE.exec(token);
  if (!match) throw new Error(`unparseable move: ${token}`);
  let [, base, amountStr, prime] = match;
  if (base.length === 2) base = base[0].toLowerCase(); // Rw -> r
  const amount = amountStr ? parseInt(amountStr, 10) : 1;
  return { base, quarterTurns: prime ? -amount : amount };
}

/** Split an algorithm string into move tokens, ignoring grouping characters. */
export function tokenize(alg) {
  return alg
    .replace(/[()[\],]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function applyAlg(state, alg) {
  let next = state.slice();
  for (const token of tokenize(alg)) {
    const { base, quarterTurns } = parseMove(token);
    const perm = permutationFor(base, quarterTurns);
    const after = new Array(54);
    for (let i = 0; i < 54; i++) after[i] = next[perm[i]];
    next = after;
  }
  return next;
}

export function invertAlg(alg) {
  return tokenize(alg)
    .reverse()
    .map((token) => (token.endsWith("'") ? token.slice(0, -1) : `${token}'`))
    .join(" ");
}

/** Build a 54-facelet colour array from a predicate over facelet geometry. */
export function buildState(colorFor) {
  return FACELETS.map((facelet) => colorFor(facelet));
}

const HIDDEN = "x";
const FACE_COLOR = { U: "y", D: "w", F: "b", B: "g", R: "r", L: "o" };

const samePos = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

/** Full colour scheme — used for PLL diagrams and the notation reference. */
export const PLL_MASK = buildState(({ face }) => FACE_COLOR[face]);
export const FULL_MASK = PLL_MASK;

/** U face fully yellow, last-layer side stickers hidden — OLL diagrams. */
export const OLL_MASK = buildState(({ face, pos }) => {
  if (face === "U") return "y";
  return pos[1] === 1 ? HIDDEN : FACE_COLOR[face];
});

/**
 * SolveTheCube's F2L diagrams show only the pieces that matter: the two
 * centres, the front-right pair (FR edge + DFR corner) and the two cross edges
 * touching that slot.
 */
const F2L_VISIBLE = [
  [0, 0, 1], [1, 0, 1], [0, -1, 1], [1, -1, 1], // F side of the slot
  [1, 0, 0], [1, -1, 0], // R side of the slot
  [0, -1, 0], // D centre
];
export const F2L_MASK = buildState(({ face, pos }) => {
  if (face === "U") return samePos(pos, [0, 1, 0]) ? "y" : HIDDEN;
  if (face === "B" || face === "L") return HIDDEN;
  return F2L_VISIBLE.some((p) => samePos(p, pos)) ? FACE_COLOR[face] : HIDDEN;
});

/** The 27 stickers visible in an isometric U/F/R diagram, in reading order. */
export function visibleStickers(state) {
  const u = state.slice(0, 9);
  const f = state.slice(18, 27);
  const r = state.slice(9, 18);
  return [...u, ...f, ...r].join("");
}

/** The 24 orientations of the cube, as algorithms. */
const ORIENTATIONS = [];
for (const flip of ["", "x", "x2", "x'", "z", "z'"]) {
  for (const spin of ["", "y", "y2", "y'"]) {
    ORIENTATIONS.push(`${flip} ${spin}`.trim());
  }
}

const face = (visible, name) => {
  const offset = { U: 0, F: 9, R: 18 }[name];
  return visible.slice(offset, offset + 9);
};

/**
 * Checks that the part of the cube the case does *not* touch is solved and
 * pointing the standard way: front face blue, right face red.
 */
const ANCHORS = {
  F2L: (v) => {
    const f = face(v, "F");
    const r = face(v, "R");
    return v[4] === "y" && f[4] === "b" && f[7] === "b" && r[4] === "r" && r[7] === "r";
  },
  OLL: (v) => /^\w{3}b{6}$/.test(face(v, "F")) && /^\w{3}r{6}$/.test(face(v, "R")),
  PLL: (v) => face(v, "U") === "y".repeat(9)
    && face(v, "F").endsWith("bbbbbb")
    && face(v, "R").endsWith("rrrrrr"),
};

/**
 * State of the cube *before* an algorithm is performed, i.e. the case itself.
 *
 * Many algorithms leave the cube re-framed (an F2L insert ending on `d`, a PLL
 * starting with `x z'`). Running the inverse from a naively solved cube would
 * then produce a rotated diagram, so we search the 24 orientations for the one
 * whose solved state leaves the untouched layers where the standard diagram
 * expects them.
 */
export function caseState(maskName, mask, alg) {
  const anchor = ANCHORS[maskName];
  const inverse = invertAlg(alg);
  const matches = [];
  for (const orientation of ORIENTATIONS) {
    const visible = visibleStickers(applyAlg(applyAlg(mask, orientation), inverse));
    if (anchor(visible)) matches.push(visible);
  }
  const unique = [...new Set(matches)];
  if (unique.length !== 1) {
    throw new Error(
      `expected exactly one orientation for "${alg}", found ${unique.length}`,
    );
  }
  return unique[0];
}
