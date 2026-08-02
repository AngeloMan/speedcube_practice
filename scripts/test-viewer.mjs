/**
 * End-to-end check that the 3D viewer actually renders.
 *
 * Drives the locally installed Chrome against `vite preview`, opens a practice
 * case, and asserts that the player host has a real box, that a WebGL canvas
 * exists inside its shadow root with non-zero backing store, and that the
 * canvas has actually drawn something (not a uniformly blank image).
 *
 *   node scripts/test-viewer.mjs
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";

const CHROME = [
  `${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env["ProgramFiles(x86)"]}\\Microsoft\\Edge\\Application\\msedge.exe`,
].find((path) => path && existsSync(path));

if (!CHROME) {
  console.log("no local Chrome/Edge found — skipping the browser check");
  process.exit(0);
}

const PORT = 5207;
const preview = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
  shell: true,
  stdio: "ignore",
});

const shutdown = () => preview.kill();
process.on("exit", shutdown);

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://localhost:${PORT}/`);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("preview server never came up");
}

const failures = [];
const expect = (label, condition, detail = "") => {
  if (condition) console.log(`  ok   ${label}${detail ? ` — ${detail}` : ""}`);
  else {
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
    failures.push(label);
  }
};

await waitForServer();

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader", // software WebGL for headless
    "--use-gl=angle",
    "--window-size=1600,1000",
  ],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });

  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("requestfailed", (request) => errors.push(`request failed: ${request.url()}`));
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle0" });

  // --- the grid must be free of WebGL --------------------------------------
  const cards = await page.$$eval("main button", (nodes) => nodes.length);
  expect("grid rendered cards", cards > 40, `${cards} cards`);
  expect(
    "no player in the grid",
    (await page.$$("twisty-player")).length === 0,
    "zero twisty-player elements before opening a case",
  );

  // --- open the practice modal ---------------------------------------------
  await page.click("main section button");
  await page.waitForSelector("twisty-player", { timeout: 20000 });

  // Give the player time to load its 3D chunk and draw a frame.
  await page.waitForFunction(
    () => {
      const player = document.querySelector("twisty-player");
      return player && player.getBoundingClientRect().height > 100;
    },
    { timeout: 20000 },
  );
  await new Promise((resolve) => setTimeout(resolve, 4000));

  const report = await page.evaluate(() => {
    const player = document.querySelector("twisty-player");
    const box = player.getBoundingClientRect();
    const style = getComputedStyle(player);

    // The shadow root is closed, so reach the canvas through the player's own
    // API instead of querySelector.
    return (async () => {
      const canvases = await player.experimentalCurrentCanvases();
      const canvas = canvases[0];

      // A WebGL drawing buffer is cleared once it has been composited, so
      // reading the live canvas gives nothing. Ask the player to re-render into
      // a fresh target instead, then measure that.
      const size = 360;
      const dataURL = await player.experimentalScreenshot({ width: size, height: size });
      const image = new Image();
      image.src = dataURL;
      await image.decode();

      const scratch = document.createElement("canvas");
      scratch.width = size;
      scratch.height = size;
      const context = scratch.getContext("2d");
      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, size, size);

      const seen = new Set();
      let opaque = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 10) {
          opaque += 1;
          seen.add(`${data[i] >> 3},${data[i + 1] >> 3},${data[i + 2] >> 3}`);
        }
      }

      return {
        hostWidth: Math.round(box.width),
        hostHeight: Math.round(box.height),
        display: style.display,
        canvasCount: canvases.length,
        canvasWidth: canvas?.width ?? 0,
        canvasHeight: canvas?.height ?? 0,
        drawn: {
          distinctColors: seen.size,
          opaqueFraction: opaque / (data.length / 4),
        },
      };
    })();
  });

  expect("host has a box", report.hostHeight > 400 && report.hostWidth > 400,
    `${report.hostWidth}x${report.hostHeight}`);
  expect("host keeps cubing's grid display", report.display === "grid", report.display);
  expect("a canvas exists", report.canvasCount > 0, `${report.canvasCount} canvas`);
  expect("canvas backing store is sized",
    report.canvasWidth > 300 && report.canvasHeight > 300,
    `${report.canvasWidth}x${report.canvasHeight}`);
  expect("canvas has drawn a cube",
    (report.drawn?.distinctColors ?? 0) > 20 && report.drawn.opaqueFraction > 0.05,
    `${report.drawn?.distinctColors} colours, ${(report.drawn?.opaqueFraction * 100).toFixed(1)}% opaque`);

  await page.screenshot({ path: "scripts/viewer-check.png" });

  // --- keyboard still drives the cube --------------------------------------
  await page.keyboard.press("KeyW");
  await new Promise((resolve) => setTimeout(resolve, 400));
  const moveLog = await page.evaluate(() => {
    const heads = [...document.querySelectorAll("h3")];
    const head = heads.find((h) => h.textContent.trim() === "Your moves");
    return head?.nextElementSibling?.textContent?.trim() ?? "";
  });
  expect("keyboard applies a move", moveLog === "U", `log = "${moveLog}"`);

  // --- closing the modal disposes the player -------------------------------
  await page.click('button[aria-label="Close practice view"]');
  await new Promise((resolve) => setTimeout(resolve, 500));
  expect("close button disposes the player",
    (await page.$$("twisty-player")).length === 0);

  const realErrors = errors.filter((text) => !/Download the React DevTools/i.test(text));
  expect("no page errors", realErrors.length === 0, JSON.stringify(realErrors));
} finally {
  await browser.close();
  preview.kill();
}

if (failures.length) {
  console.log(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\n3D viewer renders correctly");
process.exit(0);
