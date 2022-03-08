import * as TSU from "@panyam/tsutils";
import { LineView } from "./LineView";
import { Notation, RawBlock } from "../notation";
import { Beat, BeatLayout, BeatView } from "../beats";
import { Line } from "../core";

export class NotationView {
  headerElement: HTMLDivElement;
  notation: Notation;
  lineViews: LineView[] = [];
  // Mapping from line id -> list of beats in each of its roles
  beatsByLineRole = new Map<number, Beat[][]>();
  beatLayouts = new Map<number, BeatLayout>();
  currentSVGElement: SVGSVGElement | null = null;
  tableElement: HTMLTableElement;
  beatViews = new Map<number, BeatView>();
  markdownParser: (contents: string) => string;

  constructor(public readonly rootElement: HTMLElement, public readonly config?: any) {
    this.loadChildViews();
  }

  refresh(): void {
    this.beatViews = new Map<number, BeatView>();
  }

  viewForBeat(beat: Beat): BeatView {
    let curr = this.beatViews.get(beat.uuid) || null;
    if (curr == null) {
      // how to get the bar and beat index for a given beat in a given row?
      const lineView = this.ensureLineView(beat.role.line);
      curr = lineView.viewForBeat(beat);
      this.beatViews.set(beat.uuid, curr);
    }
    return curr;
  }

  loadChildViews(): void {
    this.tableElement = TSU.DOM.createNode("table", {
      parent: this.rootElement,
      attrs: {
        class: "notationsContentRootTable",
      },
    }) as HTMLTableElement;
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
      const layoutParams = this.notation.layoutParamsForLine(line) || null;
      const svgElem = this.newLineRoot(this.tableElement, line);
      lineView = new LineView(svgElem, line, {
        layoutParams: layoutParams,
      } as any);
      if (!line.isEmpty) {
        // Probably because this is an empty line and AddAtoms was not called
        TSU.assert(layoutParams != null, "Layout params for a non empty line *should* exist");
        const beatLayout = this.beatLayouts.get(layoutParams.uuid)!;
        lineView.beatLayout = beatLayout;
      }
      lineView.beatsByLineRole = this.beatsByLineRole.get(line.uuid)!;
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
    this.beatsByLineRole = new Map<number, Beat[][]>();
    this.beatLayouts = new Map<number, BeatLayout>();
    this.currentSVGElement = null;
    this.tableElement.innerHTML = "";
    this.beatViews = new Map<number, BeatView>();
  }

  /**
   * Layout all the blocks in the Notation along with their corresponding blocks.
   * Key thing is here is an opportunity to perform any batch rendering as needed.
   */
  refreshLayout(): void {
    const lines = [] as Line[];
    const lineViews = [] as LineView[];
    for (const block of this.notation.blocks) {
      if (block.type == "RawBlock") {
        // Add the markdown here
        this.renderBlock(block as RawBlock);
      } else {
        lines.push(block as Line);
        const lineView = this.renderLine(block as Line);
        lineViews.push(lineView);
      }
    }

    // Eval column sizes all beat layouts
    for (const bl of this.beatLayouts.values()) {
      bl.evalColumnSizes(this);
    }

    // now that all spacing has been calculated
    // go through all
    for (const beatView of this.beatViews.values()) {
      beatView.refreshLayout();
    }

    // Set line view preferred sizes
    for (const lineView of lineViews) {
      lineView.wrapToSize();
    }
  }

  renderLine(line: Line): LineView {
    const lineView = this.ensureLineView(line);
    // Layout the "rows" for this line - x has already been set by the
    // previous column spacing step
    if (!line.isEmpty) {
      lineView.beatLayout.layoutBeatsForLine(line, lineView.beatsByLineRole, this);
    }
    return lineView;
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
}
