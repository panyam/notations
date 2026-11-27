/**
 * print.ts - Prints a notation on its own, sized to the page.
 *
 * A playground prints badly as it stands. The browser prints the header, the editor and the
 * console, and the output panel cuts off any line wider than the panel. So printing renders the
 * source again into a copy at the end of <body>, and a print stylesheet hides everything else.
 * Each line's SVG gets a viewBox in place of its pixel size, so a wide line scales down to the
 * page instead of running off it, and every line scales by the same factor. "Save as PDF" in the
 * print dialog gives the PDF.
 */

import { load } from "../loader";
import { NotationView } from "../carnatic";

/** Options for preparePrint and printNotation. */
export interface PrintOptions {
  /** Renders RawBlock content (headings, front matter text). The default leaves it as is. */
  markdownParser?: (content: string) => string;
}

const ROOT_CLASS = "notations-print-root";
const BODY_CLASS = "notations-printing";

const PRINT_CSS = `
.${ROOT_CLASS} { display: none; }
@media print {
  body.${BODY_CLASS} > :not(.${ROOT_CLASS}) { display: none !important; }
  body.${BODY_CLASS} { overflow: visible !important; height: auto !important; }
  body.${BODY_CLASS} > .${ROOT_CLASS} { display: block; }
  .${ROOT_CLASS} table { width: 100%; border-collapse: collapse; }
  .${ROOT_CLASS} tr { break-inside: avoid; }
  .${ROOT_CLASS} svg.lineRootSVG { display: block; max-width: 100%; height: auto; }
}
`;

function ensureStylesheet(doc: Document): void {
  if (doc.querySelector("style[data-notations-print]")) return;
  const style = doc.createElement("style");
  style.setAttribute("data-notations-print", "");
  style.textContent = PRINT_CSS;
  doc.head.appendChild(style);
}

/**
 * Renders `source` into a print-only copy at the end of `doc.body`, so that the page prints the
 * notation and nothing else. Lines the source fails to parse are left out; the rest still print.
 *
 * Returns a function that removes the copy. Call it once the print dialog closes, which is when
 * `afterprint` fires.
 */
export function preparePrint(source: string, options: PrintOptions = {}, doc: Document = document): () => void {
  ensureStylesheet(doc);
  doc.querySelectorAll(`.${ROOT_CLASS}`).forEach((el) => el.remove());

  const root = doc.createElement("div");
  root.className = ROOT_CLASS;
  doc.body.appendChild(root);
  doc.body.classList.add(BODY_CLASS);

  const [notation, beatLayout] = load(source, { log: false });
  const view = new NotationView(root, { markdownParser: options.markdownParser });
  // The renderer measures text, which needs the copy laid out, so show it while rendering.
  root.style.display = "block";
  view.renderNotation(notation, beatLayout);
  root.style.display = "";

  // One scale for the whole piece. The widest line fills the page and the rest keep their
  // proportion, so a short closing line prints with notes the same size as a full cycle.
  // min() keeps a line from growing past its own width when the page is wider than the piece.
  const lines = [...root.querySelectorAll<SVGSVGElement>("svg.lineRootSVG")]
    .map((svg) => ({ svg, w: Number(svg.getAttribute("width")), h: Number(svg.getAttribute("height")) }))
    .filter((l) => l.w > 0 && l.h > 0);
  const widest = Math.max(0, ...lines.map((l) => l.w));
  for (const { svg, w, h } of lines) {
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.style.width = `min(${w}px, ${+((w / widest) * 100).toFixed(3)}%)`;
  }

  return () => {
    root.remove();
    doc.body.classList.remove(BODY_CLASS);
  };
}

/**
 * Opens the print dialog for `source` alone. The copy from preparePrint stays in place until
 * `afterprint`, since some browsers return from `print()` before the dialog closes.
 */
export function printNotation(source: string, options: PrintOptions = {}, doc: Document = document): void {
  const win = doc.defaultView ?? window;
  const cleanup = preparePrint(source, options, doc);
  win.addEventListener("afterprint", cleanup, { once: true });
  win.print();
}
