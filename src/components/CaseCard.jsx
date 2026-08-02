import { memo } from "react";
import CubeThumb from "./CubeThumb";

/**
 * One grid cell. Static SVG only — no <twisty-player> ever mounts here, which
 * is what keeps a 119-card page instant.
 */
function CaseCard({ caseData, index, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(caseData)}
      className="group flex flex-col items-center gap-2 rounded-xl border border-surface-700 bg-surface-850 p-3 text-center transition hover:-translate-y-0.5 hover:border-accent/60 hover:bg-surface-800 focus:outline-none focus:ring-2 focus:ring-accent"
    >
      <div className="flex w-full items-center justify-between text-[11px]">
        <span className="text-zinc-600">#{index}</span>
        <span className="rounded bg-accent/15 px-1.5 py-0.5 font-mono font-semibold text-accent-soft">
          {caseData.number}
        </span>
      </div>

      <CubeThumb stickers={caseData.stickers} size={104} className="drop-shadow-lg" />

      <div className="w-full">
        <div className="truncate text-sm font-medium text-zinc-200">{caseData.title}</div>
        <code className="mt-1 block break-words font-mono text-[11px] leading-snug text-emerald-300/90">
          {caseData.display}
        </code>
      </div>
    </button>
  );
}

export default memo(CaseCard);
