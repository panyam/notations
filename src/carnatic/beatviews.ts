import * as TSU from "@panyam/tsutils";
import { Cycle, AtomType, Syllable, Note, Literal } from "../core";
import { BeatView as BeatViewBase, Beat } from "../layouts";
import { AtomView, Embelishment, Shape } from "../shapes";
import { createAtomView } from "./AtomViews";
import { BeatStartLines, BeatEndLines } from "./Embelishments";

export class BeatView extends Shape implements BeatViewBase {
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
