import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { isTypingTarget } from "../lib/keyboard";
import {
  formatInspection,
  formatMs,
  inspectionPenalty,
} from "../lib/timer";

/**
 * Live readout. Owns its own animation frame and writes straight to the DOM so
 * a running timer never re-renders the page around it.
 */
function Readout({ phase, startedAt, lastMs, inspectionOverrun }) {
  const nodeRef = useRef(null);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return undefined;

    if (phase === "running") {
      let frame = 0;
      const tick = () => {
        node.textContent = formatMs(performance.now() - startedAt, { padded: true });
        frame = requestAnimationFrame(tick);
      };
      tick();
      return () => cancelAnimationFrame(frame);
    }

    if (phase === "inspecting") {
      let frame = 0;
      const tick = () => {
        node.textContent = formatInspection(performance.now() - startedAt);
        frame = requestAnimationFrame(tick);
      };
      tick();
      return () => cancelAnimationFrame(frame);
    }

    node.textContent = formatMs(phase === "holding" ? 0 : lastMs, { padded: true });
    return undefined;
  }, [phase, startedAt, lastMs]);

  const tone =
    phase === "holding"
      ? "text-emerald-400"
      : phase === "inspecting"
        ? inspectionOverrun
          ? "text-red-400"
          : "text-amber-300"
        : phase === "running"
          ? "text-zinc-100"
          : "text-zinc-300";

  return (
    <span
      ref={nodeRef}
      className={`block font-mono tabular-nums leading-none transition-colors ${tone} ${
        phase === "inspecting" ? "text-[6rem]" : "text-6xl sm:text-7xl"
      }`}
    >
      00:00.000
    </span>
  );
}

const HINTS = {
  idle: "hold space (or press and hold here) — release to start",
  holding: "release to start",
  inspecting: "hold space to get ready",
  running: "press any key to stop",
};

/**
 * Standard speedcubing trigger: hold to arm (green), release to start, any key
 * to stop. With inspection on, the first hold-and-release starts the 15 second
 * countdown and the second one starts the solve.
 *
 * `stopOnAnyKey` is false when the user is solving the virtual cube from the
 * keyboard — their turns must reach the cube instead of stopping the clock, so
 * the run ends when the cube is solved (via the imperative `stop()`) or when
 * they press Escape to abandon it.
 */
const SolveTimer = forwardRef(function SolveTimer(
  { inspection, stopOnAnyKey = true, hint = null, onSolve, onPhaseChange },
  ref,
) {
  const [phase, setPhase] = useState("idle");
  const [lastMs, setLastMs] = useState(null);
  const [startedAt, setStartedAt] = useState(0);
  const [overrun, setOverrun] = useState(false);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const startedAtRef = useRef(0);
  const heldFromRef = useRef("idle");
  const penaltyRef = useRef(null);
  // After a stop, ignore input until every key/pointer has been released, so
  // the keystroke that stopped the timer cannot immediately arm the next one.
  const blockedRef = useRef(false);

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  // Flag the inspection overrun for the colour change without re-rendering the
  // readout on every frame.
  useEffect(() => {
    if (phase !== "inspecting") {
      setOverrun(false);
      return undefined;
    }
    const id = setInterval(() => {
      setOverrun(Boolean(inspectionPenalty(performance.now() - startedAtRef.current)));
    }, 200);
    return () => clearInterval(id);
  }, [phase]);

  const stop = useCallback(() => {
    if (phaseRef.current !== "running") return null;
    const ms = performance.now() - startedAtRef.current;
    const penalty = penaltyRef.current;
    blockedRef.current = true;
    penaltyRef.current = null;
    setLastMs(ms);
    setPhase("idle");
    onSolve?.({ ms, plus2: penalty === "plus2", dnf: penalty === "dnf" });
    return ms;
  }, [onSolve]);

  /** Abandon the attempt without recording anything. */
  const cancel = useCallback(() => {
    blockedRef.current = true;
    penaltyRef.current = null;
    setPhase("idle");
  }, []);

  useImperativeHandle(ref, () => ({ stop, cancel, phase: () => phaseRef.current }), [stop, cancel]);

  const press = useCallback(() => {
    if (phaseRef.current === "running") {
      stop();
      return;
    }
    if (blockedRef.current) return;
    if (phaseRef.current === "idle" || phaseRef.current === "inspecting") {
      heldFromRef.current = phaseRef.current;
      setPhase("holding");
    }
  }, [stop]);

  const release = useCallback(() => {
    if (phaseRef.current !== "holding") return;

    if (heldFromRef.current === "idle" && inspection) {
      startedAtRef.current = performance.now();
      setStartedAt(startedAtRef.current);
      setPhase("inspecting");
      return;
    }

    penaltyRef.current =
      heldFromRef.current === "inspecting"
        ? inspectionPenalty(performance.now() - startedAtRef.current)
        : null;
    startedAtRef.current = performance.now();
    setStartedAt(startedAtRef.current);
    setPhase("running");
  }, [inspection]);

  // ---- keyboard ------------------------------------------------------------
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.repeat || isTypingTarget(event.target)) return;

      if (phaseRef.current === "running") {
        if (stopOnAnyKey) {
          event.preventDefault();
          stop();
          return;
        }
        // Keyboard solve: only Escape gives up. Everything else belongs to the
        // cube, and the solve ends when the cube does.
        if (event.code === "Escape") {
          event.preventDefault();
          cancel();
        }
        return;
      }
      if (event.code !== "Space") return;
      event.preventDefault(); // space must not scroll the page
      press();
    };

    const onKeyUp = (event) => {
      if (isTypingTarget(event.target)) return;
      blockedRef.current = false;
      if (event.code === "Space") {
        event.preventDefault();
        release();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [press, release, stop, cancel, stopOnAnyKey]);

  // Losing focus mid-hold would otherwise strand the timer armed forever.
  useEffect(() => {
    const onBlur = () => {
      blockedRef.current = false;
      if (phaseRef.current === "holding") setPhase(heldFromRef.current);
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, []);

  const touchProps = {
    onPointerDown: (event) => {
      event.preventDefault();
      press();
    },
    onPointerUp: (event) => {
      event.preventDefault();
      blockedRef.current = false;
      release();
    },
    onPointerCancel: () => {
      blockedRef.current = false;
      if (phaseRef.current === "holding") setPhase(heldFromRef.current);
    },
  };

  return (
    <>
      <div
        {...touchProps}
        role="timer"
        aria-live="off"
        aria-label="Solve timer"
        className={`select-none touch-none rounded-2xl border px-6 py-10 text-center transition-colors ${
          phase === "holding"
            ? "border-emerald-500/60 bg-emerald-500/10"
            : phase === "inspecting"
              ? "border-amber-500/50 bg-amber-500/5"
              : "border-surface-700 bg-surface-850"
        }`}
      >
        <Readout
          phase={phase}
          startedAt={startedAt}
          lastMs={lastMs}
          inspectionOverrun={overrun}
        />
        <p className="mt-4 text-xs text-zinc-500">{hint ?? HINTS[phase]}</p>
      </div>

      {/* While solving a real cube, a tap anywhere stops the timer. */}
      {phase === "running" && stopOnAnyKey && (
        <div
          className="fixed inset-0 z-20 touch-none"
          onPointerDown={(event) => {
            event.preventDefault();
            stop();
          }}
          aria-hidden="true"
        />
      )}
    </>
  );
});

export default SolveTimer;
