/**
 * Solve timing helpers: formatting, penalties and WCA averages.
 *
 * Solve lists are ordered most-recent-first everywhere in the app.
 */

/** A solve's time including its penalty. DNF sorts as infinitely slow. */
export function effectiveMs(solve) {
  if (!solve || solve.dnf) return Infinity;
  return solve.ms + (solve.plus2 ? 2000 : 0);
}

/**
 * `padded` gives the 00:00.000 form used by the big readout; otherwise the
 * compact form cubers read at a glance (12.345 / 1:23.456).
 */
export function formatMs(ms, { padded = false } = {}) {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return padded ? "00:00.000" : "—";
  if (!Number.isFinite(ms)) return "DNF";

  const total = Math.max(0, ms);
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const millis = Math.floor(total % 1000);
  const frac = String(millis).padStart(3, "0");

  if (padded) {
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${frac}`;
  }
  if (minutes > 0) return `${minutes}:${String(seconds).padStart(2, "0")}.${frac}`;
  return `${seconds}.${frac}`;
}

/** How a single solve reads in the history list. */
export function formatSolve(solve) {
  if (solve.dnf) return `DNF(${formatMs(solve.ms)})`;
  return formatMs(effectiveMs(solve)) + (solve.plus2 ? "+" : "");
}

/**
 * WCA average of N: drop the fastest and the slowest, mean the rest. A single
 * DNF is the slowest so it gets trimmed away; two or more make the whole
 * average a DNF.
 */
export function averageOf(solves, n) {
  if (!solves || solves.length < n) return null;
  const window = solves.slice(0, n).map(effectiveMs);
  const sorted = [...window].sort((a, b) => a - b);
  const trimmed = sorted.slice(1, sorted.length - 1);
  if (trimmed.some((ms) => !Number.isFinite(ms))) return Infinity;
  return trimmed.reduce((sum, ms) => sum + ms, 0) / trimmed.length;
}

/** Session mean counts every solve; any DNF makes it undefined. */
export function meanOf(solves) {
  if (!solves?.length) return null;
  const times = solves.map(effectiveMs);
  if (times.some((ms) => !Number.isFinite(ms))) return Infinity;
  return times.reduce((sum, ms) => sum + ms, 0) / times.length;
}

export function bestOf(solves) {
  const finite = (solves ?? []).map(effectiveMs).filter(Number.isFinite);
  return finite.length ? Math.min(...finite) : null;
}

export function worstOf(solves) {
  const finite = (solves ?? []).map(effectiveMs).filter(Number.isFinite);
  return finite.length ? Math.max(...finite) : null;
}

export function sessionStats(solves) {
  return {
    count: solves?.length ?? 0,
    best: bestOf(solves),
    worst: worstOf(solves),
    ao5: averageOf(solves, 5),
    ao12: averageOf(solves, 12),
    mean: meanOf(solves),
  };
}

export const INSPECTION_MS = 15000;
const INSPECTION_DNF_MS = 17000;

/** WCA inspection overrun: +2 after 15s, DNF after 17s. */
export function inspectionPenalty(elapsedMs) {
  if (elapsedMs > INSPECTION_DNF_MS) return "dnf";
  if (elapsedMs > INSPECTION_MS) return "plus2";
  return null;
}

/** Countdown text for the inspection phase. */
export function formatInspection(elapsedMs) {
  if (elapsedMs > INSPECTION_DNF_MS) return "DNF";
  if (elapsedMs > INSPECTION_MS) return "+2";
  return String(Math.max(0, Math.ceil((INSPECTION_MS - elapsedMs) / 1000)));
}
