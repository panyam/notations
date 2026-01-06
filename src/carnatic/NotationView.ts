import * as TSU from "@panyam/tsutils";
import { LineView } from "./LineView";
import { Notation, RawBlock, Block, BlockItem, isLine, isBlock, isRawBlock } from "../notation";
import { Beat, GlobalBeatLayout } from "../beats";
import { GridCell, GridCellView, GridLayoutGroup, LayoutChangeEvent } from "../grids";
import { Line } from "../core";
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

  clear(): void {
    this.lineViews = [];
    // Mapping from line id -> list of beats in each of its roles
    this.currentSVGElement = null;
    this.tableElement.innerHTML = "";
    this.beatViews = new Map<number, BeatView>();
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
      }
      return curr;
    }
  }
}
