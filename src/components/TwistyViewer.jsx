import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { DEFAULT_CAMERA, useStore } from "../store";
import { IDENTITY_FRAME, applyModifiers, screenFrame, toCubeNotation } from "../lib/moves";

/** Physical key for an event, so Shift/Alt never change which key was pressed. */
export function keyFromEvent(event) {
  if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3).toLowerCase();
  if (/^Digit\d$/.test(event.code)) return event.code.slice(5);
  if (/^Numpad\d$/.test(event.code)) return event.code.slice(6);
  return (event.key ?? "").toLowerCase();
}

/**
 * Resolve once the element has a real box.
 *
 * cubing.js gates all scene construction on an IntersectionObserver that
 * requires `intersectionRect.height > 0`. Mounting into a container that is
 * still 0px — which is normal for one frame inside a modal that is animating
 * in, or permanently if a percentage-height chain collapses — produces a player
 * that never builds anything and stays blank forever. So we wait for the box
 * before constructing it. `holder` receives the observer so the caller can
 * disconnect it if the component unmounts while we are still waiting.
 */
function whenSized(element, holder) {
  const hasBox = () => element.clientWidth > 0 && element.clientHeight > 0;
  if (hasBox()) return Promise.resolve();
  return new Promise((resolve) => {
    const observer = new ResizeObserver(() => {
      if (!hasBox()) return;
      observer.disconnect();
      resolve();
    });
    observer.observe(element);
    holder.observer = observer;
  });
}

/** Exactly one WebGL cube should ever be live; this keeps us honest in dev. */
let liveInstances = 0;

const isTypingTarget = (target) =>
  target instanceof HTMLElement &&
  (target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable);

/**
 * The one and only WebGL cube in the app.
 *
 * Owns the camera (cubing.js drag input is switched off so that we always know
 * the exact orbit angles), translates keystrokes through that camera, and
 * flushes any in-flight animation the moment another key arrives.
 */
const TwistyViewer = forwardRef(function TwistyViewer(
  { setupAlg = "", stickering = "full", onMove, onFrameChange, keyboardEnabled = true },
  ref,
) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [camera, setCamera] = useState(DEFAULT_CAMERA);

  const turnMs = useStore((s) => s.turnMs);
  const bindings = useStore((s) => s.bindings);
  const wideModifier = useStore((s) => s.wideModifier);
  const hintFacelets = useStore((s) => s.hintFacelets);
  const cameraRelative = useStore((s) => s.cameraRelative);

  const frame = cameraRelative
    ? screenFrame(camera.latitude, camera.longitude)
    : IDENTITY_FRAME;

  // Keep the latest frame in a ref so the key handler never goes stale.
  const frameRef = useRef(frame);
  frameRef.current = frame;

  // ---- player lifecycle ----------------------------------------------------
  useEffect(() => {
    let disposed = false;
    const container = containerRef.current;
    const pending = { observer: null };
    if (!container) return undefined;

    liveInstances += 1;
    if (liveInstances > 1 && import.meta.env?.DEV) {
      console.warn(
        `[TwistyViewer] ${liveInstances} players are mounted at once. Only one ` +
          "WebGL cube should be live; check that the previous view unmounted.",
      );
    }

    (async () => {
      const [{ TwistyPlayer }] = await Promise.all([
        import("cubing/twisty"),
        whenSized(container, pending),
      ]);
      if (disposed || !container) return;

      const player = new TwistyPlayer({
        puzzle: "3x3x3",
        alg: "",
        visualization: "3D",
        background: "none",
        controlPanel: "none",
        backView: "none",
        hintFacelets: "none",
        experimentalDragInput: "none", // we drive the camera ourselves
        cameraLatitude: DEFAULT_CAMERA.latitude,
        cameraLongitude: DEFAULT_CAMERA.longitude,
        cameraLatitudeLimit: 90,
        tempoScale: 20,
      });
      // Fill the host box, but leave `display` alone — see the note in
      // index.css about `:host { display: grid }` and `contain: size`.
      player.style.width = "100%";
      player.style.height = "100%";

      container.appendChild(player);
      playerRef.current = player;
      setReady(true);

      // Nudge the renderer once the element has been through a real layout
      // pass, so the canvas picks up the final container size.
      requestAnimationFrame(() => {
        if (!disposed) window.dispatchEvent(new Event("resize"));
      });
    })();

    return () => {
      disposed = true;
      liveInstances -= 1;
      pending.observer?.disconnect();
      playerRef.current = null;
      setReady(false);
      container.innerHTML = "";
    };
  }, []);

  // ---- reactive config -----------------------------------------------------
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    player.experimentalSetupAlg = setupAlg || "";
    player.alg = "";
  }, [ready, setupAlg]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    player.experimentalStickering = stickering;
  }, [ready, stickering]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    player.tempoScale = Math.max(0.5, 1000 / Math.max(10, turnMs));
  }, [ready, turnMs]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    player.hintFacelets = hintFacelets ? "floating" : "none";
  }, [ready, hintFacelets]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    player.cameraLatitude = camera.latitude;
    player.cameraLongitude = camera.longitude;
  }, [ready, camera]);

  useEffect(() => {
    onFrameChange?.(frame);
  }, [frame.U, frame.F, frame.R]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- move application ----------------------------------------------------

  /** Complete whatever is animating right now, with no transition. */
  const flush = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    try {
      player.jumpToEnd({ flash: false });
    } catch {
      /* older builds settle on their own */
    }
  }, []);

  const applyNotation = useCallback(
    (notation) => {
      const player = playerRef.current;
      if (!player || !notation) return;
      flush();
      player.experimentalAddMove(notation, { cancel: false });
      onMove?.(notation);
    },
    [flush, onMove],
  );

  useImperativeHandle(
    ref,
    () => ({
      player: () => playerRef.current,
      applyMove: applyNotation,
      /** Screen-relative move, translated through the live camera. */
      applyScreenMove: (token) => applyNotation(toCubeNotation(token, frameRef.current)),
      playAlg: (alg) => {
        const player = playerRef.current;
        if (!player) return;
        player.alg = alg;
        player.jumpToStart({ flash: false });
        player.play();
      },
      reset: () => {
        const player = playerRef.current;
        if (!player) return;
        player.alg = "";
        player.jumpToStart({ flash: false });
      },
      resetCamera: () => setCamera(DEFAULT_CAMERA),
    }),
    [applyNotation],
  );

  // ---- keyboard ------------------------------------------------------------
  useEffect(() => {
    if (!keyboardEnabled) return undefined;

    const onKeyDown = (event) => {
      if (event.repeat || isTypingTarget(event.target)) return;
      const key = keyFromEvent(event);
      const action = Object.keys(bindings).find((id) => bindings[id] && bindings[id] === key);
      if (!action) return;

      const wide =
        wideModifier === "alt" ? event.altKey : event.ctrlKey || event.metaKey;
      const otherModifier =
        wideModifier === "alt" ? event.ctrlKey || event.metaKey : event.altKey;
      if (otherModifier) return;

      event.preventDefault();
      const screenMove = applyModifiers(action, { shift: event.shiftKey, wide });
      applyNotation(toCubeNotation(screenMove, frameRef.current));
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [bindings, wideModifier, keyboardEnabled, applyNotation]);

  // ---- camera drag ---------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let pointerId = null;
    let last = null;

    const onPointerDown = (event) => {
      if (event.button !== 0) return;
      pointerId = event.pointerId;
      last = { x: event.clientX, y: event.clientY };
      container.setPointerCapture(pointerId);
      container.style.cursor = "grabbing";
    };

    const onPointerMove = (event) => {
      if (event.pointerId !== pointerId || !last) return;
      const dx = event.clientX - last.x;
      const dy = event.clientY - last.y;
      last = { x: event.clientX, y: event.clientY };
      setCamera((prev) => ({
        latitude: Math.max(-89, Math.min(89, prev.latitude + dy * 0.45)),
        longitude: (((prev.longitude - dx * 0.45) % 360) + 360) % 360,
      }));
    };

    const onPointerUp = (event) => {
      if (event.pointerId !== pointerId) return;
      container.releasePointerCapture(pointerId);
      pointerId = null;
      last = null;
      container.style.cursor = "grab";
    };

    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerup", onPointerUp);
    container.addEventListener("pointercancel", onPointerUp);
    return () => {
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-full w-full touch-none select-none"
      style={{ cursor: "grab" }}
    />
  );
});

export default TwistyViewer;
