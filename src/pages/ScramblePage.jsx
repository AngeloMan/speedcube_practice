import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SolveTimer from "../components/SolveTimer";
import SessionStats from "../components/SessionStats";
import TwistyViewer from "../components/TwistyViewer";
import { isTypingTarget } from "../lib/keyboard";
import { FULL_MASK, applyAlg, isSolved } from "../lib/cube";
import { formatMs } from "../lib/timer";
import { useStore } from "../store";

const EVENTS = [
  { id: "333", label: "3x3x3", puzzle: "3x3x3" },
  { id: "333fm", label: "3x3x3 Fewest Moves", puzzle: "3x3x3" },
  { id: "222", label: "2x2x2", puzzle: "2x2x2" },
  { id: "444", label: "4x4x4", puzzle: "4x4x4" },
  { id: "pyram", label: "Pyraminx", puzzle: "pyraminx" },
  { id: "skewb", label: "Skewb", puzzle: "skewb" },
];

/** WCA-fair random-state scrambles, with an optional timed solve mode. */
export default function ScramblePage() {
  const viewerRef = useRef(null);
  const timerRef = useRef(null);
  const [event, setEvent] = useState(EVENTS[0]);
  const [scramble, setScramble] = useState("");
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState([]);
  const [phase, setPhase] = useState("idle");
  const [moveCount, setMoveCount] = useState(0);
  const [solvedBanner, setSolvedBanner] = useState(null);

  const solveMode = useStore((s) => s.solveMode);
  const toggleSolveMode = useStore((s) => s.toggleSolveMode);
  const solveInput = useStore((s) => s.solveInput);
  const setSolveInput = useStore((s) => s.setSolveInput);
  const inspection = useStore((s) => s.inspection);
  const toggleInspection = useStore((s) => s.toggleInspection);
  const addSolve = useStore((s) => s.addSolve);
  const setTimerActive = useStore((s) => s.setTimerActive);
  const orientation = useStore((s) => s.scrambleOrientation);

  const scrambleRef = useRef("");
  scrambleRef.current = scramble;

  // Keyboard solving is only meaningful on a 3x3x3, which is what the state
  // tracker models.
  const canSolveByKeyboard = event.puzzle === "3x3x3";
  const keyboardSolving = solveMode && solveInput === "keyboard" && canSolveByKeyboard;

  const generate = useCallback(async () => {
    setLoading(true);
    const { randomScrambleForEvent } = await import("cubing/scramble");
    const alg = await randomScrambleForEvent(event.id);
    const text = alg.toString();
    setScramble(text);
    setRecent((prev) => [text, ...prev].slice(0, 8));
    setLoading(false);
  }, [event.id]);

  useEffect(() => {
    generate();
  }, [generate]);

  // ---- live cube state -----------------------------------------------------
  // The player animates; this is the authoritative permutation, advanced move
  // by move so a solve can be detected the instant the last turn lands.
  const stateRef = useRef(FULL_MASK);
  const solvedRef = useRef(false);

  useEffect(() => {
    if (!scramble || !canSolveByKeyboard) {
      stateRef.current = FULL_MASK;
      solvedRef.current = false;
      setMoveCount(0);
      return;
    }
    stateRef.current = applyAlg(FULL_MASK, scramble);
    solvedRef.current = false;
    setMoveCount(0);
    // The banner deliberately survives the next scramble being cut — it is
    // cleared when the next attempt begins, not a second after you finish.
  }, [scramble, canSolveByKeyboard]);

  const handleSolve = useCallback(
    (solve) => {
      addSolve({ ...solve, scramble: scrambleRef.current, event: event.id });
      generate();
    },
    [addSolve, generate, event.id],
  );

  const handleMove = useCallback(
    (notation, meta) => {
      if (!canSolveByKeyboard) return;
      stateRef.current = applyAlg(stateRef.current, notation);
      setMoveCount((n) => (meta?.undo ? Math.max(0, n - 1) : n + 1));

      const nowSolved = isSolved(stateRef.current);
      if (nowSolved && !solvedRef.current) {
        solvedRef.current = true;
        // Stopping the timer records the solve through onSolve below, and
        // returns the elapsed time when one was actually running.
        const elapsed = timerRef.current?.stop() ?? null;
        setSolvedBanner({ ms: elapsed });
        if (elapsed === null) generate(); // untimed: still line up the next one
      } else if (!nowSolved) {
        solvedRef.current = false;
      }
    },
    [canSolveByKeyboard, generate],
  );

  // Space cuts a new scramble whenever the timer is not claiming it.
  useEffect(() => {
    if (solveMode) return undefined;
    const onKeyDown = (e) => {
      if (e.code === "Space" && !isTypingTarget(e.target)) {
        e.preventDefault();
        generate();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [generate, solveMode]);

  /**
   * The cube's keys are muted only while a *physical* solve is being timed —
   * during a keyboard solve they are the whole point.
   */
  const handlePhaseChange = useCallback(
    (next) => {
      setPhase(next);
      // A new attempt clears the previous result.
      if (next === "holding" || next === "running") setSolvedBanner(null);
      const busy = next === "running" || next === "inspecting";
      setTimerActive(busy && solveInput === "physical");
    },
    [setTimerActive, solveInput],
  );

  useEffect(() => () => setTimerActive(false), [setTimerActive]);

  const solving = phase === "running";
  const hideScramble = solving && solveInput === "physical";

  const timerHint = useMemo(() => {
    if (!keyboardSolving) return null;
    if (phase === "running") return "solve the cube with the keyboard — the timer stops itself";
    return "hold space and release, then solve with the keyboard";
  }, [keyboardSolving, phase]);

  return (
    <div className="mx-auto max-w-6xl p-4 pb-16">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Scramble Generator</h1>
          <p className="text-sm text-zinc-500">
            Random-state scrambles from <code className="font-mono">cubing/scramble</code>,
            the same generator the WCA uses.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleSolveMode}
            aria-pressed={solveMode}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              solveMode
                ? "bg-emerald-500 text-surface-950"
                : "border border-surface-700 text-zinc-300 hover:bg-surface-800"
            }`}
          >
            {solveMode ? "◉ Solve mode" : "○ Solve mode"}
          </button>
          <select
            value={event.id}
            onChange={(e) => setEvent(EVENTS.find((x) => x.id === e.target.value))}
            className="rounded-lg border border-surface-700 bg-surface-850 px-3 py-2 text-sm text-zinc-200"
          >
            {EVENTS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={solveMode ? "grid gap-6 lg:grid-cols-[1fr_320px]" : ""}>
        <div className="min-w-0">
          <div className="rounded-2xl border border-surface-700 bg-surface-850 p-5">
            <p
              className={`min-h-[3.5rem] break-words text-center font-mono text-xl leading-relaxed transition ${
                loading ? "text-zinc-600" : "text-emerald-300"
              } ${hideScramble ? "opacity-20" : ""}`}
            >
              {loading ? "generating…" : scramble}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={generate}
                disabled={loading}
                className="rounded-lg bg-accent px-5 py-2.5 font-medium text-white transition hover:bg-accent-soft disabled:opacity-50"
              >
                ↺ New Scramble
              </button>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(scramble)}
                className="rounded-lg border border-surface-600 px-5 py-2.5 text-zinc-300 transition hover:bg-surface-800"
              >
                Copy
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-zinc-600">
              {solveMode ? (
                <>
                  hold <kbd className="rounded border border-surface-600 px-1">space</kbd>{" "}
                  and release to start
                  {solveInput === "physical" ? " · any key stops" : " · solve to stop"}
                </>
              ) : (
                <>
                  press <kbd className="rounded border border-surface-600 px-1">space</kbd>{" "}
                  for the next scramble
                </>
              )}
            </p>
          </div>

          {solveMode && (
            <div className="mt-6">
              <SolveTimer
                ref={timerRef}
                inspection={inspection}
                stopOnAnyKey={solveInput === "physical"}
                hint={timerHint}
                onSolve={handleSolve}
                onPhaseChange={handlePhaseChange}
              />

              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm">
                <div className="flex overflow-hidden rounded-lg border border-surface-700">
                  {[
                    { id: "physical", label: "Physical cube" },
                    { id: "keyboard", label: "Keyboard solve" },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSolveInput(option.id)}
                      disabled={option.id === "keyboard" && !canSolveByKeyboard}
                      title={
                        option.id === "keyboard" && !canSolveByKeyboard
                          ? "Keyboard solving is available for the 3x3x3"
                          : undefined
                      }
                      className={`px-3 py-1.5 transition disabled:opacity-40 ${
                        solveInput === option.id
                          ? "bg-surface-800 text-zinc-100"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={inspection}
                  onClick={toggleInspection}
                  className={`rounded-lg border px-3 py-1.5 transition ${
                    inspection
                      ? "border-amber-500/60 bg-amber-500/15 text-amber-200"
                      : "border-surface-700 text-zinc-400 hover:bg-surface-800"
                  }`}
                >
                  {inspection ? "◉" : "○"} 15s inspection
                </button>
              </div>
            </div>
          )}

          {solvedBanner && (
            <div
              role="status"
              className="mt-6 flex flex-wrap items-center justify-center gap-4 rounded-2xl border border-emerald-500/50 bg-emerald-500/10 px-5 py-4 text-center animate-pop-in"
            >
              <span className="text-lg font-semibold text-emerald-300">Cube solved! 🎉</span>
              <span className="text-sm text-zinc-400">
                {solvedBanner.ms === null
                  ? "Untimed solve."
                  : `${formatMs(solvedBanner.ms)} — logged to your session.`}
              </span>
              <button
                type="button"
                onClick={generate}
                className="rounded-lg bg-emerald-500 px-4 py-1.5 text-sm font-medium text-surface-950 transition hover:bg-emerald-400"
              >
                ↺ Next scramble
              </button>
            </div>
          )}

          {/* The preview is hidden mid-solve only when solving a real cube —
              during a keyboard solve it is the thing being solved. */}
          <div
            className={`relative mt-6 h-[460px] w-full overflow-hidden rounded-2xl border border-surface-700 bg-gradient-to-b from-surface-850 to-surface-900 transition-opacity sm:h-[520px] ${
              hideScramble ? "pointer-events-none opacity-10" : "opacity-100"
            }`}
          >
            <div className="absolute inset-0">
              <TwistyViewer
                ref={viewerRef}
                puzzle={event.puzzle}
                setupAlg={scramble}
                orientation={orientation}
                stickering="full"
                backView="top-right"
                keyboardEnabled={!solveMode || solveInput === "keyboard"}
                onMove={handleMove}
              />
            </div>
            {keyboardSolving && (
              <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-surface-950/70 px-3 py-2 font-mono text-[11px] text-zinc-500">
                {moveCount} moves · Ctrl+Z undoes
              </div>
            )}
          </div>

          {!solveMode && recent.length > 1 && (
            <section className="mt-6">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Recent
              </h2>
              <ul className="space-y-1">
                {recent.slice(1).map((item, index) => (
                  <li
                    key={`${item}-${index}`}
                    className="truncate rounded-lg bg-surface-850 px-3 py-2 font-mono text-xs text-zinc-500"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {solveMode && (
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <SessionStats />
          </aside>
        )}
      </div>
    </div>
  );
}
