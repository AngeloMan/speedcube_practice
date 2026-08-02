import { Fragment, useEffect, useState } from "react";
import { keyFromEvent } from "../lib/keyboard";
import { ORIENTATIONS } from "../lib/stickering";
import { ACTIONS, BINDING_MATRIX, DEFAULT_BINDINGS, useStore } from "../store";

/** One assignable key: click, then press. */
function KeyCell({ action, boundKey, fallback, capturing, onCapture, onClear, label }) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onCapture(action)}
        aria-label={`Bind ${label}`}
        className={`min-w-[76px] flex-1 rounded-lg border px-2 py-1.5 font-mono text-sm uppercase transition ${
          capturing
            ? "animate-pulse border-accent bg-accent/20 text-accent-soft"
            : boundKey
              ? "border-surface-600 bg-surface-800 text-zinc-200 hover:border-accent"
              : "border-dashed border-surface-600 text-zinc-600 hover:border-accent"
        }`}
      >
        {capturing ? "press…" : boundKey || fallback || "unset"}
      </button>
      <button
        type="button"
        onClick={() => onClear(action)}
        disabled={!boundKey}
        aria-label={`Clear ${label}`}
        className="px-1 text-zinc-600 transition hover:text-red-400 disabled:opacity-0"
      >
        ✕
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const bindings = useStore((s) => s.bindings);
  const setBinding = useStore((s) => s.setBinding);
  const resetBindings = useStore((s) => s.resetBindings);
  const wideModifier = useStore((s) => s.wideModifier);
  const setWideModifier = useStore((s) => s.setWideModifier);
  const turnMs = useStore((s) => s.turnMs);
  const setTurnMs = useStore((s) => s.setTurnMs);
  const cameraRelative = useStore((s) => s.cameraRelative);
  const toggleCameraRelative = useStore((s) => s.toggleCameraRelative);
  const hintFacelets = useStore((s) => s.hintFacelets);
  const toggleHintFacelets = useStore((s) => s.toggleHintFacelets);
  const practiceOrientation = useStore((s) => s.practiceOrientation);
  const setPracticeOrientation = useStore((s) => s.setPracticeOrientation);
  const scrambleOrientation = useStore((s) => s.scrambleOrientation);
  const setScrambleOrientation = useStore((s) => s.setScrambleOrientation);

  const [capturing, setCapturing] = useState(null);

  useEffect(() => {
    if (!capturing) return undefined;
    const onKeyDown = (event) => {
      event.preventDefault();
      if (event.key === "Escape") {
        setCapturing(null);
        return;
      }
      const key = keyFromEvent(event);
      if (!key || key === "shift" || key === "control" || key === "alt" || key === "meta") {
        return;
      }
      setBinding(capturing, key);
      setCapturing(null);
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [capturing, setBinding]);

  const isDefault = ACTIONS.every((a) => bindings[a.id] === DEFAULT_BINDINGS[a.id]);

  // Ctrl+W is unreachable, so name whichever face turn currently sits there.
  const wKeyAction = ACTIONS.find(
    (a) => bindings[a.id] === "w" && /^[UDFBLR]'?$/.test(a.id),
  )?.id;

  return (
    <div className="mx-auto max-w-5xl p-4 pb-16">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
          <p className="text-sm text-zinc-500">
            Saved to <code className="font-mono">localStorage</code> and applied
            everywhere immediately.
          </p>
        </div>
        <button
          type="button"
          onClick={resetBindings}
          disabled={isDefault}
          className="rounded-lg border border-surface-600 px-4 py-2 text-sm text-zinc-300 transition hover:bg-surface-800 disabled:opacity-40"
        >
          Restore default keys
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="rounded-xl border border-surface-700 bg-surface-900 p-4">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-zinc-300">
            Keybindings
          </h2>
          <p className="mb-4 text-xs text-zinc-500">
            Click a key to rebind, then press the new one. Keys are read by physical
            position, so Shift and {wideModifier === "alt" ? "Alt" : "Ctrl"} never change
            which action fires. A counter-clockwise turn works as Shift + its
            clockwise key unless you give it a key of its own.
          </p>

          {BINDING_MATRIX.map((section) => (
            <div key={section.group} className="mb-6 last:mb-0">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                {section.group}
              </h3>
              <p className="mb-2 text-[11px] text-zinc-600">{section.hint}</p>

              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1">
                <span />
                <span className="px-2 text-center text-[10px] uppercase tracking-wider text-zinc-600">
                  Clockwise
                </span>
                <span className="px-2 text-center text-[10px] uppercase tracking-wider text-zinc-600">
                  Counter-clockwise
                </span>

                {section.rows.map((row) => (
                  <Fragment key={row.cw}>
                    <div className="truncate py-1 text-sm text-zinc-300">
                      {row.label}
                      <span className="ml-2 font-mono text-[11px] text-zinc-600">
                        {row.cw} / {row.ccw}
                      </span>
                    </div>
                    <KeyCell
                      action={row.cw}
                      label={row.cw}
                      boundKey={bindings[row.cw]}
                      capturing={capturing === row.cw}
                      onCapture={setCapturing}
                      onClear={(id) => setBinding(id, "")}
                    />
                    <KeyCell
                      action={row.ccw}
                      label={row.ccw}
                      boundKey={bindings[row.ccw]}
                      // With no key of its own, a prime turn is Shift + the
                      // clockwise key — so show that rather than "unset".
                      fallback={bindings[row.cw] ? `⇧${bindings[row.cw]}` : ""}
                      capturing={capturing === row.ccw}
                      onCapture={setCapturing}
                      onClear={(id) => setBinding(id, "")}
                    />
                  </Fragment>
                ))}
              </div>
            </div>
          ))}
        </section>

        <div className="space-y-6">
          <section className="rounded-xl border border-surface-700 bg-surface-900 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-300">
              Modifiers
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-zinc-400">
                <span>Prime move</span>
                <span className="font-mono text-zinc-200">Shift</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Undo last move</span>
                <span className="font-mono text-zinc-200">Ctrl+Z</span>
              </div>
              <label className="block text-zinc-400">
                Wide move
                <select
                  value={wideModifier}
                  onChange={(event) => setWideModifier(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-surface-600 bg-surface-800 px-2 py-1.5 text-zinc-200"
                >
                  <option value="ctrl">Ctrl (default schema)</option>
                  <option value="alt">Alt</option>
                </select>
              </label>
            </div>
            {wideModifier === "ctrl" && wKeyAction && (
              <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-200/90">
                Browsers reserve <span className="font-mono">Ctrl+W</span> for “close
                tab” and will not let a page intercept it, so the wide{" "}
                <span className="font-mono">{wKeyAction.toLowerCase()}</span> turn
                cannot fire. Switch to Alt, or move{" "}
                <span className="font-mono">{wKeyAction}</span> off the W key, if you
                use it often.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-surface-700 bg-surface-900 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-300">
              Colour orientation
            </h2>
            <label className="block text-sm text-zinc-400">
              Algorithm practice
              <select
                value={practiceOrientation}
                onChange={(event) => setPracticeOrientation(event.target.value)}
                className="mt-1 w-full rounded-lg border border-surface-600 bg-surface-800 px-2 py-1.5 text-zinc-200"
              >
                {Object.entries(ORIENTATIONS).map(([id, item]) => (
                  <option key={id} value={id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-sm text-zinc-400">
              Scramble / solver
              <select
                value={scrambleOrientation}
                onChange={(event) => setScrambleOrientation(event.target.value)}
                className="mt-1 w-full rounded-lg border border-surface-600 bg-surface-800 px-2 py-1.5 text-zinc-200"
              >
                {Object.entries(ORIENTATIONS).map(([id, item]) => (
                  <option key={id} value={id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
              Practice matches the case diagrams; the solver keeps the WCA
              competition standard.
            </p>
          </section>

          <section className="rounded-xl border border-surface-700 bg-surface-900 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-300">
              Animation
            </h2>
            <label className="block text-sm text-zinc-400">
              Turn duration · <span className="font-mono text-zinc-200">{turnMs}ms</span>
              <input
                type="range"
                min={20}
                max={400}
                step={10}
                value={turnMs}
                onChange={(event) => setTurnMs(Number(event.target.value))}
                className="mt-1 w-full accent-accent"
              />
            </label>
            <p className="mt-1 text-[11px] text-zinc-600">
              A new keystroke always completes the turn in flight instantly, so nothing
              is dropped however fast you type.
            </p>
          </section>

          <section className="rounded-xl border border-surface-700 bg-surface-900 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-300">
              Practice defaults
            </h2>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-400">
              <input
                type="checkbox"
                checked={cameraRelative}
                onChange={toggleCameraRelative}
                className="mt-0.5 h-4 w-4 accent-accent"
              />
              <span>
                Camera-relative moves
                <span className="block text-[11px] text-zinc-600">
                  Keys turn the faces you can see, whichever way the cube is facing.
                </span>
              </span>
            </label>
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-zinc-400">
              <input
                type="checkbox"
                checked={hintFacelets}
                onChange={toggleHintFacelets}
                className="mt-0.5 h-4 w-4 accent-accent"
              />
              <span>
                Hint facelets
                <span className="block text-[11px] text-zinc-600">
                  Show the colours of the hidden back faces.
                </span>
              </span>
            </label>
          </section>
        </div>
      </div>
    </div>
  );
}
