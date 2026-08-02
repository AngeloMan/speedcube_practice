import { useEffect, useState } from "react";
import { keyFromEvent } from "../components/TwistyViewer";
import { ACTIONS, DEFAULT_BINDINGS, useStore } from "../store";

const GROUPS = ["Layers", "Slices", "Rotations"];

function BindingRow({ action, boundKey, capturing, onCapture, onClear }) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2 odd:bg-surface-850/60">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-zinc-200">{action.label}</div>
        <div className="font-mono text-[11px] text-zinc-600">{action.note}</div>
      </div>
      <button
        type="button"
        onClick={() => onCapture(action.id)}
        className={`min-w-[84px] rounded-lg border px-3 py-1.5 font-mono text-sm uppercase transition ${
          capturing
            ? "animate-pulse border-accent bg-accent/20 text-accent-soft"
            : boundKey
              ? "border-surface-600 bg-surface-800 text-zinc-200 hover:border-accent"
              : "border-dashed border-surface-600 text-zinc-600 hover:border-accent"
        }`}
      >
        {capturing ? "press…" : boundKey || "unset"}
      </button>
      <button
        type="button"
        onClick={() => onClear(action.id)}
        disabled={!boundKey}
        className="text-zinc-600 transition hover:text-red-400 disabled:opacity-30"
        aria-label={`Clear binding for ${action.label}`}
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
            which action fires.
          </p>

          {GROUPS.map((group) => (
            <div key={group} className="mb-5 last:mb-0">
              <h3 className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                {group}
              </h3>
              {ACTIONS.filter((action) => action.group === group).map((action) => (
                <BindingRow
                  key={action.id}
                  action={action}
                  boundKey={bindings[action.id]}
                  capturing={capturing === action.id}
                  onCapture={setCapturing}
                  onClear={(id) => setBinding(id, "")}
                />
              ))}
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
            {wideModifier === "ctrl" && (
              <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-200/90">
                Browsers reserve <span className="font-mono">Ctrl+W</span> for “close
                tab” and will not let a page intercept it, so the wide{" "}
                <span className="font-mono">u</span> turn cannot fire on{" "}
                <span className="font-mono">Ctrl+W</span>. Switch to Alt if you use wide
                U turns often.
              </p>
            )}
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
