import "./styles/NotationView.scss";

const MarkdownIt = require("markdown-it");
import * as TSU from "@panyam/tsutils";
import * as events from "./events";
import * as N from "notations";

export class LineView {
  // roleStates: RoleState[];
  // For each line a mapping of its Atoms in each role grouped by Beat for layout
  beatsByLineRole: N.Beat[][];
  // The beat layout associated with the layout params of this Line
  // at this point beats have already been added to the right columns
  beatLayout: N.BeatLayout;
  gElem: SVGGElement;

  constructor(public readonly rootElement: SVGSVGElement, public line: N.Line, public readonly config?: any) {
    this.loadChildViews();
  }

  protected loadChildViews(): void {
    // create the gElem for wrapping and adjusting to size
    this.gElem = TSU.DOM.createSVGNode("g", {
      parent: this.rootElement,
      attrs: {
        id: "gElem" + this.line.uuid,
      },
    }) as SVGGElement;
  }

  wrapToSize(): void {
    const bbox = (this.gElem as SVGSVGElement).getBBox();
    // set the size of the svg
    this.rootElement.setAttribute("width", "" + (4 + bbox.width));
    this.rootElement.setAttribute("height", "" + (15 + bbox.height));
    this.gElem.setAttribute("transform", `translate(${4 - bbox.x}, ${4 - bbox.y})`);
  }

  get prefSize(): TSU.Geom.Size {
    const bbox = this.rootElement.getBBox();
    // return new TSU.Geom.Size(4 + bbox.width + bbox.x, 4 + bbox.y + bbox.height);
    return new TSU.Geom.Size(4 + bbox.width, 4 + bbox.height);
  }

  beatViews = new Map<number, N.BeatView>();
  viewForBeat(beat: N.Beat): N.BeatView {
    if (!this.beatViews.has(beat.uuid)) {
      // how to get the bar and beat index for a given beat in a given row?
      const b = new N.Carnatic.BeatView(beat, this.gElem, this.beatLayout.layoutParams.cycle);
      // Check if this needs bar start/end lines?
      this.beatViews.set(beat.uuid, b);
      return b;
    }
    return this.beatViews.get(beat.uuid)!;
  }

  // Space between two roles (within the same row)
  roleSpacing = 20;

  // Vertical space between two rows (of multiple roles)
  rowSpacing = 10;
}

export class NotationView {
  headerElement: HTMLDivElement;
  notation: N.Notation;
  lineViews: LineView[] = [];
  // Mapping from line id -> list of beats in each of its roles
  beatsByLineRole = new Map<number, N.Beat[][]>();
  beatLayouts = new Map<number, N.BeatLayout>();
  currentSVGElement: SVGSVGElement | null = null;
  tableElement: HTMLTableElement;
  beatViews = new Map<number, N.BeatView>();

  constructor(public readonly rootElement: HTMLElement, public readonly config?: any) {
    this.loadChildViews();
  }

  refresh(): void {
    this.beatViews = new Map<number, N.BeatView>();
  }

  viewForBeat(beat: N.Beat): N.BeatView {
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

  public newLineRoot(parent: Element, line: N.Line): SVGSVGElement {
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

  ensureLineView(line: N.Line): LineView {
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

  getLineView(line: N.Line): TSU.Nullable<LineView> {
    return this.lineViews.find((l) => l.line == line) || null;
  }

  get currentLineView(): LineView {
    return this.lineViews[this.lineViews.length - 1];
  }

  clear(): void {
    this.lineViews = [];
    // Mapping from line id -> list of beats in each of its roles
    this.beatsByLineRole = new Map<number, N.Beat[][]>();
    this.beatLayouts = new Map<number, N.BeatLayout>();
    this.currentSVGElement = null;
    this.tableElement.innerHTML = "";
    this.beatViews = new Map<number, N.BeatView>();
  }

  /**
   * Layout all the blocks in the Notation along with their corresponding blocks.
   * Key thing is here is an opportunity to perform any batch rendering as needed.
   */
  refreshLayout(): void {
    const lines = [] as N.Line[];
    const lineViews = [] as LineView[];
    for (const block of this.notation.blocks) {
      if (block.type == "RawBlock") {
        // Add the markdown here
        this.renderBlock(block as N.RawBlock);
      } else {
        lines.push(block as N.Line);
        const lineView = this.renderLine(block as N.Line);
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

  renderLine(line: N.Line): LineView {
    const lineView = this.ensureLineView(line);
    // Layout the "rows" for this line - x has already been set by the
    // previous column spacing step
    if (!line.isEmpty) {
      lineView.beatLayout.layoutBeatsForLine(line, lineView.beatsByLineRole, this);
    }
    return lineView;
  }

  renderBlock(raw: N.RawBlock): void {
    const [, td2] = this.addNewRow(raw.uuid + "", "rawBlock", false);
    const div = td2.appendChild(TSU.DOM.createNode("div"));
    if (raw.contentType == "metadata") {
      // we have a metadata block
      const meta = this.notation.metadata.get(raw.content);
      if (meta) {
        const html = `<span class = "${meta.key.toLowerCase()}"><strong>${meta.key}</strong>: ${meta.value}</span>`;
        div.innerHTML = html;
      }
    } else {
      const md = new MarkdownIt({
        html: true,
      });
      const tokens = md.parse(raw.content.trim(), {});
      const html = md.renderer.render(tokens, { langPrefix: "v4_" });
      div.innerHTML = html;
    }
    this.currentSVGElement = null;
  }
}
