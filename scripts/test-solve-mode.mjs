/**
 * End-to-end check for solve mode: the spacebar state machine, the keyboard
 * lockout during a solve, session stats, penalties, persistence and the
 * automatic next scramble.
 *
 *   node scripts/test-solve-mode.mjs
 */
import { findBrowser, launch, reporter, startPreview, wait } from "./browser.mjs";

const executablePath = findBrowser();
if (!executablePath) {
  console.log("no local Chrome/Edge found — skipping the browser check");
  process.exit(0);
}

const PORT = 5208;
const preview = await startPreview(PORT);
const { expect, finish } = reporter();
const browser = await launch(executablePath);

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1000 });

  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto(`http://localhost:${PORT}/#scramble`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => !document.body.innerText.includes("generating…"), {
    timeout: 30000,
  });

  const readout = () => page.$eval('[role="timer"] span', (n) => n.textContent.trim());
  const colour = () => page.$eval('[role="timer"] span', (n) => getComputedStyle(n).color);
  const scrambleText = () => page.$eval("p.font-mono.text-xl", (n) => n.textContent.trim());
  const stat = (label) =>
    page.evaluate((wanted) => {
      const node = [...document.querySelectorAll("div")].find(
        (d) => d.textContent.trim() === wanted && d.className.includes("uppercase"),
      );
      return node?.nextElementSibling?.textContent?.trim() ?? null;
    }, label);
  const rows = () => page.$$eval("ol li", (list) => list.length);

  // --- solve mode is opt-in -------------------------------------------------
  expect("no timer before solve mode", (await page.$('[role="timer"]')) === null);
  await page.click("button[aria-pressed]");
  await page.waitForSelector('[role="timer"]');
  expect("timer starts at zero", (await readout()) === "00:00.000", await readout());

  const firstScramble = await scrambleText();
  const idleColour = await colour();

  // --- hold turns green, release starts -------------------------------------
  await page.keyboard.down("Space");
  await wait(150);
  const heldColour = await colour();
  expect("holding turns the readout green", heldColour !== idleColour, heldColour);
  expect("held readout still reads zero", (await readout()) === "00:00.000", await readout());

  await page.keyboard.up("Space");
  await wait(700);
  const running = await readout();
  expect(
    "release starts the timer",
    /^00:00\.\d{3}$/.test(running) && running !== "00:00.000",
    running,
  );
  await wait(600);

  // --- any key stops --------------------------------------------------------
  await page.keyboard.press("KeyW");
  await wait(500);
  const stopped = await readout();
  expect("any key stops the timer", stopped !== "00:00.000" && stopped !== running, stopped);
  expect("readout is no longer green", (await colour()) !== heldColour, await colour());

  expect("solve was recorded", (await rows()) === 1, `${await rows()} rows`);
  expect("best is set", (await stat("Best")) !== "—", await stat("Best"));
  expect("ao5 waits for five solves", (await stat("Ao5")) === "—", await stat("Ao5"));
  expect("a new scramble was generated", (await scrambleText()) !== firstScramble);

  // The keystroke that stopped the timer must not arm the next solve.
  await wait(200);
  expect("stopping key did not re-arm", (await colour()) !== heldColour, await colour());

  // --- penalties ------------------------------------------------------------
  const firstRow = () => page.$eval("ol li span.flex-1", (n) => n.textContent.trim());
  const raw = await firstRow();
  await page.click('ol li button[title="Toggle +2"]');
  await wait(150);
  expect("+2 applies", (await firstRow()).endsWith("+"), await firstRow());

  await page.click('ol li button[title="Toggle DNF"]');
  await wait(150);
  expect("DNF applies", (await firstRow()).startsWith("DNF"), await firstRow());
  expect("DNF removes the best time", (await stat("Best")) === "—", await stat("Best"));

  await page.click('ol li button[title="Toggle DNF"]');
  await wait(150);
  expect("penalties toggle back off", (await firstRow()) === raw, await firstRow());

  // --- persistence ----------------------------------------------------------
  const persisted = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("speedcube-trainer") ?? "{}");
    return {
      solves: saved.state?.solves?.length ?? 0,
      hasTimerActive: "timerActive" in (saved.state ?? {}),
    };
  });
  expect("solves are persisted", persisted.solves === 1, `${persisted.solves} saved`);
  expect("timerActive is never persisted", persisted.hasTimerActive === false);

  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector("ol li");
  expect("session survives a reload", (await rows()) === 1);

  // --- delete ---------------------------------------------------------------
  await page.click('ol li button[aria-label^="Delete solve"]');
  await wait(200);
  expect("a solve can be deleted", (await rows()) === 0);

  // --- inspection -----------------------------------------------------------
  await page.click('button[role="switch"]');
  await wait(100);
  await page.keyboard.down("Space");
  await wait(120);
  await page.keyboard.up("Space");
  await wait(500);
  const inspecting = await readout();
  expect("inspection counts down from 15", ["15", "14"].includes(inspecting), inspecting);

  await page.keyboard.down("Space");
  await wait(120);
  await page.keyboard.up("Space");
  await wait(400);
  expect("second release starts the solve", /^00:00\./.test(await readout()), await readout());
  await page.keyboard.press("Escape");
  await wait(300);
  expect("the inspected solve was recorded", (await rows()) === 1);

  // --- idle keybindings must still drive the cube ---------------------------
  await page.goto(`http://localhost:${PORT}/#algorithms`, { waitUntil: "networkidle0" });
  await page.click("main section button");
  await page.waitForSelector("twisty-player");
  await wait(4000);
  await page.keyboard.press("KeyE"); // U in the default schema
  await wait(500);
  const moveLog = await page.evaluate(() => {
    const head = [...document.querySelectorAll("h3")].find(
      (h) => h.textContent.trim() === "Your moves",
    );
    return head?.nextElementSibling?.textContent?.trim() ?? "";
  });
  expect("cube keys still work when the timer is idle", moveLog === "U", `log = "${moveLog}"`);

  const real = errors.filter((text) => !/Download the React DevTools/i.test(text));
  expect("no page errors", real.length === 0, JSON.stringify(real).slice(0, 240));
} finally {
  await browser.close();
  preview.kill();
}

finish("solve mode works");
