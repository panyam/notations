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

/**
 * Renders the song again and clicks a rendered note. With cursor sync (panyam/notation#294), the
 * editor selects that note's text. This adds a note to step 1 rather than failing it, since the
 * step only asks for the song to render.
 */
async function checkCursor(page, song) {
  await render(page, song);
  const note = page.locator("g.atomViewRootGroup text").nth(5);
  if (!(await note.count())) return "no note to click";
  const shown = (await note.textContent()).trim();
  await note.click();
  const selected = await page
    .locator("textarea")
    .first()
    .evaluate((t) => t.value.substring(t.selectionStart, t.selectionEnd));
  return selected === shown
    ? `clicking "${shown}" selects its source`
    : `clicking "${shown}" selects ${JSON.stringify(selected)} in the editor (#294)`;
}

/**
 * Presses Share and opens the link it gives in a fresh browser context, which shares no storage
 * with the playground, as a private window wouldn't. The link has to render the same lines.
 */
async function shareAndOpen(page, browser, song) {
  if (!(await page.getByRole("button", { name: "Share", exact: true }).count()))
    return { status: "FAIL", what: "no share control (#77)" };
  const playgroundLines = (await render(page, song)).svgs;
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await page.waitForTimeout(1000);
  const url = await page
    .locator("#share-link")
    .inputValue()
    .catch(() => "");
  if (!url) return { status: "FAIL", what: "Share gave no link (#77)" };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const fresh = await ctx.newPage();
  await fresh.goto(url);
  await fresh.waitForTimeout(2000);
  const lines = await fresh.locator("#view-root svg.lineRootSVG").count();
  await fresh.screenshot({ path: join(OUT, "step-4.png") });
  await ctx.close();
  const kb = (url.length / 1024).toFixed(1);
  return lines === playgroundLines
    ? { status: "PASS", what: `Share gives a ${kb} KB link, and a fresh browser renders all ${lines} lines`, url }
    : { status: "FAIL", what: `the shared link renders ${lines} of ${playgroundLines} lines (#77)`, url };
}

/** Opens the shared link at a phone's width, and checks the lines fit without sideways scrolling. */
async function openOnPhone(browser, url) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const phone = await ctx.newPage();
  await phone.goto(url);
  await phone.waitForTimeout(2000);
  const measure = () =>
    phone.evaluate(() => {
      const lines = [...document.querySelectorAll("#view-root svg.lineRootSVG")];
      const width = document.documentElement.clientWidth;
      // A swara's glyph, as tall as it shows on screen.
      const heights = [...document.querySelectorAll("#view-root .role_sw text")]
        .map((t) => t.getBoundingClientRect().height)
        .filter((h) => h > 0)
        .sort((a, b) => a - b);
      return {
        lines: lines.length,
        wider: lines.filter((s) => s.getBoundingClientRect().right > width + 1).length,
        sideways: document.documentElement.scrollWidth > width + 1,
        noteHeight: heights.length ? heights[Math.floor(heights.length / 2)] : 0,
      };
    });
  const fit = await measure();
  await phone.screenshot({ path: join(OUT, "step-5.png"), fullPage: true });
  // Turned sideways, the rows break again for the wider screen.
  await phone.setViewportSize({ width: 844, height: 390 });
  await phone.waitForTimeout(1000);
  const turned = await measure();
  await ctx.close();
  const px = fit.noteHeight.toFixed(0);
  if (!fit.lines) return { status: "FAIL", what: "the link renders nothing on a phone (#80)" };
  if (fit.sideways) return { status: "FAIL", what: "the page scrolls sideways on a 390 px phone (#80)" };
  if (fit.wider)
    return { status: "FAIL", what: `${fit.wider} of ${fit.lines} lines run past a 390 px phone's edge (#80)` };
  // Reflow keeps notes at 0.72 of their size or more, about 13 px. Smaller is hard to read in class.
  if (fit.noteHeight < 12.5)
    return { status: "FAIL", what: `notes are ${px} px tall on a 390 px phone, too small to read (#80)` };
  if (turned.wider || turned.sideways) {
    return {
      status: "FAIL",
      what: `turned sideways, ${turned.wider} of ${turned.lines} lines run past the screen (#80)`,
    };
  }
  return {
    status: "PASS",
    what: `all ${fit.lines} lines fit a 390 px phone, notes about ${px} px tall; turned sideways, ${turned.lines} lines fit`,
  };
}

/** Clicks SVG and PNG, and checks that each downloaded file holds the notation. */
async function checkExports(page) {
  const problems = [];
  const sizes = {};
  for (const kind of ["SVG", "PNG"]) {
    if (!(await page.getByRole("button", { name: kind, exact: true }).count())) {
      problems.push(`no ${kind} export`);
      continue;
    }
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 20000 }),
      page.getByRole("button", { name: kind, exact: true }).click(),
    ]).catch(() => [null]);
    const file = download && (await download.path());
    if (!file) {
      problems.push(`${kind} saved no file`);
      continue;
    }
    const bytes = readFileSync(file);
    if (kind === "SVG") {
      const svg = bytes.toString("utf8");
      const lines = (svg.match(/class="lineRootSVG"/g) || []).length;
      if (!svg.trimStart().startsWith("<svg") || !lines) problems.push("the SVG holds no notation lines");
      if (svg.includes("foreignObject")) problems.push("the SVG uses foreignObject");
      sizes.SVG = `${lines} lines, ${Math.round(bytes.length / 1024)} KB`;
    } else {
      const isPNG = bytes.subarray(1, 4).toString() === "PNG";
      const [w, h] = isPNG ? [bytes.readUInt32BE(16), bytes.readUInt32BE(20)] : [0, 0];
      if (!(w > 0 && h > 0)) problems.push("the PNG is empty or not a PNG");
      sizes.PNG = `${w}x${h}`;
    }
  }
  return { problems, summary: `SVG (${sizes.SVG}) and PNG (${sizes.PNG}) download` };
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
  const cursor = await checkCursor(page, song);
  if (clean.svgs === 0) report(1, "FAIL", "the song renders nothing");
  else if (withBad.svgs === 0) report(1, "FAIL", "one unknown command blanks the render");
  else
    report(
      1,
      clean.errors.length ? "CHECK" : "PASS",
      `${clean.svgs} lines render` +
        (clean.errors.length ? `, with ${clean.errors.length} parse errors: ${clean.errors[0]}` : "") +
        `; with \\noTala added, ${withBad.svgs} lines still render; ${cursor}`,
    );

  // 2. Export to PDF and PNG, or print.
  const printCount = await control(page, /print/i);
  let printed = false;
  if (printCount) {
    await page.getByRole("button", { name: /print/i }).first().click();
    await page.waitForTimeout(1000);
    printed = (await page.evaluate(() => window.__printCalls)) > 0;
    printed &&= (await page.locator(".notations-print-root svg").count()) > 0;
    await page.screenshot({ path: join(OUT, "step-2.png") });
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  }
  const exported = await checkExports(page);
  const problems = [
    !printCount ? "no print control" : !printed ? "Print did not print the notation" : "",
    ...exported.problems,
  ].filter(Boolean);
  if (problems.length) report(2, "FAIL", `${problems.join("; ")} (#74)`);
  else report(2, "PASS", `Print / PDF prints the notation alone; ${exported.summary}`);

  // 3. Play it back.
  if (await control(page, /play|midi|audio|listen/i)) report(3, "CHECK", "a playback control exists; listen by hand");
  else report(3, "FAIL", "no playback control (#75)");

  // 4. Save it and open the share link in a private window.
  const shared = await shareAndOpen(page, browser, song);
  report(4, shared.status, shared.what);

  // 5. Open that link on a phone.
  if (!shared.url) report(5, "SKIP", "needs a share link from step 4 (#80)");
  else {
    const phone = await openOnPhone(browser, shared.url);
    report(5, phone.status, phone.what);
  }

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
