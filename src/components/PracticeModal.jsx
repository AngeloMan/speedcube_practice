import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TwistyViewer from "./TwistyViewer";
import CubeThumb from "./CubeThumb";
import { invertAlg } from "../lib/moves";
import { ACTIONS, useStore } from "../store";

const STICKERINGS = [
  { id: "LS", label: "Last slot (F2L)" },
  { id: "OLL", label: "OLL" },
  { id: "PLL", label: "PLL" },
  { id: "F2L", label: "F2L" },
  { id: "full", label: "Full colour" },
];

const DEFAULT_STICKERING = { f2l: "LS", oll: "OLL", pll: "PLL" };

function FaceChip({ label, face }) {
  return (
    <div className="flex flex-col items-center rounded-md bg-surface-800 px-2.5 py-1.5">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
      <span className="font-mono text-sm font-semibold text-accent-soft">{face}</span>
    </div>
  );
}

/**
 * The large interactive practice modal. Exactly one <twisty-player> exists in
 * the app and it lives here — the grid behind it stays pure SVG.
 */
export default function PracticeModal({ caseData, category, onClose, onNavigate }) {
  const viewerRef = useRef(null);
  const dialogRef = useRef(null);
  const [stickering, setStickering] = useState(DEFAULT_STICKERING[category] ?? "full");
  const [history, setHistory] = useState([]);
  const [frame, setFrame] = useState({ U: "U", F: "F", R: "R" });

  const turnMs = useStore((s) => s.turnMs);
  const setTurnMs = useStore((s) => s.setTurnMs);
  const cameraRelative = useStore((s) => s.cameraRelative);
  const toggleCameraRelative = useStore((s) => s.toggleCameraRelative);
  const hintFacelets = useStore((s) => s.hintFacelets);
  const toggleHintFacelets = useStore((s) => s.toggleHintFacelets);
  const bindings = useStore((s) => s.bindings);

  useEffect(() => {
    setStickering(DEFAULT_STICKERING[category] ?? "full");
  }, [category]);

  // The setup that puts the cube into the case is simply the inverse algorithm.
  const setupAlg = useMemo(() => invertAlg(caseData.alg), [caseData.alg]);

  useEffect(() => {
    setHistory([]);
  }, [caseData.id]);

  // Escape closes, arrows step through cases.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowRight" && !event.ctrlKey) {
        onNavigate?.(1);
      } else if (event.key === "ArrowLeft" && !event.ctrlKey) {
        onNavigate?.(-1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, onNavigate]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const handleMove = useCallback((notation) => {
    setHistory((prev) => [...prev.slice(-40), notation]);
  }, []);

  const reset = () => {
    viewerRef.current?.reset();
    setHistory([]);
  };

  const keyFor = (id) => bindings[id];

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${caseData.title} practice`}
        tabIndex={-1}
        className="relative flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-surface-700 bg-surface-900 shadow-2xl outline-none animate-pop-in"
      >
        {/* Close button: explicit handler, above everything. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close practice view"
          className="absolute right-3 top-3 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-surface-600 bg-surface-800/90 text-xl leading-none text-zinc-300 transition hover:bg-red-500/90 hover:text-white focus:outline-none focus:ring-2 focus:ring-accent"
        >
          ✕
        </button>

        <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-surface-700 px-6 py-4 pr-16">
          <span className="rounded-md bg-accent/15 px-2 py-0.5 font-mono text-sm font-semibold text-accent-soft">
            #{caseData.number}
          </span>
          <h2 className="text-xl font-semibold text-zinc-100">{caseData.title}</h2>
          <span className="text-sm text-zinc-500">{caseData.group}</span>
          <code className="ml-auto rounded-lg bg-surface-850 px-3 py-1.5 font-mono text-base text-emerald-300">
            {caseData.display}
          </code>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:flex-row lg:overflow-hidden">
          {/* 3D viewer: at least 600x600, or 80% of the modal.
              The viewer is positioned absolutely rather than sized with
              `h-full`: a percentage height resolves against the parent's
              *computed* height, which is `auto` here, so `h-full` would
              collapse to 0 and the player would never build. Absolute insets
              resolve against the parent's used box, which honours min-height. */}
          <div className="relative min-h-[min(600px,70vh)] flex-1 overflow-hidden rounded-xl border border-surface-700 bg-gradient-to-b from-surface-850 to-surface-900 lg:min-w-[600px]">
            <div className="absolute inset-0">
              <TwistyViewer
                ref={viewerRef}
                setupAlg={setupAlg}
                stickering={stickering}
                onMove={handleMove}
                onFrameChange={setFrame}
              />
            </div>
            <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-surface-950/70 px-3 py-2 text-[11px] text-zinc-500">
              drag to orbit · keys turn the faces you see
            </div>
          </div>

          <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-80 lg:overflow-y-auto">
            <section className="rounded-xl border border-surface-700 bg-surface-850 p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Spatial reference
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <FaceChip label="Screen up" face={frame.U} />
                <FaceChip label="Facing you" face={frame.F} />
                <FaceChip label="Screen right" face={frame.R} />
              </div>
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-zinc-400">
                <input
                  type="checkbox"
                  checked={cameraRelative}
                  onChange={toggleCameraRelative}
                  className="h-4 w-4 accent-accent"
                />
                Camera-relative moves
              </label>
            </section>

            <section className="rounded-xl border border-surface-700 bg-surface-850 p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Case preview
              </h3>
              <div className="flex items-center gap-4">
                <CubeThumb stickers={caseData.stickers} size={92} />
                <div className="space-y-2 text-sm">
                  <button
                    type="button"
                    onClick={() => viewerRef.current?.playAlg(caseData.alg)}
                    className="w-full rounded-lg bg-accent px-3 py-2 font-medium text-white transition hover:bg-accent-soft"
                  >
                    ▶ Play solution
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    className="w-full rounded-lg border border-surface-600 px-3 py-2 text-zinc-300 transition hover:bg-surface-800"
                  >
                    ↺ Reset to case
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-surface-700 bg-surface-850 p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Display
              </h3>
              <label className="block text-sm text-zinc-400">
                Masking
                <select
                  value={stickering}
                  onChange={(event) => setStickering(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-surface-600 bg-surface-800 px-2 py-1.5 text-zinc-200"
                >
                  {STICKERINGS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block text-sm text-zinc-400">
                Turn speed · <span className="font-mono text-zinc-300">{turnMs}ms</span>
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
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-zinc-400">
                <input
                  type="checkbox"
                  checked={hintFacelets}
                  onChange={toggleHintFacelets}
                  className="h-4 w-4 accent-accent"
                />
                Hint facelets
              </label>
            </section>

            <section className="rounded-xl border border-surface-700 bg-surface-850 p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Keys
              </h3>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {ACTIONS.filter((action) => keyFor(action.id)).map((action) => (
                  <div key={action.id} className="flex items-center gap-2">
                    <kbd className="min-w-[22px] rounded border border-surface-600 bg-surface-800 px-1.5 py-0.5 text-center font-mono uppercase text-zinc-300">
                      {keyFor(action.id)}
                    </kbd>
                    <span className="truncate text-zinc-500">{action.id}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
                Shift = prime · Ctrl = wide · Ctrl+Shift = wide prime. ← → step
                through cases, Esc closes.
              </p>
            </section>

            <section className="rounded-xl border border-surface-700 bg-surface-850 p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Your moves
              </h3>
              <p className="min-h-[2.5rem] break-words font-mono text-sm text-zinc-300">
                {history.length ? history.join(" ") : <span className="text-zinc-600">—</span>}
              </p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
