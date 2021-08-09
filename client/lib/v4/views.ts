import * as TSU from "@panyam/tsutils";
import * as TSV from "@panyam/tsutils-ui";
import { Line, Role, Atom } from "../models";
import { Embelishment, BeatLayout, BeatView, LayoutParams, Beat } from "../models/layouts";
import { FlatAtom } from "../models/iterators";
import { Notation, RawBlock } from "../../lib/v4/models";
import { AtomView } from "../rendering/Core";
import { BarLayout } from "../rendering/Layouts";
const MarkdownIt = require("markdown-it");

type Fraction = TSU.Num.Fraction;
const ZERO = TSU.Num.Fraction.ZERO;

interface BeatViewDelegate {
  // A way to create all beats for an entire Line in one go (instead of one by one)
  viewForBeat(beat: Beat): BeatView;
}

export interface AtomViewProvider {
  createAtomView(beat: Beat, flatAtom: FlatAtom, beforeAtom: null | FlatAtom): AtomView;
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
    for (const block of this.notation.blocks) {
      if (block.type == "RawBlock") {
        // Add the markdown here
        this.renderBlock(block as RawBlock);
      } else {
        this.renderLine(block as Line);
      }
    }
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

  renderLine(line: Line): void {
    const lineView = this.ensureLineView(line);
    const beatsByLineRole = lineView.beatsByLineRole;
    const beatLayout = lineView.beatLayout;

    // For beats in this line - ensure beatViews exists
    for (const role of beatsByLineRole) {
      for (const beat of role) {
        this.viewForBeat(beat);
      }
    }

    // The confusion is we have beats broken up and saved in columns
    // but we are loosing how a line is supposed to access it in its own way
    // we have beatsByRole for getting all beats for a role (in a line) sequentially
    // we have beatColumns for getting all beats in a particular column across all lines
    // and roles globally.
    //
    // What we want here is for a given line get all roles, their beats in zipped way:
    //
    // eg for a Line with 3 roles and say 10 beats each (with the breaks of 4, 1)
    // we need:
    //
    // R1 B1 R1 B2 R1 B3 R1 B4
    // R2 B1 R2 B2 R2 B3 R2 B4
    // R3 B1 R3 B2 R3 B3 R3 B4
    //
    // R1 B5
    // R2 B5
    // R3 B5
    //
    // R1 B6 R1 B7 R1 B8 R1 B9
    // R2 B6 R2 B7 R2 B8 R2 B9
    // R3 B6 R3 B7 R3 B8 R3 B9
    //
    // R1 B10
    // R2 B10
    // R3 B10
    //
    //
    // Here we have 5 distinct beat columns:
    //
    // 1: R1B1, R2B1, R3B1, R1B6, R2B6, R3B6,
    // 2: R1B2, R2B2, R3B2, R1B7, R2B7, R3B7,
    // 3: R1B3, R2B3, R3B3, R1B8, R2B8, R3B8,
    // 4: R1B4, R2B4, R3B4, R1B9, R2B9, R3B9,
    // 5: R1B5, R2B5, R3B5, R1B10, R2B10, R3B10,
    //
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
    // TODO - we need a way to differentiate this as when
    // called *before* and *after* a layout.
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
      const b = new TextBeatView(beat);
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
  private views: AtomView[] = [];
  constructor(public readonly beat: Beat) {}

  private _x: number;
  private _y: number;
  private _width: number;
  private _height: number;

  get x(): number {
    return this._x;
  }

  get y(): number {
    return this._y;
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  /*
  add(atomView: AtomView): void {
    const bb = atomView.bbox;
    this.views.push(atomView);
  }
 */

  layout(): void {
    /*
    const startX = this.beatCol.x + this.beatCol.paddingLeft;

    // All our atoms have to be laid out between startX and endX
    let currX = startX;
    this.views.forEach((av) => {
      av.x = currX;
      currX += av.bbox.width + this.beatCol.atomSpacing;
    });
    */
  }

  get minWidth(): number {
    return this.views.reduce((total, view) => total + view.bbox.width, 0);
  }

  get minHeight(): number {
    return this.views.reduce((total, view) => total + view.bbox.width, 0);
  }

  get embelishments(): Embelishment[] {
    return [];
  }
}
