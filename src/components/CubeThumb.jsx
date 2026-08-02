import { memo } from "react";
import {
  FACE_SHADE,
  STICKER_COLORS,
  VIEW_BOX,
  VISIBLE_FACES,
  cellPoints,
  facePoints,
  stickerIndex,
} from "../lib/iso";

/** Multiply a hex colour by a constant to fake directional lighting. */
function shade(hex, factor) {
  if (factor === 1) return hex;
  const n = parseInt(hex.slice(1), 16);
  const channel = (shift) =>
    Math.round(Math.min(255, ((n >> shift) & 0xff) * factor))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

/**
 * A static isometric preview of a case, drawn from the 27-character sticker
 * string produced by the seed script. Deliberately plain SVG: the grid renders
 * a hundred of these at once, so nothing here may touch WebGL.
 */
function CubeThumb({ stickers, size = 100, className = "", highlight = null, children }) {
  return (
    <svg
      viewBox={VIEW_BOX}
      width={size}
      height={size}
      className={className}
      role="img"
      aria-hidden="true"
      shapeRendering="geometricPrecision"
    >
      {VISIBLE_FACES.map((face) => (
        <polygon
          key={`bg-${face}`}
          points={facePoints(face)}
          fill="#0c0c10"
          stroke="#0c0c10"
          strokeWidth="5"
          strokeLinejoin="round"
        />
      ))}
      {VISIBLE_FACES.flatMap((face) =>
        [0, 1, 2].flatMap((row) =>
          [0, 1, 2].map((col) => {
            const index = stickerIndex(face, row, col);
            const color = STICKER_COLORS[stickers[index]] ?? STICKER_COLORS.x;
            const dimmed = highlight && !highlight.has(index);
            return (
              <polygon
                key={`${face}-${row}-${col}`}
                points={cellPoints(face, row, col)}
                fill={shade(color, FACE_SHADE[face])}
                stroke="#0c0c10"
                strokeWidth="1.6"
                strokeLinejoin="round"
                opacity={dimmed ? 0.25 : 1}
              />
            );
          }),
        ),
      )}
      {children}
    </svg>
  );
}

export default memo(CubeThumb);
