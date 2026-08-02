import { useState } from "react";
import { useStore } from "../store";
import { effectiveMs, formatMs, formatSolve, sessionStats } from "../lib/timer";

function Stat({ label, value, accent = false }) {
  return (
    <div className="rounded-lg bg-surface-800 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div
        className={`font-mono text-lg tabular-nums ${
          accent ? "text-emerald-300" : "text-zinc-200"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function PenaltyButton({ active, onClick, children, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded px-1.5 py-0.5 font-mono text-[11px] transition ${
        active
          ? "bg-amber-500/80 text-surface-950"
          : "text-zinc-600 hover:bg-surface-700 hover:text-zinc-300"
      }`}
    >
      {children}
    </button>
  );
}

/** Session panel: PB, Ao5, Ao12 and the editable solve history. */
export default function SessionStats() {
  const solves = useStore((s) => s.solves);
  const removeSolve = useStore((s) => s.removeSolve);
  const setSolvePenalty = useStore((s) => s.setSolvePenalty);
  const clearSolves = useStore((s) => s.clearSolves);
  const [confirmClear, setConfirmClear] = useState(false);

  const stats = sessionStats(solves);
  const best = stats.best;

  const cycle = (solve, penalty) =>
    setSolvePenalty(solve.id, solve[penalty === "plus2" ? "plus2" : "dnf"] ? "ok" : penalty);

  return (
    <section className="rounded-2xl border border-surface-700 bg-surface-850 p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
          Session
        </h2>
        <span className="font-mono text-xs text-zinc-600">{stats.count} solves</span>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Best" value={formatMs(stats.best)} accent />
        <Stat label="Mean" value={formatMs(stats.mean)} />
        <Stat label="Ao5" value={formatMs(stats.ao5)} />
        <Stat label="Ao12" value={formatMs(stats.ao12)} />
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
            History
          </h3>
          {stats.count > 0 && (
            <button
              type="button"
              onClick={() => {
                if (confirmClear) {
                  clearSolves();
                  setConfirmClear(false);
                } else {
                  setConfirmClear(true);
                }
              }}
              onBlur={() => setConfirmClear(false)}
              className={`text-[11px] transition ${
                confirmClear ? "text-red-400" : "text-zinc-600 hover:text-zinc-300"
              }`}
            >
              {confirmClear ? "tap again to clear" : "clear"}
            </button>
          )}
        </div>

        {stats.count === 0 ? (
          <p className="rounded-lg border border-dashed border-surface-700 px-3 py-6 text-center text-xs text-zinc-600">
            No solves yet.
          </p>
        ) : (
          <ol className="max-h-72 space-y-0.5 overflow-y-auto pr-1">
            {solves.map((solve, index) => {
              const isBest = Number.isFinite(best) && effectiveMs(solve) === best;
              return (
                <li
                  key={solve.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm odd:bg-surface-800/60"
                >
                  <span className="w-6 shrink-0 text-right font-mono text-[11px] text-zinc-600">
                    {solves.length - index}
                  </span>
                  <span
                    className={`flex-1 font-mono tabular-nums ${
                      solve.dnf
                        ? "text-red-400/80 line-through"
                        : isBest
                          ? "text-emerald-300"
                          : "text-zinc-200"
                    }`}
                    title={solve.scramble || undefined}
                  >
                    {formatSolve(solve)}
                  </span>
                  <PenaltyButton
                    active={solve.plus2}
                    onClick={() => cycle(solve, "plus2")}
                    title="Toggle +2"
                  >
                    +2
                  </PenaltyButton>
                  <PenaltyButton
                    active={solve.dnf}
                    onClick={() => cycle(solve, "dnf")}
                    title="Toggle DNF"
                  >
                    DNF
                  </PenaltyButton>
                  <button
                    type="button"
                    onClick={() => removeSolve(solve.id)}
                    title="Delete solve"
                    aria-label={`Delete solve ${solves.length - index}`}
                    className="text-zinc-600 transition hover:text-red-400"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
