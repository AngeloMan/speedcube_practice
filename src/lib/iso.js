/**
 * Isometric projection for the static cube previews.
 *
 * A single unit cell is a rhombus on the U face and a parallelogram on the F/R
 * faces. Everything is derived from three 2D basis vectors so that facelets
 * line up exactly across the three visible faces.
 */

const S = 20; // cell size in user units
const HX = 0.866 * S; // horizontal half-step
const HY = 0.5 * S; // vertical half-step

// Basis vectors in screen space.
const RIGHT = [HX, HY]; // +x on the U face (towards R)
const FRONT = [-HX, HY]; // +z on the U face (towards the viewer)
const DOWN = [0, S]; // -y on the side faces

const add = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k];

const ORIGIN = {
  // top vertex of the whole drawing = back-left-top corner of U
  U: [0, 0],
  // top-left of F = U's origin walked three cells towards the viewer
  F: [FRONT[0] * 3, FRONT[1] * 3],
  // top-left of R = the front vertical edge shared with F
  R: [0, S * 3],
};

/** Basis (column step, row step) for each visible face. */
const BASIS = {
  U: [RIGHT, FRONT],
  F: [RIGHT, DOWN],
  R: [[-FRONT[0], -FRONT[1]], DOWN],
};

export const VIEW_BOX = `${-HX * 3 - 2} ${-2} ${HX * 6 + 4} ${S * 6 + 4}`;

/** The four corners of one facelet, as an SVG points string. */
export function cellPoints(face, row, col) {
  const [colStep, rowStep] = BASIS[face];
  const origin = add(add(ORIGIN[face], colStep, col), rowStep, row);
  return [
    origin,
    add(origin, colStep),
    add(add(origin, colStep), rowStep),
    add(origin, rowStep),
  ]
    .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
}

/** Centre point of one facelet in screen space. */
export function cellCenter(face, row, col) {
  const [colStep, rowStep] = BASIS[face];
  const origin = add(add(ORIGIN[face], colStep, col), rowStep, row);
  return add(add(origin, colStep, 0.5), rowStep, 0.5);
}

/** Outline of a whole face, for the drop shadow / border pass. */
export function facePoints(face) {
  const [colStep, rowStep] = BASIS[face];
  const o = ORIGIN[face];
  return [o, add(o, colStep, 3), add(add(o, colStep, 3), rowStep, 3), add(o, rowStep, 3)]
    .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
}

export const VISIBLE_FACES = ["U", "F", "R"];

/**
 * Facelet index (URFDLB order) -> visible cell, or null when the sticker faces
 * away from the camera.
 */
export function visibleCell(index) {
  const face = ["U", "R", "F", "D", "L", "B"][Math.floor(index / 9)];
  if (!VISIBLE_FACES.includes(face)) return null;
  const i = index % 9;
  return { face, row: Math.floor(i / 3), col: i % 3 };
}

/** Position within the 27-character sticker string for a visible cell. */
export function stickerIndex(face, row, col) {
  return { U: 0, F: 9, R: 18 }[face] + row * 3 + col;
}

export const STICKER_COLORS = {
  y: "#f5d020",
  b: "#1668d6",
  r: "#d92b1f",
  o: "#ee7a17",
  g: "#17a94a",
  w: "#f2f2f2",
  x: "#3a3a44", // masked / irrelevant piece
};

/** Faces are shaded so the isometric form reads as a solid. */
export const FACE_SHADE = { U: 1, F: 0.82, R: 0.66 };
