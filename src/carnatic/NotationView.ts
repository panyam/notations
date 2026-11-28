import * as TSU from "@panyam/tsutils";
import { LineView } from "./LineView";
import { Notation, RawBlock, Block, BlockItem, isLine, isBlock, isRawBlock } from "../notation";
import { Beat, GlobalBeatLayout } from "../beats";
import { LayoutParams, breaksToFit } from "../layouts";
import { load, layoutParamsIn } from "../loader";
import { GridCell, GridCellView, GridLayoutGroup, LayoutChangeEvent } from "../grids";
import { Atom, Line } from "../core";
import { walkAtoms } from "../positions";
import { BeatView, MarkerView } from "./beatviews";

/**
 * Configuration options for NotationView.
 */
export interface NotationViewConfig {
  /**
   * Optional shared GridLayoutGroup for column alignment across multiple NotationViews.
   * When provided, this view will share column widths with other views using the same group.
   */
  sharedGridLayoutGroup?: GridLayoutGroup;

  /**
   * Optional markdown parser for RawBlock content.
   */
  markdownParser?: (contents: string) => string;

  /**
   * How margin labels (`\line(marginText = ...)`) sit in their column. The column is only as wide
   * as its longest label. Without this, the `--notation-margin-align` CSS variable decides, and it
   * defaults to `"right"`, which keeps every label the same distance from the first bar line.
   */
  marginAlign?: "left" | "center" | "right";
}

export class NotationView {
  headerElement: HTMLDivElement;
  notation: Notation;
  lineViews: LineView[] = [];
  // Mapping from line id -> list of beats in each of its roles
  currentSVGElement: SVGSVGElement | null = null;
  tableElement: HTMLTableElement;
  markdownParser: (contents: string) => string;
  _beatLayout: GlobalBeatLayout;

  /** Unsubscribe function for layout change listener */
  private layoutChangeUnsubscribe: (() => void) | null = null;

  constructor(
    public readonly rootElement: HTMLElement,
    public readonly config?: NotationViewConfig,
  ) {
    this.loadChildViews();
    // Default to identity function if no markdown parser provided
    this.markdownParser = config?.markdownParser ?? ((content) => content);
  }

  get beatLayout(): GlobalBeatLayout {
    return this._beatLayout;
  }

  set beatLayout(beatLayout: GlobalBeatLayout) {
    this._beatLayout = beatLayout;
    beatLayout.gridLayoutGroup.getCellView = (cell) => this.viewForBeat(cell);
  }

  loadChildViews(): void {
    this.tableElement = TSU.DOM.createNode("table", {
      parent: this.rootElement,
      attrs: {
        class: "notationsContentRootTable",
      },
    }) as HTMLTableElement;
    if (this.config?.marginAlign) {
      this.tableElement.style.setProperty("--notation-margin-align", this.config.marginAlign);
    }
  }

  renderNotation(notation: Notation, beatLayout: GlobalBeatLayout): void {
    this.notation = notation;
    this.beatLayout = beatLayout;
    const startTime = performance.now();
    this.refreshLayout();
    const layoutTime = performance.now();
    console.log(`V4 Document, Layout Time: ${layoutTime - startTime}ms`);
  }

  public addNewRow(id: string, prefix: string, withAnnotation = true): [HTMLElement, HTMLElement] {
    const tr = TSU.DOM.createNode("tr", {
      parent: this.tableElement, // parent,
      attrs: {
        class: prefix + "Row",
        id: prefix + "Row" + id,
      },
    });
    let td1: HTMLElement | null = null;
    if (withAnnotation) {
      td1 = TSU.DOM.createNode("td", {
        parent: tr,
        attrs: {
          class: prefix + "AnnotationCell",
          id: prefix + "Annotation" + id,
        },
      }) as HTMLElement;
    }
    const td2 = TSU.DOM.createNode("td", {
      parent: tr,
      attrs: {
        class: prefix + "ContentCell",
        id: prefix + "Content" + id,
        colspan: withAnnotation ? 1 : 2,
      },
    }) as HTMLElement;
    return [td1!, td2];
  }

  public newLineRoot(parent: Element, line: Line): SVGSVGElement {
    const [td1, td2] = this.addNewRow(line.uuid + "", "line");
    // Hacky solution to "line headings"
    if (line.marginText) {
      td1.innerHTML = line.marginText;
    }
    return TSU.DOM.createSVGNode("svg", {
      parent: td2, // parent
      attrs: {
        style: "margin-bottom: 10px",
        class: "lineRootSVG",
      },
    }) as SVGSVGElement;
  }

  ensureLineView(line: Line): LineView {
    let lineView = this.getLineView(line);
    if (lineView == null) {
      const layoutParams = line.layoutParams || null;
      const svgElem = this.newLineRoot(this.tableElement, line);
      lineView = new LineView(svgElem, line, {
        layoutParams: layoutParams,
      } as any);
      if (!line.isEmpty) {
        // Probably because this is an empty line and AddAtoms was not called
        TSU.assert(layoutParams != null, "Layout params for a non empty line *should* exist");
        lineView.gridModel = this.beatLayout!.getGridModelForLine(line.uuid);
      }
      this.lineViews.push(lineView);
    }
    return lineView;
  }

  getLineView(line: Line): TSU.Nullable<LineView> {
    return this.lineViews.find((l) => l.line == line) || null;
  }

  get currentLineView(): LineView {
    return this.lineViews[this.lineViews.length - 1];
  }

  private atomsByUuid: Map<number, Atom> | null = null;

  /**
   * The rendered elements of `atom`: its root group, plus the root of any continuation drawn where
   * a note runs over a beat. `atom` can be the parsed atom or one derived from it. Empty when the
   * atom isn't on this view.
   */
  elementsFor(atom: Atom): Element[] {
    const uuid = (atom.origin ?? atom).uuid;
    return [...this.tableElement.querySelectorAll(`[sourceatomid="${uuid}"]`)];
  }

  /**
   * The parsed atom drawn at `element` or at its nearest ancestor that belongs to an atom, such as
   * the atom under a click. Null outside any atom, as on a bar line or a heading.
   */
  atomFor(element: Element): Atom | null {
    const el = element.closest("[sourceatomid]");
    if (!el || !this.tableElement.contains(el)) return null;
    if (!this.atomsByUuid) {
      this.atomsByUuid = new Map();
      for (const atom of walkAtoms(this.notation)) this.atomsByUuid.set(atom.uuid, atom);
    }
    return this.atomsByUuid.get(Number(el.getAttribute("sourceatomid"))) ?? null;
  }

  /**
   * Adds the class `mark-<name>` to `atom`'s elements, for a host to show "playing", "cursor" or
   * "selected". It is static: a player or an editor calls it from its own events, and this view
   * runs no clock (src/ARCHITECTURE.md). The stylesheet styles `mark-playing` and `mark-cursor`.
   */
  mark(atom: Atom, name: string): void {
    for (const el of this.elementsFor(atom)) el.classList.add(`mark-${name}`);
  }

  /** Takes `mark-<name>` off `atom`'s elements, or off every element on this view without an atom. */
  unmark(name: string, atom?: Atom): void {
    const els = atom ? this.elementsFor(atom) : [...this.tableElement.querySelectorAll(`.mark-${name}`)];
    for (const el of els) el.classList.remove(`mark-${name}`);
  }

  clear(): void {
    this.atomsByUuid = null;
    this.lineViews = [];
    // Mapping from line id -> list of beats in each of its roles
    this.currentSVGElement = null;
    this.tableElement.innerHTML = "";
    this.beatViews = new Map<number, BeatView>();
    this.markerViews = new Map<string, MarkerView>();
  }

  /** The source reflow last laid out, and the breaks its author wrote, one per layout. */
  private reflowed: { source: string; authorBreaks: number[][] } | null = null;

  /**
   * Breaks rows wider than `width` pixels again and renders again, for a screen narrower than the
   * song (#80). A wider screen restores the author's `\breaks`. Call it after renderNotation with
   * the source that rendered, while the view is in the page, since it measures the drawn beats.
   *
   * `minScale` says how far the caller will shrink a row to fit, as `fitLinesToWidth` does, so a
   * row may be `width / minScale` wide. `breaksToFit` picks the breaks. Laying out shortens the
   * notation's atoms in place, so a new layout needs a fresh parse: reflow loads `source` again
   * with the new breaks, and `notation` and `beatLayout` then hold the result. Returns true when it
   * rendered again.
   */
  reflow(width: number, source: string, options: { minScale?: number } = {}): boolean {
    const minScale = options.minScale ?? 1;
    if (width <= 0 || !this.notation) return false;
    const layouts = layoutParamsIn(this.notation);
    if (this.reflowed?.source !== source) {
      this.reflowed = { source, authorBreaks: layouts.map((lp) => [...lp.lineBreaks]) };
    }
    const authorBreaks = this.reflowed.authorBreaks;
    const room = width - this.lineChrome();
    const measured = this.measureBeats();
    let changed = false;
    const breaks = layouts.map((lp, i) => {
      const m = measured.get(lp);
      if (!m) return lp.lineBreaks;
      const fit = breaksToFit(lp.cycle, m.widths, room / minScale - m.overhead, authorBreaks[i]);
      if (!lp.lineBreaksEqual(fit)) changed = true;
      return fit;
    });
    if (!changed) return false;
    const [notation, beatLayout] = load(source, { breaks });
    this.clear();
    this.renderNotation(notation, beatLayout);
    return true;
  }

  /**
   * The width a line's row takes beside its SVG, which doesn't scale with it: the margin label
   * column, and the gaps and padding around the cells.
   */
  private lineChrome(): number {
    const svg = this.tableElement.querySelector<SVGSVGElement>("svg.lineRootSVG");
    const cell = svg?.parentElement;
    if (!svg || !cell) return 0;
    const style = getComputedStyle(cell);
    const left = cell.getBoundingClientRect().left - this.tableElement.getBoundingClientRect().left;
    const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    // The table's border-spacing sits to the right of the last cell as well as between cells.
    const spacing = parseFloat(getComputedStyle(this.tableElement).borderSpacing) || 0;
    return left + padding + spacing;
  }

  /**
   * The drawn width of each beat of every layout's cycle, the widest wherever that beat shows,
   * together with the width a row takes beyond its beats.
   */
  private measureBeats(): Map<LayoutParams, { widths: number[]; overhead: number }> {
    const out = new Map<LayoutParams, { widths: number[]; overhead: number }>();
    for (const lineView of this.lineViews) {
      const lp = lineView.line.layoutParams;
      if (!lp || !lineView.gridModel) continue;
      const n = lp.cycle.beatCount;
      let entry = out.get(lp);
      if (!entry) {
        entry = { widths: new Array(n).fill(0), overhead: 0 };
        out.set(lp, entry);
      }
      let left = Infinity;
      let right = 0;
      for (const row of lineView.gridModel.rows) {
        // A beat runs from its first column to where the next beat starts, so gaps count.
        const starts = new Map<number, number>();
        let rowRight = 0;
        for (const cell of row.cells) {
          if (!cell?.value || !cell.colAlign) continue;
          const beat: Beat = cell.colIndex % 3 == 1 ? cell.value : cell.value.beat;
          const x = cell.colAlign.coordOffset;
          starts.set(beat.index, Math.min(starts.get(beat.index) ?? Infinity, x));
          left = Math.min(left, x);
          rowRight = Math.max(rowRight, x + cell.colAlign.maxLength);
        }
        right = Math.max(right, rowRight);
        const ordered = [...starts].sort((a, b) => a[1] - b[1]);
        ordered.forEach(([index, x], i) => {
          const end = i + 1 < ordered.length ? ordered[i + 1][1] : rowRight;
          const p = ((index % n) + n) % n;
          entry.widths[p] = Math.max(entry.widths[p], end - x);
        });
      }
      const svg = lineView.rootElement;
      const drawn = Number(svg.getAttribute("width")) || svg.viewBox?.baseVal?.width || 0;
      if (right > left) entry.overhead = Math.max(entry.overhead, drawn - (right - left));
    }
    return out;
  }

  /**
   * Layout all the blocks in the Notation along with their corresponding blocks.
   * Key thing is here is an opportunity to perform any batch rendering as needed.
   */
  refreshLayout(): void {
    const lineViews = [] as LineView[];

    // Recursively process the notation (which is a Block) and collect LineViews
    this.processBlock(this.notation, lineViews);

    const now = performance.now();
    for (const lineView of lineViews) {
      lineView.gridModel.lastUpdatedAt = now;
    }

    this.beatLayout.gridLayoutGroup.refreshLayout();

    for (const lineView of lineViews) {
      lineView.wrapToSize();
    }
  }

  /**
   * Recursively processes a block and its children for rendering.
   * Uses block.children() to get expanded children (e.g., RepeatBlock expands to N copies).
   *
   * @param block The block to process
   * @param lineViews Array to collect LineViews for batch layout
   */
  protected processBlock(block: Block, lineViews: LineView[]): void {
    for (const child of block.children()) {
      this.processBlockItem(child, lineViews);
    }
  }

  /**
   * Processes a single block item (Block, Line, or RawBlock) for rendering.
   *
   * @param item The item to process
   * @param lineViews Array to collect LineViews for batch layout
   */
  protected processBlockItem(item: BlockItem, lineViews: LineView[]): void {
    if (isRawBlock(item)) {
      // Render raw content (markdown, metadata)
      this.renderBlock(item as RawBlock);
    } else if (isLine(item)) {
      // Render line
      const line = item as Line;
      if (!line.isEmpty) {
        const lineView = this.ensureLineView(line);
        lineViews.push(lineView);
      }
    } else if (isBlock(item)) {
      // Recursively process nested block
      this.processBlock(item as Block, lineViews);
    }
  }

  renderBlock(raw: RawBlock): void {
    const [, td2] = this.addNewRow(raw.uuid + "", "rawBlock", false);
    if (raw.contentType == "metadata") {
      // we have a metadata block
      const meta = this.notation.metadata.get(raw.content);
      if (meta) {
        // For now ignore metadata with ":" in the key
        if (meta.key.toLowerCase().indexOf(":") < 0) {
          const div = td2.appendChild(TSU.DOM.createNode("div"));
          const html = `<span class = "${meta.key.toLowerCase()}"><strong>${meta.key}</strong>: ${meta.value}</span>`;
          div.innerHTML = html;
        }
      }
    } else {
      const div = td2.appendChild(TSU.DOM.createNode("div"));
      div.innerHTML = this.markdownParser(raw.content.trim());
    }
    this.currentSVGElement = null;
  }

  beatViews = new Map<number, BeatView>();
  markerViews = new Map<string, MarkerView>();
  viewForBeat(cell: GridCell): GridCellView {
    if (cell.colIndex % 3 == 1) {
      // beat view needed
      const beat = cell.value;
      let curr = this.beatViews.get(beat.uuid) || null;
      if (curr == null) {
        const line = beat.role.line;
        // how to get the bar and beat index for a given beat in a given row?
        const lineView = this.ensureLineView(line);
        const lp = line.layoutParams;
        curr = new BeatView(cell, beat, lineView.gElem, lp.cycle);
        this.beatViews.set(beat.uuid, curr);

        // Eagerly position view based on current alignment offsets.
        // Since BFS layout processes alignments in order, predecessors are already positioned.
        this.eagerlyPositionView(curr, cell);
      }
      return curr;
    } else {
      // markers view
      const marker = cell.value;
      const beat = marker.beat as Beat;
      let curr = this.markerViews.get("pre:" + beat.uuid) || null;
      if (curr == null) {
        const line = beat.role.line;
        const lineView = this.ensureLineView(line);
        const lp = line.layoutParams;
        const isPreMarker = cell.colIndex % 3 == 0;
        curr = new MarkerView(cell, beat, marker.markers, isPreMarker, lineView.gElem);
        this.markerViews.set("pre:" + beat.uuid, curr);

        // Eagerly position view based on current alignment offsets.
        this.eagerlyPositionView(curr, cell);
      }
      return curr;
    }
  }

  /**
   * Eagerly positions a newly created view based on current alignment offsets.
   * This helps with debugging by showing intermediate positions during BFS layout.
   */
  protected eagerlyPositionView(view: GridCellView, cell: GridCell): void {
    const x = cell.colAlign?.coordOffset ?? 0;
    const y = cell.rowAlign?.coordOffset ?? 0;
    const w = cell.colAlign?.maxLength ?? null;
    const h = cell.rowAlign?.maxLength ?? null;
    view.setBounds(x, y, w, h, true);
  }
}
