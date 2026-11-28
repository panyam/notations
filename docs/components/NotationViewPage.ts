/**
 * NotationViewPage.ts - /view/: a notation someone shared, on its own, sized to the screen.
 *
 * The playground's Share gives a /view/#s=<link> URL that carries the source (share.ts, #77).
 * This page decodes it and renders the notation full width, scaled so the widest line fits, but no
 * smaller than 0.6 of its size, so notes stay readable on a phone. A line still wider than the
 * screen scrolls sideways inside the notation box (#80). It offers the same Print / PDF, SVG and PNG as the
 * playground, and a link to open the notation in the playground to edit.
 */
import { load } from "../../src/loader";
import { NotationView } from "../../src/carnatic";
import { downloadPNG, downloadSVG, fitLinesToWidth, printNotation } from "../../src/entry-export";
import { createMarkdownParser } from "./NotationViewer";
import { decodeSource, initialSource } from "./share";
import "../../styles/NotationView.scss";

const markdownParser = createMarkdownParser();

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
  if (source == null) return null;

  const [notation, beatLayout] = load(source, { log: false });
  const view = new NotationView(root, { markdownParser });
  view.renderNotation(notation, beatLayout);
  // Notes stay about 10 px or larger on a phone. A wider line scrolls inside #view-root (#80).
  fitLinesToWidth(root, { minScale: 0.6 });

  const edit = document.getElementById("view-edit") as HTMLAnchorElement | null;
  if (edit && first.kind == "link") edit.href = `../demos/playgrounds/side-by-side/#s=${first.link}`;
  return source;
}

let current: string | null = null;

async function start(): Promise<void> {
  current = await renderView();
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
