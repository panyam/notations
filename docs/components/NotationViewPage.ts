/**
 * NotationViewPage.ts - /view/: a notation someone shared, on its own, sized to the screen.
 *
 * The playground's Share gives a /view/#s=<link> URL that carries the source (share.ts, #77).
 * This page decodes it and renders the notation full width, scaled so the widest line fits, but no
 * smaller than MIN_SCALE of its size, so notes stay readable on a phone. Rows still too wide break
 * again at bar lines (NotationView.reflow, #80), and again whenever the window resizes. It offers the same Print / PDF, SVG and PNG as the
 * playground, and a link to open the notation in the playground to edit.
 */
import { load } from "../../src/loader";
import { NotationView } from "../../src/carnatic";
import { downloadPNG, downloadSVG, fitLinesToWidth, printNotation } from "../../src/entry-export";
import { createMarkdownParser } from "./NotationViewer";
import { decodeSource, initialSource } from "./share";
import "../../styles/NotationView.scss";

const markdownParser = createMarkdownParser();

/** Notes shrink to no less than this share of their size, about 13 px tall. */
const MIN_SCALE = 0.72;

let current: string | null = null;
let view: NotationView | null = null;

function show(id: string, on: boolean): void {
  const el = document.getElementById(id);
  if (el) el.hidden = !on;
}

/** Renders the notation the page's #s= link carries, or says why there is none. */
export async function renderView(): Promise<string | null> {
  const root = document.getElementById("view-root")!;
  root.innerHTML = "";
  const first = initialSource({ hash: location.hash, search: "", draft: null });
  const source = first.kind == "link" ? await decodeSource(first.link) : null;
  show("view-empty", first.kind != "link");
  show("view-damaged", first.kind == "link" && source == null);
  show("view-actions", source != null);
  view = null;
  if (source == null) return null;

  const [notation, beatLayout] = load(source, { log: false });
  view = new NotationView(root, { markdownParser });
  view.renderNotation(notation, beatLayout);
  fit(view, root, source);

  const edit = document.getElementById("view-edit") as HTMLAnchorElement | null;
  if (edit && first.kind == "link") edit.href = `../demos/playgrounds/side-by-side/#s=${first.link}`;
  return source;
}

function fit(v: NotationView, root: HTMLElement, source: string): void {
  v.reflow(root.clientWidth, source, { minScale: MIN_SCALE });
  fitLinesToWidth(root, { minScale: MIN_SCALE });
}

/** Re-breaks rows when the window's width changes, as when a phone turns sideways. */
function refitOnResize(root: HTMLElement): void {
  let lastWidth = root.clientWidth;
  let pending = 0;
  new ResizeObserver(() => {
    if (root.clientWidth == lastWidth || pending) return;
    pending = requestAnimationFrame(() => {
      pending = 0;
      lastWidth = root.clientWidth;
      if (view && current) fit(view, root, current);
    });
  }).observe(root);
}

async function start(): Promise<void> {
  current = await renderView();
  refitOnResize(document.getElementById("view-root")!);
  document.getElementById("view-print")?.addEventListener("click", () => {
    if (current) printNotation(current, { markdownParser });
  });
  document.getElementById("view-svg")?.addEventListener("click", () => {
    if (current) downloadSVG(current, "notation.svg", { markdownParser });
  });
  document.getElementById("view-png")?.addEventListener("click", () => {
    if (current) downloadPNG(current, "notation.png", { markdownParser });
  });
  window.addEventListener("hashchange", async () => {
    current = await renderView();
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => start());
else start();
