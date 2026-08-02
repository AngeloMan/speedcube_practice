/** Screenshots solve mode with a few solves logged, for visual review. */
import { findBrowser, launch, startPreview, wait } from "./browser.mjs";

const PORT = 5210;
const preview = await startPreview(PORT);
const browser = await launch(findBrowser());

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1150 });
  await page.goto(`http://localhost:${PORT}/#scramble`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => !document.body.innerText.includes("generating…"), {
    timeout: 30000,
  });
  await page.click("button[aria-pressed]");
  await page.waitForSelector('[role="timer"]');

  // Log a handful of solves so the stats panel has something to show.
  for (const hold of [820, 1450, 1100, 1980, 1320, 900]) {
    await page.keyboard.down("Space");
    await wait(120);
    await page.keyboard.up("Space");
    await wait(hold);
    await page.keyboard.press("KeyW");
    await wait(450);
  }
  await page.click('ol li:nth-child(2) button[title="Toggle +2"]');
  await wait(300);

  await page.screenshot({ path: "scripts/solve-mode.png" });
  console.log("saved scripts/solve-mode.png");
} finally {
  await browser.close();
  preview.kill();
}
process.exit(0);
