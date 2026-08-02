import { useCallback, useEffect, useRef, useState } from "react";

const EVENTS = [
  { id: "333", label: "3x3x3", puzzle: "3x3x3" },
  { id: "333fm", label: "3x3x3 Fewest Moves", puzzle: "3x3x3" },
  { id: "222", label: "2x2x2", puzzle: "2x2x2" },
  { id: "444", label: "4x4x4", puzzle: "4x4x4" },
  { id: "pyram", label: "Pyraminx", puzzle: "pyraminx" },
  { id: "skewb", label: "Skewb", puzzle: "skewb" },
];

/** WCA-fair random-state scrambles with a large preview. */
export default function ScramblePage() {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const [event, setEvent] = useState(EVENTS[0]);
  const [scramble, setScramble] = useState("");
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [view, setView] = useState("3D");

  // The player is created asynchronously, so the newest scramble is kept in a
  // ref and applied the moment the element exists.
  const scrambleRef = useRef("");
  scrambleRef.current = scramble;

  useEffect(() => {
    let disposed = false;
    const container = containerRef.current;

    (async () => {
      const { TwistyPlayer } = await import("cubing/twisty");
      if (disposed || !container) return;
      const player = new TwistyPlayer({
        puzzle: event.puzzle,
        alg: scrambleRef.current,
        visualization: view,
        background: "none",
        controlPanel: "none",
        backView: "top-right",
        tempoScale: 4,
      });
      player.style.width = "100%";
      player.style.height = "100%";
      container.appendChild(player);
      playerRef.current = player;
    })();

    return () => {
      disposed = true;
      playerRef.current = null;
      if (container) container.innerHTML = "";
    };
  }, [event.puzzle, view]);

  const generate = useCallback(async () => {
    setLoading(true);
    const { randomScrambleForEvent } = await import("cubing/scramble");
    const alg = await randomScrambleForEvent(event.id);
    const text = alg.toString();
    setScramble(text);
    setHistory((prev) => [text, ...prev].slice(0, 8));
    setLoading(false);
  }, [event.id]);

  useEffect(() => {
    generate();
  }, [generate]);

  useEffect(() => {
    const player = playerRef.current;
    if (player && scramble) player.alg = scramble;
  }, [scramble, view]);

  // Space bar for the next scramble, like a timer would.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        generate();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [generate]);

  return (
    <div className="mx-auto max-w-5xl p-4 pb-16">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Scramble Generator</h1>
          <p className="text-sm text-zinc-500">
            Random-state scrambles from <code className="font-mono">cubing/scramble</code>,
            the same generator the WCA uses.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <div className="flex overflow-hidden rounded-lg border border-surface-700">
            {["3D", "2D"].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                className={`px-3 py-2 text-sm transition ${
                  view === mode
                    ? "bg-surface-800 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-surface-700 bg-surface-850 p-5">
        <p
          className={`min-h-[3.5rem] break-words text-center font-mono text-xl leading-relaxed transition ${
            loading ? "text-zinc-600" : "text-emerald-300"
          }`}
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
          press <kbd className="rounded border border-surface-600 px-1">space</kbd> for the
          next scramble
        </p>
      </div>

      <div
        ref={containerRef}
        className="mt-6 h-[420px] w-full rounded-2xl border border-surface-700 bg-gradient-to-b from-surface-850 to-surface-900 sm:h-[520px]"
      />

      {history.length > 1 && (
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Recent
          </h2>
          <ul className="space-y-1">
            {history.slice(1).map((item, index) => (
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
  );
}
