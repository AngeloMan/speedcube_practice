/**
 * End-to-end checks for keyboard solving, Ctrl+Z undo, the colour orientations
 * and the independent prime keybindings.
 *
 * The keyboard solve is genuine: the scramble is inverted and typed in, one
 * keystroke per turn, through exactly the path a user's fingers take.
 *
 *   node scripts/test-solving.mjs
 */
import { findBrowser, launch, reporter, startPreview, wait } from "./browser.mjs";

const executablePath = findBrowser();
if (!executablePath) {
  console.log("no local Chrome/Edge found — skipping the browser check");
  process.exit(0);
}

const PORT = 5213;
const preview = await startPreview(PORT);
const { expect, finish } = reporter();
const browser = await launch(executablePath);

/** Sample the up and front stickers from a re-rendered screenshot. */
const faceColours = (page) =>
  page.evaluate(async () => {
    const player = document.querySelector("twisty-player");
    const size = 240;
    const url = await player.experimentalScreenshot({ width: size, height: size });
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    const at = (x, y) => context.getImageData(Math.round(x), Math.round(y), 1, 1).data;
    const name = ([r, g, b]) => {
      if (r > 180 && g > 180 && b > 180) return "white";
      if (r > 170 && g > 140 && b < 90) return "yellow";
      if (g > 110 && r < 130 && b < 130) return "green";
      if (b > 110 && r < 110 && g < 140) return "blue";
      if (r > 130 && g < 90 && b < 90) return "red";
      if (r > 150 && g > 80 && b < 60) return "orange";
      return `rgb(${r},${g},${b})`;
    };
    return {
      up: name(at(size * 0.5, size * 0.3)),
      front: name(at(size * 0.38, size * 0.63)),
    };
  });

/** Turn a 3x3x3 algorithm into the keystrokes that produce it. */
function keystrokesFor(alg, bindings) {
  const strokes = [];
  for (const token of alg.split(/\s+/).filter(Boolean)) {
    const face = token[0];
    const key = bindings[face];
    if (!key) throw new Error(`no key bound for ${face}`);
    const code = `Key${key.toUpperCase()}`;
    if (token.includes("2")) strokes.push({ code }, { code });
    else if (token.includes("'")) strokes.push({ code, shift: true });
    else strokes.push({ code });
  }
  return strokes;
}

const invert = (alg) =>
  alg
    .split(/\s+/)
    .filter(Boolean)
    .reverse()
    .map((t) => (t.endsWith("'") ? t.slice(0, -1) : `${t}'`))
    .join(" ");

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1050 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  // Start from a clean session, with B bound so every face has a key. The seed
  // is a *complete* map: a partial one would leave default bindings in place
  // that collide with these, and the first declared action would win the key.
  const BINDINGS = { U: "w", L: "a", F: "s", R: "d", D: "x", B: "q", M: "c", S: "z" };
  const ALL_ACTIONS = [
    "U", "U'", "L", "L'", "F", "F'", "R", "R'", "D", "D'", "B", "B'",
    "M", "M'", "E", "E'", "S", "S'", "x", "x'", "y", "y'", "z", "z'",
  ];
  const SEED = Object.fromEntries(ALL_ACTIONS.map((id) => [id, BINDINGS[id] ?? ""]));
  // Let the app finish booting first: zustand writes its own default state on
  // hydration, and that write must land *before* the seed, not after it.
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle0" });
  await page.waitForSelector("main section button");
  await wait(500);
  await page.evaluate((bindings) => {
    const saved = JSON.parse(localStorage.getItem("speedcube-trainer") ?? "{}");
    saved.state = { ...(saved.state ?? {}), bindings, solves: [] };
    localStorage.setItem("speedcube-trainer", JSON.stringify(saved));
  }, SEED);

  // =========================================================================
  // Practice modal: yellow top / blue front, and Ctrl+Z undo
  // =========================================================================
  // Only the hash differs, so this is a same-document navigation and the store
  // would keep the state it hydrated with. Reload to pick the seed up.
  await page.goto(`http://localhost:${PORT}/#algorithms`, { waitUntil: "networkidle0" });
  await page.reload({ waitUntil: "networkidle0" });
  await page.click("main section button");
  await page.waitForSelector("twisty-player");
  await wait(4500);

  // The default F2L masking greys the top layer, so read the colours with the
  // mask off — the orientation is what is under test here, not the stickering.
  // Not the first <select> on the page — that is the navbar's mobile page
  // picker. Find the one that actually offers the masking options.
  const setMasking = (value) =>
    page.evaluate((wanted) => {
      const select = [...document.querySelectorAll("select")].find((s) =>
        [...s.options].some((o) => o.value === "LS"),
      );
      select.value = wanted;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);

  await setMasking("full");
  await wait(1800);
  const practice = await faceColours(page);
  expect("practice viewer puts yellow on top", practice.up === "yellow", practice.up);
  expect("practice viewer puts blue in front", practice.front === "blue", practice.front);
  await setMasking("LS");
  await wait(1800);
  const masked = await page.evaluate(async () => {
    // The last-slot mask must still be on the layer we can see: a grey sticker
    // has to exist somewhere on the cube.
    const player = document.querySelector("twisty-player");
    const url = await player.experimentalScreenshot({ width: 200, height: 200 });
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 200;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, 200, 200);
    let grey = 0;
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
      if (a > 200 && Math.abs(r - g) < 14 && Math.abs(g - b) < 14 && r > 60 && r < 190) grey += 1;
    }
    return grey;
  });
  expect("masking survives the rotation", masked > 400, `${masked} grey pixels`);

  const moveLog = () =>
    page.evaluate(() => {
      const head = [...document.querySelectorAll("h3")].find(
        (h) => h.textContent.trim() === "Your moves",
      );
      return head?.nextElementSibling?.textContent?.trim() ?? "";
    });

  for (const key of ["KeyW", "KeyD", "KeyS"]) {
    await page.keyboard.press(key);
    await wait(180);
  }
  expect("keys turn the cube", (await moveLog()) === "U R F", await moveLog());

  const ctrlZ = async (times = 1) => {
    await page.keyboard.down("Control");
    for (let i = 0; i < times; i += 1) await page.keyboard.press("KeyZ");
    await page.keyboard.up("Control");
    await wait(120 + 120 * times);
  };

  await ctrlZ();
  expect("Ctrl+Z undoes the last move", (await moveLog()) === "U R", await moveLog());
  const emptyLog = async () => ["", "—"].includes(await moveLog());
  await ctrlZ(2);
  expect("repeated Ctrl+Z rewinds further", await emptyLog(), `"${await moveLog()}"`);
  await ctrlZ();
  expect("undo on an empty history is harmless", await emptyLog(), await moveLog());

  // A dedicated prime key must work without Shift.
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("speedcube-trainer"));
    saved.state.bindings["U'"] = "e";
    localStorage.setItem("speedcube-trainer", JSON.stringify(saved));
  });
  await page.reload({ waitUntil: "networkidle0" });
  await page.click("main section button");
  await page.waitForSelector("twisty-player");
  await wait(4000);
  await page.keyboard.press("KeyE");
  await wait(300);
  expect("a dedicated prime key works", (await moveLog()) === "U'", await moveLog());
  await page.keyboard.down("Shift");
  await page.keyboard.press("KeyE");
  await page.keyboard.up("Shift");
  await wait(300);
  expect("Shift inverts a prime binding", (await moveLog()) === "U' U", await moveLog());

  await page.click('button[aria-label="Close practice view"]');
  await wait(400);

  // =========================================================================
  // Scramble page: WCA colours and a real keyboard solve
  // =========================================================================
  await page.goto(`http://localhost:${PORT}/#scramble`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => !document.body.innerText.includes("generating…"), {
    timeout: 30000,
  });
  await page.waitForSelector("twisty-player");
  await wait(4500);

  const solver = await faceColours(page);
  expect("solver keeps white on top", solver.up === "white", solver.up);
  expect("solver keeps green in front", solver.front === "green", solver.front);

  await page.click("button[aria-pressed]");
  await page.waitForSelector('[role="timer"]');
  await page.evaluate(() => {
    [...document.querySelectorAll("button")]
      .find((b) => b.textContent.trim() === "Keyboard solve")
      .click();
  });
  await wait(400);

  const scramble = await page.$eval("p.font-mono.text-xl", (n) => n.textContent.trim());
  expect("a scramble is showing", scramble.split(/\s+/).length > 15, scramble);

  await page.keyboard.down("Space");
  await wait(150);
  await page.keyboard.up("Space");
  await wait(400);
  const readout = () => page.$eval('[role="timer"] span', (n) => n.textContent.trim());
  const started = await readout();
  expect("timer is running", started !== "00:00.000", started);

  const counter = () =>
    page.evaluate(() => document.body.innerText.match(/(\d+) moves/)?.[1] ?? null);

  await page.keyboard.press("KeyW");
  await wait(300);
  expect("a movement key does not stop a keyboard solve", (await readout()) !== "00:00.000");
  expect("the move counter advanced", (await counter()) === "1", await counter());

  await ctrlZ();
  expect("Ctrl+Z works mid-solve", (await counter()) === "0", await counter());

  // Now actually solve it, one keystroke per turn.
  const strokes = keystrokesFor(invert(scramble), BINDINGS);
  for (const stroke of strokes) {
    if (stroke.shift) await page.keyboard.down("Shift");
    await page.keyboard.press(stroke.code);
    if (stroke.shift) await page.keyboard.up("Shift");
    await wait(45);
  }
  await wait(1200);

  const banner = await page.evaluate(
    () => document.querySelector('[role="status"]')?.textContent ?? "",
  );
  expect("solving the cube shows the banner", /Cube solved/.test(banner), banner.slice(0, 60));
  expect("the timer stopped itself", (await readout()) !== started, await readout());

  const logged = await page.$$eval("ol li", (rows) => rows.length);
  expect("the solve was logged", logged === 1, `${logged} rows`);
  const best = await page.evaluate(() => {
    const label = [...document.querySelectorAll("div")].find(
      (d) => d.textContent.trim() === "Best" && d.className.includes("uppercase"),
    );
    return label?.nextElementSibling?.textContent?.trim() ?? null;
  });
  expect("session stats picked it up", best && best !== "—", best);

  const nextScramble = await page.$eval("p.font-mono.text-xl", (n) => n.textContent.trim());
  expect("a new scramble was cut", nextScramble !== scramble);

  const real = errors.filter((t) => !/Download the React DevTools/i.test(t));
  expect("no page errors", real.length === 0, JSON.stringify(real).slice(0, 300));
} finally {
  await browser.close();
  preview.kill();
}

finish("keyboard solving, undo, orientation and prime bindings all work");
