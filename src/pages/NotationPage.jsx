import MoveDiagram from "../components/MoveDiagram";
import { ACTIONS, useStore } from "../store";

const SECTIONS = [
  {
    title: "Face turns",
    blurb: "One outer layer, clockwise as you look at that face.",
    moves: [
      { move: "U", action: "U", text: "Up layer" },
      { move: "D", action: "D", text: "Down layer" },
      { move: "F", action: "F", text: "Front layer" },
      { move: "B", action: "B", text: "Back layer" },
      { move: "L", action: "L", text: "Left layer" },
      { move: "R", action: "R", text: "Right layer" },
    ],
  },
  {
    title: "Wide turns",
    blurb: "The outer layer plus the slice behind it. Hold the wide modifier.",
    moves: [
      { move: "u", action: "U", text: "Up, two layers", modifier: true },
      { move: "d", action: "D", text: "Down, two layers", modifier: true },
      { move: "f", action: "F", text: "Front, two layers", modifier: true },
      { move: "b", action: "B", text: "Back, two layers", modifier: true },
      { move: "l", action: "L", text: "Left, two layers", modifier: true },
      { move: "r", action: "R", text: "Right, two layers", modifier: true },
    ],
  },
  {
    title: "Slices",
    blurb: "The middle layer only. Each one follows a neighbouring face.",
    moves: [
      { move: "M", action: "M", text: "Middle · follows L" },
      { move: "E", action: "E", text: "Equator · follows D" },
      { move: "S", action: "S", text: "Standing · follows F" },
    ],
  },
  {
    title: "Cube rotations",
    blurb: "The whole cube turns; no pieces change place relative to each other.",
    moves: [
      { move: "x", action: "x", text: "Rotate on R axis" },
      { move: "y", action: "y", text: "Rotate on U axis" },
      { move: "z", action: "z", text: "Rotate on F axis" },
    ],
  },
];

function Key({ children }) {
  return (
    <kbd className="rounded border border-surface-600 bg-surface-800 px-1.5 py-0.5 font-mono text-[11px] uppercase text-zinc-300">
      {children}
    </kbd>
  );
}

export default function NotationPage() {
  const bindings = useStore((s) => s.bindings);
  const wideModifier = useStore((s) => s.wideModifier);
  const modifierLabel = wideModifier === "alt" ? "Alt" : "Ctrl";

  const labelFor = (action) => ACTIONS.find((item) => item.id === action)?.label;

  return (
    <div className="mx-auto max-w-6xl p-4 pb-16">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">Notation Reference</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Every diagram shows the cube <em>after</em> the move, with the pieces that
          travelled kept bright and an arrow following one of them. A prime
          (<code className="font-mono">'</code>) reverses the arrow; a{" "}
          <code className="font-mono">2</code> doubles it.
        </p>
      </header>

      <div className="mb-8 grid gap-3 rounded-xl border border-surface-700 bg-surface-850 p-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Base key", "Standard move", "W → U"],
          ["Shift + key", "Prime move", "Shift+W → U'"],
          [`${modifierLabel} + key`, "Wide move", `${modifierLabel}+W → u`],
          [`${modifierLabel}+Shift`, "Wide prime", `${modifierLabel}+Shift+W → u'`],
        ].map(([title, what, example]) => (
          <div key={title}>
            <div className="text-sm font-medium text-zinc-200">{title}</div>
            <div className="text-xs text-zinc-500">{what}</div>
            <code className="mt-1 block font-mono text-xs text-emerald-300">{example}</code>
          </div>
        ))}
      </div>

      {SECTIONS.map((section) => (
        <section key={section.title} className="mb-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
            {section.title}
          </h2>
          <p className="mb-4 text-sm text-zinc-500">{section.blurb}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {section.moves.map((entry) => {
              const key = bindings[entry.action];
              return (
                <div
                  key={entry.move}
                  className="flex flex-col items-center gap-2 rounded-xl border border-surface-700 bg-surface-850 p-3"
                >
                  <MoveDiagram move={entry.move} />
                  <div className="text-center">
                    <div className="font-mono text-lg font-semibold text-zinc-100">
                      {entry.move}
                    </div>
                    <div className="text-[11px] text-zinc-500">{entry.text}</div>
                  </div>
                  <div className="flex min-h-[24px] items-center gap-1">
                    {key ? (
                      <>
                        {entry.modifier && <Key>{modifierLabel}</Key>}
                        <Key>{key}</Key>
                      </>
                    ) : (
                      <span className="text-[11px] text-zinc-600">
                        unassigned · {labelFor(entry.action)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <section className="rounded-xl border border-surface-700 bg-surface-850 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
          Camera-relative controls
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
          In the practice modal the keys are bound to what you <em>see</em>, not to
          fixed faces. The face pointing at the screen is always{" "}
          <code className="font-mono text-emerald-300">F</code>, the one pointing up is{" "}
          <code className="font-mono text-emerald-300">U</code>, and the one on the
          right is <code className="font-mono text-emerald-300">R</code>. Orbit the cube
          with the mouse or rotate it with{" "}
          <Key>{bindings.x || "i"}</Key> <Key>{bindings["x'"] || "k"}</Key>{" "}
          <Key>{bindings["y'"] || "j"}</Key> <Key>{bindings.y || "l"}</Key> and the
          mapping is recalculated, so <code className="font-mono">M</code>,{" "}
          <code className="font-mono">R</code> and the rest keep tracking the layer in
          that screen position. The header of the modal shows the live mapping.
        </p>
      </section>
    </div>
  );
}
