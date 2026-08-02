import { useMemo } from "react";
import CubeThumb from "./CubeThumb";
import { FULL_MASK, affectedFacelets, applyAlg, visibleStickers } from "../lib/cube";
import { cellCenter, stickerIndex, visibleCell } from "../lib/iso";

/**
 * Static diagram for a single move: the cube after the turn, with the pieces
 * that moved kept bright and an arrow tracing one sticker from where it started
 * to where it ended up.
 */
export default function MoveDiagram({ move, size = 116 }) {
  const { stickers, highlight, arrow } = useMemo(() => {
    const after = visibleStickers(applyAlg(FULL_MASK, move));
    const moved = affectedFacelets(move);

    const bright = new Set();
    let best = null;

    for (const [source, destination] of moved) {
      const from = visibleCell(source);
      const to = visibleCell(destination);
      if (to) bright.add(stickerIndex(to.face, to.row, to.col));
      if (!from || !to) continue;

      const a = cellCenter(from.face, from.row, from.col);
      const b = cellCenter(to.face, to.row, to.col);
      const distance = Math.hypot(b[0] - a[0], b[1] - a[1]);
      // Prefer an arrow that stays on one face — it reads far more clearly.
      const score = distance + (from.face === to.face ? 40 : 0);
      if (!best || score > best.score) best = { score, a, b };
    }

    return { stickers: after, highlight: bright, arrow: best };
  }, [move]);

  const markerId = `arrow-${move.replace(/[^a-z0-9]/gi, "_")}`;

  return (
    <CubeThumb stickers={stickers} size={size} highlight={highlight}>
      {arrow && (
        <>
          <defs>
            <marker
              id={markerId}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#f8fafc" />
            </marker>
          </defs>
          <line
            x1={arrow.a[0]}
            y1={arrow.a[1]}
            x2={arrow.b[0]}
            y2={arrow.b[1]}
            stroke="#0b0b0f"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          <line
            x1={arrow.a[0]}
            y1={arrow.a[1]}
            x2={arrow.b[0]}
            y2={arrow.b[1]}
            stroke="#f8fafc"
            strokeWidth="2.6"
            strokeLinecap="round"
            markerEnd={`url(#${markerId})`}
          />
        </>
      )}
    </CubeThumb>
  );
}
