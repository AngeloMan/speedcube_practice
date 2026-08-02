import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Every bindable action is a screen-relative move token. Modifiers are applied
 * on top of these at keypress time:
 *   base            -> the move itself        (W -> U)
 *   Shift + base    -> prime                  (Shift+W -> U')
 *   Ctrl  + base    -> wide                   (Ctrl+W  -> u)
 *   Ctrl + Shift    -> wide prime             (Ctrl+Shift+W -> u')
 */
/**
 * The keybinding matrix. Every move has its own row with a clockwise and a
 * counter-clockwise key, so a prime turn can get a dedicated key instead of
 * relying on the Shift modifier. Shift keeps working either way — it simply
 * inverts whatever the key is bound to.
 */
export const BINDING_MATRIX = [
  {
    group: "Layers",
    hint: "Ctrl turns these into wide turns.",
    rows: [
      { label: "Up", cw: "U", ccw: "U'" },
      { label: "Left", cw: "L", ccw: "L'" },
      { label: "Front", cw: "F", ccw: "F'" },
      { label: "Right", cw: "R", ccw: "R'" },
      { label: "Down", cw: "D", ccw: "D'" },
      { label: "Back", cw: "B", ccw: "B'" },
    ],
  },
  {
    group: "Slices",
    hint: "Each slice follows a neighbouring face: M←L, E←D, S←F.",
    rows: [
      { label: "Middle", cw: "M", ccw: "M'" },
      { label: "Equator", cw: "E", ccw: "E'" },
      { label: "Standing", cw: "S", ccw: "S'" },
    ],
  },
  {
    group: "Cube rotations",
    hint: "The whole cube turns; no pieces move relative to each other.",
    rows: [
      { label: "Up / down (x)", cw: "x", ccw: "x'" },
      { label: "Right / left (y)", cw: "y", ccw: "y'" },
      { label: "Roll (z)", cw: "z", ccw: "z'" },
    ],
  },
];

const LABELS = {
  U: "Up face", L: "Left face", F: "Front face", R: "Right face",
  D: "Down face", B: "Back face",
  M: "Middle slice", E: "Equator slice", S: "Standing slice",
  x: "Rotate cube up", y: "Rotate cube right", z: "Roll cube clockwise",
};

/** Flat action list derived from the matrix, for the modal and the reference. */
export const ACTIONS = BINDING_MATRIX.flatMap((section) =>
  section.rows.flatMap((row) => [
    { id: row.cw, label: LABELS[row.cw] ?? row.label, group: section.group, note: row.cw },
    {
      id: row.ccw,
      label: `${LABELS[row.cw] ?? row.label} (prime)`,
      group: section.group,
      note: row.ccw,
    },
  ]),
);

/**
 * The shipped schema: a two-handed layout with a dedicated key for most prime
 * turns rather than leaning on Shift. Anything left empty falls back to
 * Shift + its clockwise key.
 */
export const DEFAULT_BINDINGS = {
  // Layers
  U: "e",
  "U'": "t",
  L: "a",
  "L'": "q",
  F: "s",
  "F'": "w",
  R: "y",
  "R'": "h",
  D: "b",
  "D'": "x",
  B: "",
  "B'": "",
  // Slices
  M: "",
  "M'": "r",
  E: "g",
  "E'": "d",
  S: "",
  "S'": "f",
  // Cube rotations
  x: "k",
  "x'": "i",
  y: "l",
  "y'": "j",
  z: "",
  "z'": "",
};

export const DEFAULT_CAMERA = { latitude: 34, longitude: 30 };

const MAX_SOLVES = 500;

const newId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const useStore = create(
  persist(
    (set, get) => ({
      // ---- appearance -----------------------------------------------------
      theme: "dark",
      toggleTheme: () => set({ theme: get().theme === "dark" ? "light" : "dark" }),

      // ---- keyboard -------------------------------------------------------
      bindings: { ...DEFAULT_BINDINGS },
      setBinding: (actionId, key) =>
        set((state) => {
          const bindings = { ...state.bindings };
          // A physical key can only drive one action.
          if (key) {
            for (const id of Object.keys(bindings)) {
              if (bindings[id] === key) bindings[id] = "";
            }
          }
          bindings[actionId] = key;
          return { bindings };
        }),
      resetBindings: () => set({ bindings: { ...DEFAULT_BINDINGS } }),

      /** Which modifier produces wide turns. Ctrl+W is intercepted by most
       *  browsers as "close tab", so Alt is offered as an escape hatch. */
      wideModifier: "ctrl",
      setWideModifier: (wideModifier) => set({ wideModifier }),

      // ---- animation ------------------------------------------------------
      /** Milliseconds per quarter turn. cubing.js animates at 1000ms/turn when
       *  tempoScale is 1, so tempoScale = 1000 / turnMs. */
      turnMs: 90,
      setTurnMs: (turnMs) => set({ turnMs }),

      // ---- practice defaults ---------------------------------------------
      hintFacelets: true,
      toggleHintFacelets: () => set({ hintFacelets: !get().hintFacelets }),
      cameraRelative: true,
      toggleCameraRelative: () => set({ cameraRelative: !get().cameraRelative }),

      // ---- colour orientation ---------------------------------------------
      /** Practice viewer: yellow on top, blue in front, like the diagrams. */
      practiceOrientation: "yellow-top",
      setPracticeOrientation: (practiceOrientation) => set({ practiceOrientation }),
      /** Solver: the WCA competition standard, white on top, green in front. */
      scrambleOrientation: "white-top",
      setScrambleOrientation: (scrambleOrientation) => set({ scrambleOrientation }),

      // ---- solve mode / timer ---------------------------------------------
      solveMode: false,
      toggleSolveMode: () => set({ solveMode: !get().solveMode, timerActive: false }),

      /**
       * "physical" — you turn a real cube, so any key stops the timer and the
       * cube's keybindings are muted for the duration.
       * "keyboard" — you solve the virtual cube, so movement keys stay live and
       * the timer stops when the cube comes back to solved.
       */
      solveInput: "physical",
      setSolveInput: (solveInput) => set({ solveInput }),

      inspection: false,
      toggleInspection: () => set({ inspection: !get().inspection }),

      /** True while inspecting or solving. Transient — never persisted. */
      timerActive: false,
      setTimerActive: (timerActive) => set({ timerActive }),

      /** Session solves, most recent first. */
      solves: [],
      addSolve: (solve) =>
        set((state) => ({
          solves: [
            {
              id: newId(),
              at: Date.now(),
              plus2: false,
              dnf: false,
              scramble: "",
              ...solve,
            },
            ...state.solves,
          ].slice(0, MAX_SOLVES),
        })),
      removeSolve: (id) =>
        set((state) => ({ solves: state.solves.filter((solve) => solve.id !== id) })),
      /** Cycle a solve between OK, +2 and DNF. */
      setSolvePenalty: (id, penalty) =>
        set((state) => ({
          solves: state.solves.map((solve) =>
            solve.id === id
              ? { ...solve, plus2: penalty === "plus2", dnf: penalty === "dnf" }
              : solve,
          ),
        })),
      clearSolves: () => set({ solves: [] }),
    }),
    {
      name: "speedcube-trainer",
      // Bumped when the shipped defaults change. `migrate` below drops the
      // saved copy of the old schema so the new one actually takes effect.
      version: 2,
      migrate: (persisted, fromVersion) => {
        if (!persisted || fromVersion >= 2) return persisted;
        // Everything tied to the old default schema goes; the solve history and
        // the session's own choices are the user's, not ours, so they stay.
        const kept = {};
        for (const key of ["solves", "theme", "solveMode", "solveInput", "inspection"]) {
          if (persisted[key] !== undefined) kept[key] = persisted[key];
        }
        return kept;
      },
      // `timerActive` is deliberately absent: a reload must never come back
      // believing a solve is in progress.
      partialize: (state) => ({
        theme: state.theme,
        bindings: state.bindings,
        wideModifier: state.wideModifier,
        turnMs: state.turnMs,
        hintFacelets: state.hintFacelets,
        cameraRelative: state.cameraRelative,
        solveMode: state.solveMode,
        solveInput: state.solveInput,
        inspection: state.inspection,
        solves: state.solves,
        practiceOrientation: state.practiceOrientation,
        scrambleOrientation: state.scrambleOrientation,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...persisted,
        // Keep new actions working if the saved schema predates them.
        bindings: { ...DEFAULT_BINDINGS, ...(persisted?.bindings ?? {}) },
      }),
    },
  ),
);
