/** Shared harness for the browser-driven checks: preview server + local Chrome. */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export function findBrowser() {
  const candidates = [
    join(process.env.ProgramFiles ?? "", "Google/Chrome/Application/chrome.exe"),
    join(process.env["ProgramFiles(x86)"] ?? "", "Google/Chrome/Application/chrome.exe"),
    join(process.env.LOCALAPPDATA ?? "", "Google/Chrome/Application/chrome.exe"),
    join(process.env.ProgramFiles ?? "", "Microsoft/Edge/Application/msedge.exe"),
    join(process.env["ProgramFiles(x86)"] ?? "", "Microsoft/Edge/Application/msedge.exe"),
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ];
  return candidates.find((path) => path && existsSync(path)) ?? null;
}

export async function startPreview(port) {
  const server = spawn("npx", ["vite", "preview", "--port", String(port), "--strictPort"], {
    shell: true,
    stdio: "ignore",
  });
  process.on("exit", () => server.kill());

  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await fetch(`http://localhost:${port}/`)).ok) return server;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  server.kill();
  throw new Error("preview server never came up");
}

export async function launch(executablePath) {
  const puppeteer = (await import("puppeteer-core")).default;
  return puppeteer.launch({
    executablePath,
    headless: "new",
    args: [
      "--no-sandbox",
      "--enable-unsafe-swiftshader", // software WebGL for headless
      "--use-gl=angle",
      "--window-size=1600,1000",
    ],
  });
}

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function reporter() {
  const failures = [];
  return {
    failures,
    expect(label, ok, detail = "") {
      console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
      if (!ok) failures.push(label);
    },
    finish(successMessage) {
      if (failures.length) {
        console.log(`\n${failures.length} check(s) failed`);
        process.exit(1);
      }
      console.log(`\n${successMessage}`);
      process.exit(0);
    },
  };
}
