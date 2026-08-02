/** Sanity checks for the camera-relative translation and the cube simulator. */
import assert from "node:assert/strict";
import { screenFrame, toCubeNotation, applyModifiers, invertAlg } from "../src/lib/moves.js";
import { FULL_MASK, applyAlg, visibleStickers } from "../src/lib/cube.js";

let checks = 0;
const check = (label, actual, expected) => {
  checks += 1;
  assert.deepEqual(actual, expected, `${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
};

// --- the default view is the identity mapping -------------------------------
const home = screenFrame(34, 30);
check("default frame", [home.U, home.F, home.R], ["U", "F", "R"]);
check("default U", toCubeNotation("U", home), "U");
check("default M'", toCubeNotation("M'", home), "M'");
check("default x", toCubeNotation("x", home), "x");

// --- orbit 90 degrees to the right ------------------------------------------
// The old R face now faces us, and the old B face is on our right.
const right90 = screenFrame(34, 120);
check("orbited frame", [right90.U, right90.F, right90.R], ["U", "R", "B"]);
check("F turns the face we see", toCubeNotation("F", right90), "R");
check("R turns the face on the right", toCubeNotation("R", right90), "B");
check("L turns the face on the left", toCubeNotation("L", right90), "F");
check("U is unchanged overhead", toCubeNotation("U", right90), "U");
// M follows the left face, which is now F, so it becomes the S slice.
check("M follows screen-left", toCubeNotation("M", right90), "S");
check("M' follows screen-left", toCubeNotation("M'", right90), "S'");
// "Rotate up" tips the face we are looking at (R) onto the top, which is z'.
check("x follows screen-right", toCubeNotation("x", right90), "z'");
check("y still spins about the screen vertical", toCubeNotation("y", right90), "y");
check("wide r", toCubeNotation("r", right90), "b");

// --- look at the cube from underneath ---------------------------------------
// An orbit camera keeps world-up, so tipping below the equator puts the D face
// in front of us and slides the F face to the top of the screen.
const below = screenFrame(-70, 30);
check("looking up at D", [below.U, below.F, below.R], ["F", "D", "R"]);
check("U turns the layer at the top of the screen", toCubeNotation("U", below), "F");
check("F turns the layer facing us", toCubeNotation("F", below), "D");

// --- modifier rules ---------------------------------------------------------
check("base", applyModifiers("U", { shift: false, wide: false }), "U");
check("shift = prime", applyModifiers("U", { shift: true, wide: false }), "U'");
check("ctrl = wide", applyModifiers("U", { shift: false, wide: true }), "u");
check("ctrl+shift = wide prime", applyModifiers("U", { shift: true, wide: true }), "u'");
check("shift on a slice", applyModifiers("M", { shift: true, wide: false }), "M'");
check("shift on S", applyModifiers("S", { shift: true, wide: false }), "S'");
check("wide has no meaning for slices", applyModifiers("M", { shift: false, wide: true }), "M");

// --- translation must never lose a move -------------------------------------
const tokens = ["U", "D", "F", "B", "L", "R", "u", "d", "f", "b", "l", "r", "M", "E", "S", "x", "y", "z"];
for (let longitude = 0; longitude < 360; longitude += 15) {
  for (let latitude = -85; latitude <= 85; latitude += 17) {
    const frame = screenFrame(latitude, longitude);
    for (const token of tokens) {
      const out = toCubeNotation(token, frame);
      assert.ok(out, `${token} at ${latitude}/${longitude} produced nothing`);
      checks += 1;
    }
    // The frame must stay a valid right-handed set of six distinct faces.
    assert.equal(new Set(Object.values(frame)).size, 6, `degenerate frame at ${latitude}/${longitude}`);
  }
}

// --- a translated move must equal the same move done in the rotated frame ---
// Turning "what I see" from a camera at longitude L is exactly: rotate the cube
// so that face is at the front, turn F, rotate back. Unique labels per sticker
// make this a strict permutation comparison.
const LABELLED = Array.from({ length: 54 }, (_, i) => `s${i}`);
const conjugate = (setup, move) =>
  applyAlg(LABELLED, `${setup} ${move} ${invertAlg(setup)}`).join(",");

const VIEWS = [
  { latitude: 34, longitude: 30, setup: "" },
  { latitude: 34, longitude: 120, setup: "y" },
  { latitude: 34, longitude: 210, setup: "y2" },
  { latitude: 34, longitude: 300, setup: "y'" },
  { latitude: -70, longitude: 30, setup: "x" }, // tipped under the cube
  { latitude: 80, longitude: 30, setup: "x'" }, // looking down on the top
];

for (const view of VIEWS) {
  const frame = screenFrame(view.latitude, view.longitude);
  for (const token of ["F", "R", "U", "D", "L", "B", "M", "E", "S", "r", "u", "x", "y", "z"]) {
    check(
      `screen-${token} at ${view.latitude}/${view.longitude}`,
      applyAlg(LABELLED, toCubeNotation(token, frame)).join(","),
      conjugate(view.setup, token),
    );
  }
}

// --- simulator identities ---------------------------------------------------
const solved = visibleStickers(FULL_MASK);
check("sexy move x6", visibleStickers(applyAlg(FULL_MASK, "R U R' U' ".repeat(6))), solved);
check("M2 U M2 U2 M2 U M2 (H perm) x2", visibleStickers(applyAlg(FULL_MASK, "M2 U M2 U2 M2 U M2 M2 U M2 U2 M2 U M2")), solved);
check("alg and its inverse cancel", visibleStickers(applyAlg(applyAlg(FULL_MASK, "R U2 D' B D'"), invertAlg("R U2 D' B D'"))), solved);
check("r = R M'", visibleStickers(applyAlg(FULL_MASK, "r")), visibleStickers(applyAlg(FULL_MASK, "R M'")));
check("u = U E'", visibleStickers(applyAlg(FULL_MASK, "u")), visibleStickers(applyAlg(FULL_MASK, "U E'")));
check("f = F S", visibleStickers(applyAlg(FULL_MASK, "f")), visibleStickers(applyAlg(FULL_MASK, "F S")));
check("x = r L'", visibleStickers(applyAlg(FULL_MASK, "x")), visibleStickers(applyAlg(FULL_MASK, "r L'")));
check("y = u D'", visibleStickers(applyAlg(FULL_MASK, "y")), visibleStickers(applyAlg(FULL_MASK, "u D'")));
check("z = f B'", visibleStickers(applyAlg(FULL_MASK, "z")), visibleStickers(applyAlg(FULL_MASK, "f B'")));

console.log(`all ${checks} assertions passed`);
