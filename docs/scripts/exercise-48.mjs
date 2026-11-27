#!/usr/bin/env node
/**
 * exercise-48.mjs - Runs the #48 mission exercise in a headless browser.
 *
 * A musician takes one song from the playground to print, playback and share. Each step of the
 * exercise in https://github.com/panyam/notations/issues/48 prints one line: PASS, FAIL, SKIP, or
 * CHECK when a person has to judge the result. Screenshots go to out/exercise-48/.
 *
 *   pnpm run exercise:48                                     # the live site
 *   pnpm run exercise:48 --base http://localhost:8085/notations/   # make run or make site
 *   pnpm run exercise:48 --song path/to/song.sng
 *
 * The exit code is the number of the first failing step, or 0 when none fails.
 * Needs Chromium for Playwright once: pnpm exec playwright install chromium
 */
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

const LIVE = "https://panyam.github.io/notations/";
const SONG_URL = "https://raw.githubusercontent.com/panyam/notation_demos/master/Pancharatnams/DudukuGala.sng";
const OUT = "out/exercise-48";

const { values: args } = parseArgs({
  options: {
    base: { type: "string", default: LIVE },
    song: { type: "string" },
    headed: { type: "boolean", default: false },
  },
});
const base = args.base.endsWith("/") ? args.base : args.base + "/";

const results = [];
function report(step, status, what) {
  results.push({ step, status });
  console.log(`${status.padEnd(5)} step ${step}: ${what}`);
}

async function loadSong() {
  if (args.song) return readFileSync(args.song, "utf8");
  const res = await fetch(SONG_URL);
  if (!res.ok) throw new Error(`could not fetch the song: ${res.status} ${SONG_URL}`);
  return res.text();
}

async function launch() {
  try {
    return await chromium.launch({ headless: !args.headed });
  } catch (e) {
    console.error(String(e.message).split("\n")[0]);
    console.error("Install the browser once with: pnpm exec playwright install chromium");
    process.exit(100);
  }
}

/** Pastes the source into the side-by-side playground and presses Render. */
async function render(page, source) {
  await page.getByRole("button", { name: "Clear" }).click();
  await page.locator("textarea.side-by-side-editor").fill(source);
  await page.getByRole("button", { name: /^render$/i }).click();
  await page.waitForTimeout(1000);
  const svgs = await page.locator(".side-by-side-output svg").count();
  const errors = (await page.locator(".dvp-console-panel").innerText())
    .split("\n")
    .filter((l) => l.includes("Parse error"));
  return { svgs, errors };
}

async function control(page, pattern) {
  return (
    (await page.getByRole("button", { name: pattern }).count()) +
    (await page.getByRole("link", { name: pattern }).count())
  );
}

async function main() {
  const song = await loadSong();
  mkdirSync(OUT, { recursive: true });
  console.log(`Exercise #48 on ${base}`);

  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => {
    window.__printCalls = 0;
    window.print = () => window.__printCalls++;
  });
  await page.goto(base + "demos/playgrounds/side-by-side/", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  // 1. Paste the song into the playground and press Render. One bad command must not blank it.
  const clean = await render(page, song);
  const withBad = await render(page, song + "\n\\noTala\nSw: S , , , R , , ,\n");
  await page.screenshot({ path: join(OUT, "step-1.png") });
  if (clean.svgs === 0) report(1, "FAIL", "the song renders nothing");
  else if (withBad.svgs === 0) report(1, "FAIL", "one unknown command blanks the render");
  else
    report(
      1,
      clean.errors.length ? "CHECK" : "PASS",
      `${clean.svgs} lines render` +
        (clean.errors.length ? `, with ${clean.errors.length} parse errors: ${clean.errors[0]}` : "") +
        `; with \\noTala added, ${withBad.svgs} lines still render`,
    );

  // 2. Export to PDF and PNG, or print.
  const exportCount = await control(page, /png|svg|export|download/i);
  const printCount = await control(page, /print/i);
  let printed = false;
  if (printCount) {
    await page.getByRole("button", { name: /print/i }).first().click();
    await page.waitForTimeout(1000);
    printed = (await page.evaluate(() => window.__printCalls)) > 0;
    printed &&= (await page.locator(".notations-print-root svg").count()) > 0;
    await page.screenshot({ path: join(OUT, "step-2.png") });
  }
  const exportNote = exportCount ? "an export control exists" : "no PNG or SVG export (#74)";
  if (printed) report(2, "PASS", `Print / PDF prints the notation alone; ${exportNote}`);
  else if (exportCount) report(2, "CHECK", `${exportNote}; check its file by hand`);
  else report(2, "FAIL", printCount ? "Print did not print the notation" : "no print or export control (#74)");

  // 3. Play it back.
  if (await control(page, /play|midi|audio|listen/i)) report(3, "CHECK", "a playback control exists; listen by hand");
  else report(3, "FAIL", "no playback control (#75)");

  // 4. Save it and open the share link in a private window.
  const share = await control(page, /share|save|link/i);
  if (share) report(4, "CHECK", "a share control exists; open its link in a private window by hand");
  else report(4, "FAIL", "no save or share control (#77)");

  // 5. Open that link on a phone.
  report(5, "SKIP", "needs a share link from step 4 (#80)");

  // 6. An example close to the song, an FAQ, and a place to ask a question.
  const status = async (p) => (await page.goto(base + p, { waitUntil: "domcontentloaded" }))?.status() ?? 0;
  const examples = await status("examples/");
  const faq = await status("faq/");
  await status("contributing/");
  const askLinks = await page.locator('a[href*="discussions"], a[href*="discord"], a[href*="forum"]').count();
  await page.screenshot({ path: join(OUT, "step-6.png") });
  const missing = [];
  if (examples !== 200) missing.push(`Examples is ${examples}`);
  if (faq !== 200) missing.push(`/faq/ is ${faq} (#84, #85)`);
  if (!askLinks) missing.push("Contributing has no forum or discussion link (#83)");
  report(
    6,
    missing.length ? "FAIL" : "PASS",
    missing.length ? missing.join("; ") : "Examples, FAQ and a place to ask all exist",
  );

  await browser.close();
  const firstFail = results.find((r) => r.status === "FAIL");
  console.log(firstFail ? `First failing step: ${firstFail.step}` : "No step failed");
  console.log(`Screenshots: ${OUT}/`);
  process.exit(firstFail ? firstFail.step : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(99);
});
