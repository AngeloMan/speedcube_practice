/**
 * Colour orientation, and the stickering masks it forces us to build ourselves.
 *
 * cubing.js hard-codes its face colours (white U, green F, red R) and there is
 * no colour-scheme API. The only way to get another scheme on screen is to turn
 * the cube: an `x2` in the setup swaps U↔D and F↔B, which lands yellow on top
 * and blue in front — the scheme SolveTheCube's diagrams use.
 *
 * The catch is that `experimentalStickering` builds its masks from *piece
 * identity*, not from where a piece currently sits, so an `x2` also drags the
 * last-layer mask down to the bottom of the cube. We therefore build the mask
 * ourselves against whichever layer is actually on top.
 *
 * Layer membership is derived from the puzzle definition at runtime — we ask
 * which pieces a given turn disturbs — rather than hard-coding index tables that
 * a future cubing.js release could renumber.
 */

const REGULAR = "regular";
const IGNORED = "ignored";
const DIM = "dim";

/**
 * A viewing frame, described by which of the *solved* faces ends up where.
 * `setup` is prepended to the player's setup algorithm.
 */
export const ORIENTATIONS = {
  "white-top": { label: "White top · green front", setup: "", up: "U", front: "F", right: "R" },
  "yellow-top": { label: "Yellow top · blue front", setup: "x2", up: "D", front: "B", right: "R" },
};

const OPPOSITE = { U: "D", D: "U", F: "B", B: "F", R: "L", L: "R" };

let kpuzzlePromise = null;
function kpuzzle3x3x3() {
  kpuzzlePromise ??= import("cubing/puzzles").then(({ cube3x3x3 }) => cube3x3x3.kpuzzle());
  return kpuzzlePromise;
}

/** Piece indices, per orbit, that the given move disturbs. */
function affected(kpuzzle, move) {
  const { transformationData } = kpuzzle.moveToTransformation(move);
  const result = {};
  for (const orbit of kpuzzle.definition.orbits) {
    const { permutation, orientationDelta } = transformationData[orbit.orbitName];
    const set = new Set();
    for (let i = 0; i < orbit.numPieces; i += 1) {
      if (permutation[i] !== i || (orientationDelta?.[i] ?? 0) !== 0) set.add(i);
    }
    result[orbit.orbitName] = set;
  }
  return result;
}

const intersect = (...sets) => {
  const [first, ...rest] = sets;
  return new Set([...first].filter((value) => rest.every((set) => set.has(value))));
};

/**
 * The pieces of the F2L slot at the front-right of the *view*: the middle-layer
 * edge shared by the front and right faces, plus the corner it pairs with.
 */
function slotPieces(kpuzzle, frame) {
  const up = affected(kpuzzle, frame.up);
  const down = affected(kpuzzle, OPPOSITE[frame.up]);
  const front = affected(kpuzzle, frame.front);
  const right = affected(kpuzzle, frame.right);

  const pieces = {};
  for (const orbit of kpuzzle.definition.orbits) {
    const name = orbit.orbitName;
    const shared = intersect(front[name], right[name]);
    const edge = new Set([...shared].filter((i) => !up[name].has(i) && !down[name].has(i)));
    const corner = intersect(shared, down[name]);
    pieces[name] = new Set([...edge, ...corner]);
  }
  return pieces;
}

const fill = (count, value) => Array.from({ length: count }, () => value);

/**
 * Facelet pattern for a last-layer piece under each masking style. Facelet 0 is
 * the sticker on the layer's own face, which is what "primary" means here.
 */
function lastLayerFacelets(style, numOrientations) {
  switch (style) {
    case "OLL": // orientation matters, permutation does not
      return [REGULAR, ...fill(numOrientations - 1, IGNORED)];
    case "PLL": // permutation matters, orientation does not
      return [DIM, ...fill(numOrientations - 1, REGULAR)];
    default: // F2L / LS: the last layer is simply out of scope
      return fill(numOrientations, IGNORED);
  }
}

/**
 * Build the mask for a stickering in a given frame, or `null` when no mask is
 * wanted (full colour) or the stickering is not one we model.
 */
export async function stickeringMaskFor(style, orientationKey) {
  const frame = ORIENTATIONS[orientationKey];
  if (!frame) return null;

  const kpuzzle = await kpuzzle3x3x3();
  // "full" still produces a mask — an all-regular one. Returning null here
  // would leave a previously applied mask in place, so switching a case back to
  // full colour would stay greyed out.
  const lastLayer = style === "full" ? null : affected(kpuzzle, frame.up);
  const slot = style === "LS" ? slotPieces(kpuzzle, frame) : null;

  const orbits = {};
  for (const orbit of kpuzzle.definition.orbits) {
    const { orbitName, numPieces, numOrientations } = orbit;
    const pieces = [];
    for (let i = 0; i < numPieces; i += 1) {
      const inLastLayer = lastLayer?.[orbitName].has(i) ?? false;
      const isSlotPiece = slot?.[orbitName]?.has(i) ?? false;
      pieces.push({
        facelets:
          inLastLayer && !isSlotPiece
            ? lastLayerFacelets(style, numOrientations)
            : fill(numOrientations, REGULAR),
      });
    }
    orbits[orbitName] = { pieces };
  }

  return { name: `${style}-${orientationKey}`, orbits };
}

/** Rotation prefix that puts the requested colours up and in front. */
export const orientationSetup = (orientationKey) => ORIENTATIONS[orientationKey]?.setup ?? "";
