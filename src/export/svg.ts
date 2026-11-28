/**
 * svg.ts - Exports a notation as one standalone SVG, or as a PNG drawn from it.
 *
 * The renderer's output is an HTML table, not one picture. Each notation line is its own <svg>,
 * headings and front matter are HTML rows, and CSS classes and variables colour them. So export
 * renders the source into a hidden container, then builds a new SVG from the pieces. Each line's
 * <svg> is copied in at its offset, with its computed styles written onto every element.
 * Margin labels, headings and front matter become SVG <text>, with <tspan> for bold and italic.
 *
 * It uses no <foreignObject>. A canvas that draws a foreignObject is tainted in Safari, so PNG
 * export would fail there, and apps other than browsers draw a foreignObject as a blank box.
 * The cost is that markdown beyond bold and italic (links, tables, images) exports as plain text.
 */

import { load } from "../loader";
import { NotationView } from "../carnatic";

/** Options for exportSVG, exportPNG and the download helpers. */
export interface ExportOptions {
  /** Renders RawBlock content (headings, front matter text). The default leaves it as is. */
  markdownParser?: (content: string) => string;
  /** How margin labels sit in their column. Defaults to the page's `--notation-margin-align`, else right. */
  marginAlign?: "left" | "center" | "right";
  /** Background colour, `"white"` by default. `null` leaves the background transparent. */
  background?: string | null;
  /** Space around the notation, in pixels. 16 by default. */
  padding?: number;
}

/** Options for exportPNG and downloadPNG. */
export interface PNGOptions extends ExportOptions {
  /** Pixels per SVG unit. 2 by default, which keeps text sharp on a high-density screen. */
  scale?: number;
}

const SVGNS = "http://www.w3.org/2000/svg";

// Export always uses the light theme, so a dark-mode page doesn't export pale notes onto white.
// These cover what the variables decide; forceLightTheme covers the rest.
const LIGHT_THEME: Record<string, string> = {
  "--notation-stroke-color": "black",
  "--notation-fill-color": "transparent",
  "--notation-text-color": "#1a1a1a",
  "--notation-border-color": "gray",
};

// The computed properties that decide how SVG shapes and text look.
const SVG_STYLE_PROPS = [
  "fill",
  "stroke",
  "stroke-width",
  "stroke-dasharray",
  "opacity",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "text-anchor",
  "dominant-baseline",
  "visibility",
];

const RENDERER_ATTRS = /^(id|atomid|beatid|beatindex|rolename|gridrow|gridcol)$/i;

const HEADING_SIZES: Record<string, number> = { H1: 28, H2: 24, H3: 20, H4: 17, H5: 15, H6: 14 };
const BODY_SIZE = 14;
const DEFAULT_TEXT_COLOR = "#1a1a1a";
const DEFAULT_FONT = "sans-serif";
const LABEL_GAP = 20; // the margin cell's left and right padding
const LINE_GAP = 10; // the line SVG's margin-bottom on screen

interface Run {
  text: string;
  bold: boolean;
  italic: boolean;
}

/**
 * Renders `source` and returns it as one standalone SVG document. It needs a browser (or jsdom),
 * since the renderer measures text in the DOM. The page needs the notations stylesheet loaded
 * for the colours to match the screen; without it, shapes fall back to black.
 */
export function exportSVG(source: string, options: ExportOptions = {}, doc: Document = document): string {
  return new XMLSerializer().serializeToString(buildSVG(source, options, doc).svg);
}

/**
 * Renders `source` and returns a PNG of it. The PNG is drawn from exportSVG's output, so it looks
 * the same. Rejects if the browser can't decode the SVG or has no canvas.
 */
export async function exportPNG(source: string, options: PNGOptions = {}, doc: Document = document): Promise<Blob> {
  const { svg, width, height } = buildSVG(source, options, doc);
  const scale = options.scale ?? 2;
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = doc.createElement("canvas");
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d canvas");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas.toBlob returned nothing"))), "image/png"),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Saves `source` as an SVG file named `filename`, through the browser's download. */
export function downloadSVG(
  source: string,
  filename = "notation.svg",
  options: ExportOptions = {},
  doc: Document = document,
): void {
  save(new Blob([exportSVG(source, options, doc)], { type: "image/svg+xml" }), filename, doc);
}

/** Saves `source` as a PNG file named `filename`, through the browser's download. */
export async function downloadPNG(
  source: string,
  filename = "notation.png",
  options: PNGOptions = {},
  doc: Document = document,
): Promise<void> {
  save(await exportPNG(source, options, doc), filename, doc);
}

function save(blob: Blob, filename: string, doc: Document): void {
  const url = URL.createObjectURL(blob);
  const a = doc.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function buildSVG(
  source: string,
  options: ExportOptions,
  doc: Document,
): { svg: SVGSVGElement; width: number; height: number } {
  const host = doc.createElement("div");
  host.style.cssText = "position: fixed; left: -100000px; top: 0; width: max-content;";
  for (const k of Object.keys(LIGHT_THEME)) host.style.setProperty(k, LIGHT_THEME[k]);
  doc.body.appendChild(host);
  const restoreTheme = forceLightTheme(doc);
  try {
    const [notation, beatLayout] = load(source, { log: false });
    const view = new NotationView(host, { markdownParser: options.markdownParser, marginAlign: options.marginAlign });
    view.renderNotation(notation, beatLayout);
    return compose(view.tableElement, options, doc);
  } finally {
    restoreTheme();
    host.remove();
  }
}

/**
 * Switches the page to the light theme until the returned function runs. Some colours, such as
 * the swara colour, come from `:root.dark` and `prefers-color-scheme` rules rather than variables,
 * so the light variables on the host alone don't cover them. Export reads every colour and
 * switches back in one synchronous run, so the page never repaints in the light theme.
 */
function forceLightTheme(doc: Document): () => void {
  const root = doc.documentElement;
  const hadDark = root.classList.contains("dark");
  const hadLight = root.classList.contains("light");
  const theme = root.getAttribute("data-theme");
  root.classList.remove("dark");
  root.classList.add("light");
  if (theme !== null) root.setAttribute("data-theme", "light");
  return () => {
    if (hadDark) root.classList.add("dark");
    if (!hadLight) root.classList.remove("light");
    if (theme !== null) root.setAttribute("data-theme", theme);
  };
}

function compose(
  table: HTMLTableElement,
  options: ExportOptions,
  doc: Document,
): { svg: SVGSVGElement; width: number; height: number } {
  const pad = options.padding ?? 16;
  // XMLSerializer writes the xmlns itself, since the element is in the SVG namespace.
  const svg = doc.createElementNS(SVGNS, "svg") as SVGSVGElement;
  const rows = [...table.rows];

  // The margin column is as wide as its longest label, as on screen (#97).
  const labelCells = rows.map((r) => r.querySelector<HTMLElement>("td.lineAnnotationCell"));
  const labelFont = (cell: HTMLElement) => fontOf(cell, BODY_SIZE);
  const labelWidths = labelCells.map((c) =>
    c && c.textContent?.trim() ? measure(c.textContent.trim(), labelFont(c)) : 0,
  );
  const marginW = Math.max(0, ...labelWidths);
  const gutter = marginW > 0 ? marginW + LABEL_GAP : 0;
  const align = options.marginAlign ?? marginAlignOf(labelCells.find((c) => c) ?? null);
  const contentX = pad + gutter;

  const lineSVGs = rows.map((r) => r.querySelector<SVGSVGElement>("svg.lineRootSVG"));
  const widestLine = Math.max(0, ...lineSVGs.map((s) => Number(s?.getAttribute("width") ?? 0)));
  const textWidth = Math.max(widestLine, 480);

  const body: Element[] = [];
  let y = pad;
  let right = contentX + widestLine;
  rows.forEach((row, i) => {
    const line = lineSVGs[i];
    if (line) {
      const w = Number(line.getAttribute("width") ?? 0);
      const h = Number(line.getAttribute("height") ?? 0);
      if (!(w > 0 && h > 0)) return;
      const copy = withInlineStyles(line);
      copy.setAttribute("x", String(round(contentX)));
      copy.setAttribute("y", String(round(y)));
      body.push(copy);
      const cell = labelCells[i];
      const label = cell?.textContent?.trim();
      if (cell && label) {
        const font = labelFont(cell);
        const x = align === "left" ? pad : align === "center" ? pad + marginW / 2 : pad + marginW;
        const t = textNode(
          doc,
          [{ text: label, bold: false, italic: false }],
          x,
          y + 10 + font.size * 0.8,
          font,
          colorOf(cell),
        );
        t.setAttribute("text-anchor", align === "left" ? "start" : align === "center" ? "middle" : "end");
        body.push(t);
      }
      y += h + LINE_GAP;
      return;
    }
    const cell = row.querySelector<HTMLElement>("td");
    if (!cell) return;
    for (const block of blocksOf(cell)) {
      if (block.tagName === "HR") {
        const hr = doc.createElementNS(SVGNS, "line");
        setAttrs(hr, { x1: pad, x2: pad + gutter + textWidth, y1: y + 6, y2: y + 6 });
        hr.setAttribute("stroke", "gray");
        body.push(hr);
        y += 12;
        continue;
      }
      const font = fontOf(block, HEADING_SIZES[block.tagName] ?? BODY_SIZE, block.tagName in HEADING_SIZES);
      const color = colorOf(block);
      for (const runs of wrap(runsOf(block, font.bold), textWidth + gutter, font)) {
        body.push(textNode(doc, runs, pad, y + font.size, font, color));
        right = Math.max(
          right,
          pad +
            Math.min(
              textWidth + gutter,
              runs.reduce((n, r) => n + measure(r.text, font), 0),
            ),
        );
        y += font.size * 1.4;
      }
      y += font.size * 0.4;
    }
  });

  const width = Math.ceil(right + pad);
  const height = Math.ceil(y + pad);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const background = options.background === undefined ? "white" : options.background;
  if (background !== null) {
    const rect = doc.createElementNS(SVGNS, "rect");
    setAttrs(rect, { x: 0, y: 0, width, height, fill: background });
    svg.appendChild(rect);
  }
  for (const el of body) svg.appendChild(el);
  return { svg, width, height };
}

/**
 * A deep copy of `line` with each element's computed look written onto it as a style attribute.
 * A property is written only where it differs from the parent's, since the copy's elements inherit
 * the rest. That keeps a whole song's SVG a few hundred KB instead of a few MB.
 */
function withInlineStyles(line: SVGSVGElement): SVGSVGElement {
  const copy = line.cloneNode(true) as SVGSVGElement;
  const from = [line, ...line.querySelectorAll("*")];
  const to = [copy, ...copy.querySelectorAll("*")];
  const win = line.ownerDocument.defaultView;
  const computed = new Map<Element, Record<string, string>>();
  const styleOf = (el: Element): Record<string, string> => {
    let s = computed.get(el);
    if (!s) {
      const cs = win?.getComputedStyle(el);
      s = {};
      for (const p of SVG_STYLE_PROPS) s[p] = cs?.getPropertyValue(p) ?? "";
      computed.set(el, s);
    }
    return s;
  };
  from.forEach((el, i) => {
    const own = styleOf(el);
    const parent = i === 0 ? null : styleOf(el.parentElement!);
    const decls: string[] = [];
    for (const p of SVG_STYLE_PROPS) {
      const v = own[p];
      if (!v || v === "normal" || v === "auto") continue;
      if (parent && parent[p] === v && p !== "opacity") continue;
      if (p === "opacity" && v === "1") continue;
      decls.push(`${p}: ${v}`);
    }
    // A DOM without SVG styling (jsdom) computes no fill. Text still needs one to be readable.
    if (el.tagName === "text" && !own.fill) decls.push(`fill: ${DEFAULT_TEXT_COLOR}`);
    if (decls.length) to[i].setAttribute("style", decls.join("; "));
    else to[i].removeAttribute("style");
    // The renderer's ids, classes and beat bookkeeping mean nothing outside the page, and the ids
    // would clash if two exports were put in one document.
    for (const a of [...to[i].attributes]) if (RENDERER_ATTRS.test(a.name)) to[i].removeAttribute(a.name);
    if (i > 0) to[i].removeAttribute("class");
  });
  return copy;
}

interface Font {
  size: number;
  family: string;
  bold: boolean;
}

function fontOf(el: Element, fallbackSize: number, bold = false): Font {
  const cs = el.ownerDocument.defaultView?.getComputedStyle(el);
  const size = parseFloat(cs?.fontSize ?? "");
  const weight = cs?.fontWeight ?? "";
  return {
    size: size > 0 ? size : fallbackSize,
    family: cs?.fontFamily || DEFAULT_FONT,
    bold: bold || weight === "bold" || Number(weight) >= 600,
  };
}

function colorOf(el: Element): string {
  const c = el.ownerDocument.defaultView?.getComputedStyle(el).color ?? "";
  return c && c !== "canvastext" ? c : DEFAULT_TEXT_COLOR;
}

function marginAlignOf(cell: Element | null): "left" | "center" | "right" {
  const v = cell
    ? cell.ownerDocument.defaultView?.getComputedStyle(cell).getPropertyValue("--notation-margin-align").trim()
    : "";
  return v === "left" || v === "center" ? v : "right";
}

const BLOCK_TAGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6", "P", "LI", "PRE", "HR", "BLOCKQUOTE"]);

/** The text blocks in a raw row, top to bottom. A row with no block elements is one block. */
function blocksOf(cell: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  const walk = (el: HTMLElement) => {
    for (const child of el.children) {
      const c = child as HTMLElement;
      if (BLOCK_TAGS.has(c.tagName) && !(c.tagName === "BLOCKQUOTE" && c.querySelector("p, li"))) out.push(c);
      else walk(c);
    }
  };
  walk(cell);
  return out.length ? out : cell.textContent?.trim() ? [cell] : [];
}

/** The block's text as runs of plain, bold and italic, in order. */
function runsOf(block: Element, bold: boolean): Run[] {
  const runs: Run[] = [];
  const walk = (node: Node, b: boolean, i: boolean) => {
    if (node.nodeType === 3) {
      const text = (node.textContent ?? "").replace(/\s+/g, " ");
      if (text) runs.push({ text, bold: b, italic: i });
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = (node as Element).tagName;
    const nb = b || tag === "STRONG" || tag === "B";
    const ni = i || tag === "EM" || tag === "I";
    for (const child of node.childNodes) walk(child, nb, ni);
  };
  walk(block, bold, false);
  if (runs.length) {
    runs[0].text = runs[0].text.replace(/^\s+/, "");
    runs[runs.length - 1].text = runs[runs.length - 1].text.replace(/\s+$/, "");
  }
  return runs.filter((r) => r.text);
}

/** Splits runs into lines no wider than `width`, breaking between words. */
function wrap(runs: Run[], width: number, font: Font): Run[][] {
  const lines: Run[][] = [[]];
  let used = 0;
  for (const run of runs) {
    for (const word of run.text.match(/[^ ]+ *| +/g) ?? []) {
      const w = measure(word, font);
      if (used > 0 && used + w > width) {
        lines.push([]);
        used = 0;
      }
      const cur = lines[lines.length - 1];
      const last = cur[cur.length - 1];
      const text = used === 0 ? word.replace(/^ /, "") : word;
      if (last && last.bold === run.bold && last.italic === run.italic) last.text += text;
      else cur.push({ text, bold: run.bold, italic: run.italic });
      used += w;
    }
  }
  return lines.filter((l) => l.length);
}

let measureCtx: { font: string; measureText(t: string): { width: number } } | null | undefined;

/** The width of `text` in `font`. Without a canvas (jsdom), an estimate from the character count. */
function measure(text: string, font: Font): number {
  if (measureCtx === undefined) {
    measureCtx = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(1, 1).getContext("2d") : null;
  }
  if (!measureCtx) return text.length * font.size * 0.55;
  measureCtx.font = `${font.bold ? "bold " : ""}${font.size}px ${font.family}`;
  return measureCtx.measureText(text).width;
}

const round = (n: number) => Math.round(n * 10) / 10;

function setAttrs(el: Element, attrs: Record<string, string | number>): void {
  for (const k of Object.keys(attrs)) el.setAttribute(k, String(attrs[k]));
}

function textNode(doc: Document, runs: Run[], x: number, y: number, font: Font, color: string): SVGTextElement {
  const t = doc.createElementNS(SVGNS, "text") as SVGTextElement;
  t.setAttribute("x", String(round(x)));
  t.setAttribute("y", String(round(y)));
  t.setAttribute("fill", color);
  t.setAttribute("font-family", font.family);
  t.setAttribute("font-size", String(font.size));
  if (font.bold) t.setAttribute("font-weight", "bold");
  t.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
  for (const r of runs) {
    if (!r.bold && !r.italic && runs.length === 1) {
      t.textContent = r.text;
      break;
    }
    const span = doc.createElementNS(SVGNS, "tspan");
    if (r.bold && !font.bold) span.setAttribute("font-weight", "bold");
    if (r.italic) span.setAttribute("font-style", "italic");
    span.textContent = r.text;
    t.appendChild(span);
  }
  return t;
}
