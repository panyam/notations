import * as TSU from "@panyam/tsutils";
import * as TSV from "@panyam/tsutils-ui";
import {
  RawBlock,
  Notation,
  BeatLayout,
  BeatView,
  Beat,
  Cycle,
  AtomType,
  Line,
  Syllable,
  Note,
  Literal,
} from "notations";
import { Embelishment, AtomView, Shape } from "./Core";
import { createAtomView } from "./AtomViews";
import { BeatStartLines, BeatEndLines } from "./Embelishments";
const MarkdownIt = require("markdown-it");

interface BeatViewDelegate {
  // A way to create all beats for an entire Line in one go (instead of one by one)
  viewForBeat(beat: Beat): BeatView;
}

export class NotationView extends TSV.EntityView<Notation> implements BeatViewDelegate {
  lineViews: LineView[] = [];
  // Mapping from line id -> list of beats in each of its roles
  beatsByLineRole = new Map<number, Beat[][]>();
  beatLayouts = new Map<number, BeatLayout>();
  currentSVGElement: SVGSVGElement | null = null;
  tableElement: HTMLTableElement;

  // Returns the beat view for a given beat
  beatViews = new Map<number, BeatView>();

  get notation(): Notation {
    return this.entity!;
  }

  protected updateViewsFromEntity(_previous: TSU.Nullable<Notation> = null): void {
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

  addElement(elem: Element): void {
    this.rootElement.appendChild(elem);
  }

  loadChildViews(): void {
    super.loadChildViews();
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
    return this.lineViews.find((l) => l.entity == line) || null;
  }

  get currentLineView(): LineView {
    return this.lineViews[this.lineViews.length - 1];
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

export class LineView extends TSV.EntityView<Line> {
  // roleStates: RoleState[];
  // For each line a mapping of its Atoms in each role grouped by Beat for layout
  beatsByLineRole: Beat[][];
  // The beat layout associated with the layout params of this Line
  // at this point beats have already been added to the right columns
  beatLayout: BeatLayout;
  gElem: SVGGElement;

  protected processConfigs(config: any): any {
    if (this.rootElement.tagName != "svg" && this.rootElement.tagName != "g") {
      throw new Error("LineView root MUST be a svg or g node");
    }
    // create the gElem for wrapping and adjusting to size
    this.gElem = TSU.DOM.createSVGNode("g", {
      parent: this.rootElement,
      attrs: {
        id: "gElem" + this.viewId,
      },
    }) as SVGGElement;
    return config;
  }

  wrapToSize(): void {
    const bbox = (this.gElem as SVGSVGElement).getBBox();
    // set the size of the svg
    this.setSize(4 + bbox.width, 15 + bbox.height);
    this.gElem.setAttribute("transform", `translate(${4 - bbox.x}, ${4 - bbox.y})`);
  }

  get prefSize(): TSU.Geom.Size {
    const bbox = (this.rootElement as SVGSVGElement).getBBox();
    // return new TSU.Geom.Size(4 + bbox.width + bbox.x, 4 + bbox.y + bbox.height);
    return new TSU.Geom.Size(4 + bbox.width, 4 + bbox.height);
  }

  beatViews = new Map<number, BeatView>();
  viewForBeat(beat: Beat): BeatView {
    if (!this.beatViews.has(beat.uuid)) {
      // how to get the bar and beat index for a given beat in a given row?
      const b = new TextBeatView(beat, this.gElem, this.beatLayout.layoutParams.cycle);
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

class TextBeatView extends Shape implements BeatView {
  protected atomSpacing: number;
  needsLayout = true;
  private _embelishments: Embelishment[];
  private atomViews: AtomView[] = [];
  groupElement: SVGGElement;
  rootElement: SVGTextElement;
  constructor(public readonly beat: Beat, rootElement: Element, public readonly cycle: Cycle, config?: any) {
    super();
    this.atomSpacing = 5;
    this.groupElement = TSU.DOM.createSVGNode("g", {
      parent: rootElement,
      attrs: {
        beatId: beat.uuid,
        id: "beatGroup" + beat.uuid,
        roleName: beat.role.name,
        layoutLine: beat.layoutLine,
        layoutColumn: beat.layoutColumn,
        beatIndex: beat.index,
      },
    });
    this.rootElement = TSU.DOM.createSVGNode("text", {
      parent: this.groupElement,
      attrs: {
        class: "roleAtomsText",
        // y: "0%",
        style: "dominant-baseline: hanging",
        beatId: beat.uuid,
        id: "beatText" + beat.uuid,
        roleName: beat.role.name,
        layoutLine: beat.layoutLine,
        layoutColumn: beat.layoutColumn,
        beatIndex: beat.index,
      },
    }) as SVGTextElement;

    // create the children
    for (const flatAtom of beat.atoms) {
      if (flatAtom.atom.type == AtomType.LITERAL) {
        const lit = flatAtom.atom as Literal;
        // convert to note or syllable here
        if (beat.role.defaultToNotes) {
          flatAtom.atom = Note.fromLit(lit);
        } else {
          flatAtom.atom = Syllable.fromLit(lit);
        }
        // carry over rest info
        flatAtom.atom.beforeRest = lit.beforeRest;
      }
      const atomView = createAtomView(this.rootElement, flatAtom);
      atomView.depth = flatAtom.depth;
      this.atomViews.push(atomView);
    }

    this.setStyles(config || {});

    this._bbox = this.refreshBBox();
    this._width = -1;
  }

  // Custom settable width different bbox.width
  // <ve implies using evaled width
  protected _width: number;
  get width(): number {
    return this._width < 0 ? this.bbox.width : this._width;
  }

  set width(value: number) {
    if (this._width != value) {
      this._width = value;
      this.widthChanged = true;
    }
  }

  refreshBBox(): TSU.Geom.Rect {
    return TSU.Geom.Rect.from(this.rootElement.getBBox());
  }

  protected updatePosition(x: null | number, y: null | number): [number | null, number | null] {
    return [x, y];
  }

  setStyles(config: any): void {
    if ("atomSpacing" in config) this.atomSpacing = config.atomSpacing;
    this.needsLayout = true;
  }

  refreshLayout(): void {
    if (this.xChanged) {
      this.rootElement.setAttribute("x", this.x + "");
    }
    if (this.yChanged) {
      this.rootElement.setAttribute("y", this.y + "");
    }
    if (this.widthChanged) {
      // All our atoms have to be laid out between startX and endX
      // old way of doing where we just set dx between atom views
      // this worked when atomviews were single glyphs. But
      // as atomViews can be complex (eg with accents and pre/post
      // spaces etc) explicitly setting x/y may be important
      let currX = this.x;
      this.atomViews.forEach((av, index) => {
        av.moveTo(currX, this.y);
        currX += this.atomSpacing + av.minSize.width;
      });
      this.reset();
    }
    // Since atom views would havechagned position need to reposition embelishments
    // this.atomViews.forEach((av, index) => { av.refreshLayout(); });
    for (const e of this.embelishments) e.refreshLayout();
    this.xChanged = this.yChanged = false;
    this.widthChanged = this.heightChanged = false;
    this.needsLayout = false;
  }

  get minSize(): TSU.Geom.Size {
    let totalWidth = 0;
    let maxHeight = 0;
    this.atomViews.forEach((av, index) => {
      const ms = av.minSize;
      totalWidth += ms.width + this.atomSpacing;
      maxHeight = Math.max(maxHeight, ms.height);
    });
    return new TSU.Geom.Size(totalWidth, maxHeight);
  }

  get embelishments(): Embelishment[] {
    if (!this._embelishments) {
      this._embelishments = [];
      const beat = this.beat;
      const rootElement = this.rootElement.parentElement as any as SVGGraphicsElement;
      if (beat.beatIndex == 0 && beat.barIndex == 0 && beat.instance == 0) {
        // first beat in bar - Do a BarStart
        const emb = new BeatStartLines(this, rootElement);
        this._embelishments = [emb];
      } else {
        const cycle = this.cycle;
        const bar = cycle.bars[beat.barIndex];
        // TODO - ensure that we are in the last instance of this beat
        // since for now we dont have a way of specifying kalai this wont fail
        if (beat.beatIndex == bar.beatCount - 1) {
          if (beat.barIndex == cycle.bars.length - 1) {
            // last beat in last bar so - do a thalam end (2 lines)
            const emb = new BeatEndLines(this, rootElement, 2);
            this._embelishments = [emb];
          } else {
            // end of a bar so single line end
            const emb = new BeatEndLines(this, rootElement);
            this._embelishments = [emb];
          }
        }
      }
    }
    return this._embelishments;
  }
}
