/**
 * Camera-relative move translation.
 *
 * The user always thinks in screen space: "turn the face I'm looking at", "turn
 * the face on my right". Cube notation is absolute, so every keystroke is
 * translated through the current camera orientation before it reaches the
 * player. Drag the cube until green is facing you and the `F` key turns green.
 */

const FACE_VECTORS = {
  U: [0, 1, 0],
  D: [0, -1, 0],
  R: [1, 0, 0],
  L: [-1, 0, 0],
  F: [0, 0, 1],
  B: [0, 0, -1],
};

const AXIS_FACES = [["R", "L"], ["U", "D"], ["F", "B"]];
const OPPOSITE = { U: "D", D: "U", L: "R", R: "L", F: "B", B: "F" };

const rad = (deg) => (deg * Math.PI) / 180;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/**
 * Orbit camera basis in cube coordinates. Longitude 0 looks straight at the F
 * face; positive longitude orbits towards R, positive latitude towards U.
 */
export function cameraBasis(latitude, longitude) {
  const lat = rad(latitude);
  const lon = rad(longitude);
  const toViewer = [
    Math.sin(lon) * Math.cos(lat),
    Math.sin(lat),
    Math.cos(lon) * Math.cos(lat),
  ];
  const up = [
    -Math.sin(lon) * Math.sin(lat),
    Math.cos(lat),
    -Math.cos(lon) * Math.sin(lat),
  ];
  return { toViewer, up, right: cross(up, toViewer) };
}

/** Snap a direction to the face it points at most, ignoring some axes. */
function snap(vector, excludedAxes = []) {
  let best = null;
  let bestScore = -Infinity;
  for (let axis = 0; axis < 3; axis++) {
    if (excludedAxes.includes(axis)) continue;
    for (const face of AXIS_FACES[axis]) {
      const score = dot(FACE_VECTORS[face], vector);
      if (score > bestScore) {
        bestScore = score;
        best = { face, axis };
      }
    }
  }
  return best;
}

/**
 * Which real face currently sits up / front / right on screen, given the camera
 * angles. The result is always a right-handed frame, even when the camera is
 * balanced exactly on a cube corner.
 */
export function screenFrame(latitude, longitude) {
  const basis = cameraBasis(latitude, longitude);
  const up = snap(basis.up);
  const front = snap(basis.toViewer, [up.axis]);
  const rightVector = cross(FACE_VECTORS[up.face], FACE_VECTORS[front.face]);
  const right = snap(rightVector);

  return {
    U: up.face,
    F: front.face,
    R: right.face,
    D: OPPOSITE[up.face],
    B: OPPOSITE[front.face],
    L: OPPOSITE[right.face],
  };
}

export const IDENTITY_FRAME = { U: "U", D: "D", F: "F", B: "B", R: "R", L: "L" };

// A slice turns with one of its neighbours; a rotation turns with one face.
const SLICE_FOLLOWS = { M: "L", E: "D", S: "F" };
const SLICE_FOR_FACE = {
  L: { family: "M", sign: 1 },
  R: { family: "M", sign: -1 },
  D: { family: "E", sign: 1 },
  U: { family: "E", sign: -1 },
  F: { family: "S", sign: 1 },
  B: { family: "S", sign: -1 },
};
const ROTATION_FOLLOWS = { x: "R", y: "U", z: "F" };
const ROTATION_FOR_FACE = {
  R: { family: "x", sign: 1 },
  L: { family: "x", sign: -1 },
  U: { family: "y", sign: 1 },
  D: { family: "y", sign: -1 },
  F: { family: "z", sign: 1 },
  B: { family: "z", sign: -1 },
};

const MOVE_RE = /^([RLUDFBMESxyz]|[rludfb]|[RLUDFB]w)(\d*)('?)$/;

/** "R2'" -> { family: "R", amount: -2 } */
export function parseMove(token) {
  const match = MOVE_RE.exec(token.trim());
  if (!match) return null;
  const [, rawFamily, digits, prime] = match;
  const family = rawFamily.length === 2 ? rawFamily[0].toLowerCase() : rawFamily;
  const amount = digits ? parseInt(digits, 10) : 1;
  return { family, amount: prime ? -amount : amount };
}

export function formatMove(family, amount) {
  const turns = ((amount % 4) + 4) % 4;
  if (turns === 0) return null;
  return family + (turns === 1 ? "" : turns === 2 ? "2" : "'");
}

const WIDE_OF = { R: "r", L: "l", U: "u", D: "d", F: "f", B: "b" };

/**
 * Translate a screen-relative move into the notation that will turn the face
 * the user is actually looking at.
 */
export function toCubeNotation(token, frame = IDENTITY_FRAME) {
  const parsed = parseMove(token);
  if (!parsed) return null;
  const { family, amount } = parsed;

  // Outer face turn: U -> whichever face is on top right now.
  if (FACE_VECTORS[family]) {
    return formatMove(frame[family], amount);
  }

  // Wide turn: same face, both layers.
  const wideSource = Object.keys(WIDE_OF).find((f) => WIDE_OF[f] === family);
  if (wideSource) {
    return formatMove(WIDE_OF[frame[wideSource]], amount);
  }

  // Slice: keep following the same neighbouring face.
  if (SLICE_FOLLOWS[family]) {
    const target = SLICE_FOR_FACE[frame[SLICE_FOLLOWS[family]]];
    return formatMove(target.family, amount * target.sign);
  }

  // Whole cube rotation.
  if (ROTATION_FOLLOWS[family]) {
    const target = ROTATION_FOR_FACE[frame[ROTATION_FOLLOWS[family]]];
    return formatMove(target.family, amount * target.sign);
  }

  return null;
}

/** Apply the keyboard modifier rules to a base move. */
export function applyModifiers(base, { shift, wide }) {
  const parsed = parseMove(base);
  if (!parsed) return null;
  let { family, amount } = parsed;
  if (wide && WIDE_OF[family]) family = WIDE_OF[family];
  if (shift) amount = -amount;
  return formatMove(family, amount);
}

export function invertAlg(alg) {
  return alg
    .replace(/[()[\]]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .reverse()
    .map((token) => (token.endsWith("'") ? token.slice(0, -1) : `${token}'`))
    .join(" ");
}
