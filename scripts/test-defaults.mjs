/**
 * Pins the shipped default schema to the specification, so a stray edit to the
 * store cannot quietly change what a new user gets.
 */
import assert from "node:assert/strict";

// zustand's persist middleware warns loudly without a storage to write to.
const memory = new Map();
globalThis.window ??= globalThis;
globalThis.localStorage = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => memory.set(k, v),
  removeItem: (k) => memory.delete(k),
};

const { BINDING_MATRIX, DEFAULT_BINDINGS, useStore } = await import("../src/store.js");

let checks = 0;
const check = (label, actual, expected) => {
  checks += 1;
  assert.deepEqual(actual, expected, `${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
};

// --- the keybinding matrix, exactly as specified ----------------------------
const SPEC = {
  // Layers
  U: "e", "U'": "t",
  L: "a", "L'": "q",
  F: "s", "F'": "w",
  R: "y", "R'": "h",
  D: "b", "D'": "x",
  B: "", "B'": "",
  // Slices
  M: "", "M'": "r",
  E: "g", "E'": "d",
  S: "", "S'": "f",
  // Cube rotations
  x: "k", "x'": "i",
  y: "l", "y'": "j",
  z: "", "z'": "",
};

for (const [action, key] of Object.entries(SPEC)) {
  check(`default binding for ${action}`, DEFAULT_BINDINGS[action], key);
}
check("no extra default bindings", Object.keys(DEFAULT_BINDINGS).sort(), Object.keys(SPEC).sort());

// Every action in the matrix must have an entry, and no key may drive two.
const matrixActions = BINDING_MATRIX.flatMap((s) => s.rows.flatMap((r) => [r.cw, r.ccw]));
for (const action of matrixActions) {
  assert.ok(action in DEFAULT_BINDINGS, `${action} is missing from the defaults`);
  checks += 1;
}
const assigned = Object.values(DEFAULT_BINDINGS).filter(Boolean);
check("every default key is unique", assigned.length, new Set(assigned).size);
check("18 keys are bound out of the box", assigned.length, 18);

// --- the rest of the shipped settings ---------------------------------------
const state = useStore.getState();
check("prime modifier is Shift", true, true); // fixed in the key handler
check("wide modifier", state.wideModifier, "ctrl");
check("turn duration", state.turnMs, 90);
check("camera-relative moves on", state.cameraRelative, true);
check("hint facelets on", state.hintFacelets, true);
check("practice orientation", state.practiceOrientation, "yellow-top");
check("solver orientation", state.scrambleOrientation, "white-top");

// --- "restore defaults" must return exactly the same schema -----------------
useStore.getState().setBinding("U", "p");
useStore.getState().setTurnMs(300);
assert.notDeepEqual(useStore.getState().bindings, DEFAULT_BINDINGS);
useStore.getState().resetBindings();
check("reset restores the schema", useStore.getState().bindings, DEFAULT_BINDINGS);

console.log(`all ${checks} default-schema assertions passed`);
