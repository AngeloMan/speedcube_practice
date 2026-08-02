/** Assertions for solve formatting, penalties and WCA averages. */
import assert from "node:assert/strict";
import {
  averageOf,
  bestOf,
  effectiveMs,
  formatInspection,
  formatMs,
  formatSolve,
  inspectionPenalty,
  meanOf,
  sessionStats,
} from "../src/lib/timer.js";

let checks = 0;
const check = (label, actual, expected) => {
  checks += 1;
  assert.deepEqual(actual, expected, `${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
};

const solve = (ms, extra = {}) => ({ ms, plus2: false, dnf: false, ...extra });

// --- formatting -------------------------------------------------------------
check("sub-minute", formatMs(12345), "12.345");
check("padded", formatMs(12345, { padded: true }), "00:12.345");
check("over a minute", formatMs(83456), "1:23.456");
check("padded over a minute", formatMs(83456, { padded: true }), "01:23.456");
check("zero padded", formatMs(0, { padded: true }), "00:00.000");
check("millisecond truncation", formatMs(9999), "9.999");
check("no value", formatMs(null), "—");
check("no value padded", formatMs(null, { padded: true }), "00:00.000");
check("infinite is a DNF", formatMs(Infinity), "DNF");

// --- penalties --------------------------------------------------------------
check("plain solve", effectiveMs(solve(10000)), 10000);
check("+2 adds two seconds", effectiveMs(solve(10000, { plus2: true })), 12000);
check("DNF is infinite", effectiveMs(solve(10000, { dnf: true })), Infinity);
check("+2 is marked", formatSolve(solve(10000, { plus2: true })), "12.000+");
check("DNF keeps the raw time", formatSolve(solve(10000, { dnf: true })), "DNF(10.000)");

// --- averages ---------------------------------------------------------------
const five = [7000, 8000, 9000, 10000, 11000].map((ms) => solve(ms));
// drops 7 and 11, means 8/9/10
check("ao5 trims the extremes", averageOf(five, 5), 9000);
check("ao5 needs five solves", averageOf(five.slice(0, 4), 5), null);
check("best", bestOf(five), 7000);
check("mean counts everything", meanOf(five), 9000);

// One DNF is the slowest, so it is the value that gets trimmed away.
const oneDnf = [solve(7000, { dnf: true }), ...five.slice(1)];
check("one DNF still averages", averageOf(oneDnf, 5), (9000 + 10000 + 11000) / 3);

// Two DNFs cannot both be trimmed, so the average itself is a DNF.
const twoDnf = [solve(7000, { dnf: true }), solve(8000, { dnf: true }), ...five.slice(2)];
check("two DNFs make a DNF average", averageOf(twoDnf, 5), Infinity);
check("DNF average prints as DNF", formatMs(averageOf(twoDnf, 5)), "DNF");
check("mean is undefined with a DNF", meanOf(oneDnf), Infinity);
check("best ignores DNFs", bestOf(oneDnf), 8000);

// +2 is included in the average, not the raw time.
check(
  "ao5 uses penalised times",
  averageOf([solve(7000), solve(8000), solve(9000), solve(10000), solve(1000, { plus2: true })], 5),
  8000, // 3000, 7000, [8000, 9000, 10000] -> trims 3000 and 10000
);

// Averages use the most recent N, since solves are stored newest-first.
const twelve = Array.from({ length: 14 }, (_, i) => solve((i + 1) * 1000));
// newest twelve are 1000..12000; trimming 1000 and 12000 leaves 2000..11000
check("ao12 uses the newest twelve", averageOf(twelve, 12), 6500);
check("ao12 needs twelve", averageOf(twelve.slice(0, 11), 12), null);

// --- session stats ----------------------------------------------------------
const stats = sessionStats(five);
check("stat count", stats.count, 5);
check("stat best", stats.best, 7000);
check("stat ao5", stats.ao5, 9000);
check("stat ao12 not yet", stats.ao12, null);
check("empty session", sessionStats([]), {
  count: 0, best: null, worst: null, ao5: null, ao12: null, mean: null,
});

// --- inspection -------------------------------------------------------------
check("inside inspection", inspectionPenalty(14000), null);
check("just over fifteen", inspectionPenalty(15001), "plus2");
check("over seventeen", inspectionPenalty(17001), "dnf");
check("countdown", formatInspection(0), "15");
check("countdown late", formatInspection(14200), "1");
check("countdown overrun", formatInspection(16000), "+2");
check("countdown dnf", formatInspection(18000), "DNF");

console.log(`all ${checks} timer assertions passed`);
