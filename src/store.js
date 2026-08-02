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
export const ACTIONS = [
  { id: "U", label: "Up face", group: "Layers", note: "U / u" },
  { id: "L", label: "Left face", group: "Layers", note: "L / l" },
  { id: "F", label: "Front face", group: "Layers", note: "F / f" },
  { id: "R", label: "Right face", group: "Layers", note: "R / r" },
  { id: "D", label: "Down face", group: "Layers", note: "D / d" },
  { id: "B", label: "Back face", group: "Layers", note: "B / b" },
  { id: "M", label: "Middle slice", group: "Slices", note: "follows L" },
  { id: "E", label: "Equator slice", group: "Slices", note: "follows D" },
  { id: "S", label: "Standing slice", group: "Slices", note: "follows F" },
  { id: "y'", label: "Rotate cube left", group: "Rotations", note: "y'" },
  { id: "y", label: "Rotate cube right", group: "Rotations", note: "y" },
  { id: "x", label: "Rotate cube up", group: "Rotations", note: "x" },
  { id: "x'", label: "Rotate cube down", group: "Rotations", note: "x'" },
  { id: "z", label: "Rotate cube clockwise", group: "Rotations", note: "z" },
  { id: "z'", label: "Rotate cube anticlockwise", group: "Rotations", note: "z'" },
];

export const DEFAULT_BINDINGS = {
  U: "w",
  L: "a",
  F: "s",
  R: "d",
  D: "x",
  M: "c",
  S: "z",
  B: "",
  E: "",
  "y'": "j",
  y: "l",
  x: "i",
  "x'": "k",
  z: "",
  "z'": "",
};

export const DEFAULT_CAMERA = { latitude: 34, longitude: 30 };

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
      turnMs: 50,
      setTurnMs: (turnMs) => set({ turnMs }),

      // ---- practice defaults ---------------------------------------------
      hintFacelets: false,
      toggleHintFacelets: () => set({ hintFacelets: !get().hintFacelets }),
      cameraRelative: true,
      toggleCameraRelative: () => set({ cameraRelative: !get().cameraRelative }),
    }),
    {
      name: "speedcube-trainer",
      version: 1,
      partialize: (state) => ({
        theme: state.theme,
        bindings: state.bindings,
        wideModifier: state.wideModifier,
        turnMs: state.turnMs,
        hintFacelets: state.hintFacelets,
        cameraRelative: state.cameraRelative,
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
