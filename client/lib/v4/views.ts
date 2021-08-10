import * as TSU from "@panyam/tsutils";
import * as TSV from "@panyam/tsutils-ui";
import { AtomType, Line, Syllable, Note, Literal } from "../models";
import { Embelishment, BeatLayout, BeatView, LayoutParams, Beat } from "../models/layouts";
import { FlatAtom } from "../models/iterators";
import { Notation, RawBlock } from "../../lib/v4/models";
import { AtomView } from "../rendering/Core";
import { createAtomView } from "../rendering/AtomViews";
import { BarLayout } from "../rendering/Layouts";
const MarkdownIt = require("markdown-it");

type Fraction = TSU.Num.Fraction;
const ZERO = TSU.Num.Fraction.ZERO;

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

  // Returns the beat view for a given beat
  beatViews = new Map<number, BeatView>();

  get notation(): Notation {
    return this.entity!;
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

  ensureLineView(line: Line): LineView {
    const layoutParams: LayoutParams = this.notation.layoutParamsForLine(line)!;
    let lineView = this.getLineView(line);
    if (lineView == null) {
      if (this.lineViews.length > 0) {
        this.rootElement.appendChild(TSU.DOM.createNode("br"));
      }
      const beatLayout = this.beatLayouts.get(layoutParams.uuid)!;
      lineView = new LineView(LineView.newRoot(this.rootElement), line, {
        layoutParams: layoutParams,
      } as any);
      lineView.beatLayout = beatLayout;
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
      beatView.applyLayout();
    }

    // Set line view preferred sizes
    for (const lineView of lineViews) {
      const ps = lineView.prefSize;
      lineView.setSize(ps.width, ps.height);
    }
  }

  renderLine(line: Line): LineView {
    const lineView = this.ensureLineView(line);
    // Layout the "rows" for this line - x has already been set by the
    // previous column spacing step
    lineView.beatLayout.layoutBeatsForLine(line, lineView.beatsByLineRole, this);
    return lineView;
  }

  renderBlock(raw: RawBlock): void {
    const md = new MarkdownIt({
      html: true,
    });
    const tokens = md.parse(raw.content.trim(), {});
    const html = md.renderer.render(tokens, { langPrefix: "v4_" });
    const div = this.rootElement.appendChild(TSU.DOM.createNode("div"));
    div.innerHTML = html;
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

  public static newRoot(parent: Element): SVGSVGElement {
    return TSU.DOM.createSVGNode("svg", {
      parent: parent,
      attrs: {
        width: "100%",
        style: "margin-bottom: 20px",
      },
    }) as SVGSVGElement;
  }

  protected processConfigs(config: any): any {
    if (this.rootElement.tagName != "svg") {
      throw new Error("LineView root MUST be a svg node");
    }
    return config;
  }

  get prefSize(): TSV.Size {
    const bbox = (this.rootElement as SVGSVGElement).getBBox();
    return new TSV.Size(4 + bbox.width + bbox.x, 4 + bbox.y + bbox.height);
  }

  /**
   * Ensures that all atom views are created and laid in respective
   * line and role views.
   *
   * This LineView only creates child views necessary in the most base
   * form and ensures that atoms are added to these child views.  The
   * positioning of the atom views is performed by AtomLayout delegate.
   */
  layoutChildViews(): void {
    // Now layout all the AtomRows
    // this.layoutRows();

    // Update all embelishments here before calculating preferred size
    // this.atomLayout.refreshEmbelishments();
    const ps = this.prefSize;
    this.setSize(ps.width, ps.height);
  }

  beatViews = new Map<number, BeatView>();
  viewForBeat(beat: Beat): BeatView {
    if (!this.beatViews.has(beat.uuid)) {
      // how to get the bar and beat index for a given beat in a given row?
      const b = new TextBeatView(beat, this.rootElement);
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

class TextBeatView implements BeatView {
  protected atomSpacing: number;
  needsLayout = true;
  private _embelishments: Embelishment[];
  private atomViews: AtomView[] = [];
  rootElement: SVGTextElement;
  constructor(public readonly beat: Beat, rootElement: Element, config?: any) {
    this.atomSpacing = 2;
    this.rootElement = TSU.DOM.createSVGNode("text", {
      parent: rootElement,
      attrs: {
        class: "roleAtomsText",
        // y: "0%",
        style: "dominant-baseline: hanging",
        beatId: beat.uuid,
        id: "beat" + beat.uuid,
        roleName: beat.role.name,
        layoutLine: beat.layoutLine,
        layoutColumn: beat.layoutColumn,
        beatIndex: beat.index,
      },
    }) as SVGTextElement;

    // create the children
    this._embelishments = [];
    for (const flatAtom of beat.atoms) {
      if (flatAtom.atom.type == AtomType.LITERAL) {
        const lit = flatAtom.atom as Literal;
        // convert to note or syllable here
        if (beat.role.defaultToNotes) {
          flatAtom.atom = new Note(lit.value, lit.duration);
        } else {
          flatAtom.atom = new Syllable(lit.value, lit.duration);
        }
      }
      const atomView = createAtomView(this.rootElement, flatAtom);
      atomView.depth = flatAtom.depth;
      this.atomViews.push(atomView);
      this._embelishments.push(...atomView.embelishments);
    }

    this.setStyles(config || {});
    this._bbox = this.rootElement.getBBox();
    this._width = -1;
  }

  protected _bbox: SVGRect;

  // Custom settable width different bbox.width
  // <ve implies using evaled width
  protected _width: number;
  xChanged = true;
  yChanged = true;
  widthChanged = true;
  heightChanged = true;

  get bbox(): SVGRect {
    if (!this._bbox) {
      this._bbox = this.rootElement.getBBox();
    }
    return this._bbox;
  }

  get x(): number {
    return this.bbox.x;
  }

  set x(x: number) {
    // remove the dx attribute
    if (x != this.bbox.x) {
      this.bbox.x = x;
      this.xChanged = true;
    }
  }

  get y(): number {
    return this.bbox.y;
  }

  set y(y: number) {
    // remove the dx attribute
    if (y != this.bbox.y) {
      this.bbox.y = y;
      this.yChanged = true;
    }
  }

  get width(): number {
    return this._width < 0 ? this.bbox.width : this._width;
  }

  set width(value: number) {
    if (this._width != value) {
      this._width = value;
      this.widthChanged = true;
    }
  }

  get height(): number {
    return this.bbox.height;
  }

  setStyles(config: any): void {
    if ("atomSpacing" in config) this.atomSpacing = config.atomSpacing;
    this.needsLayout = true;
  }

  applyLayout(): void {
    if (this.xChanged) {
      this.rootElement.setAttribute("x", this.x + "");
    }
    if (this.yChanged) {
      this.rootElement.setAttribute("y", this.y + "");
    }
    if (this.widthChanged) {
      // All our atoms have to be laid out between startX and endX
      this.atomViews.forEach((av, index) => {
        if (index > 0) av.dx = this.atomSpacing;
      });

      for (const e of this._embelishments) e.refreshLayout();
      this._bbox = null as unknown as SVGRect;
    }
    this.xChanged = this.yChanged = false;
    this.widthChanged = this.heightChanged = false;
    this.needsLayout = false;
  }

  get minWidth(): number {
    return (
      this.atomViews.reduce((total, view) => total + view.width, 0) + this.atomSpacing * (this.atomViews.length - 1)
    );
  }

  get minHeight(): number {
    return this.atomViews.reduce((total, view) => Math.max(total, view.height), 0);
  }

  get embelishments(): Embelishment[] {
    return this._embelishments;
  }
}
