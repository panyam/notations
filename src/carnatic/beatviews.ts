import * as TSU from "@panyam/tsutils";
import { AtomType } from "../core";
import { Cycle } from "../cycle";
import { BeatView as BeatViewBase, Beat } from "../beats";
import { AtomView, GroupView, Embelishment, ElementShape } from "../shapes";
import { createAtomView } from "./atomviews";
import { BeatStartLines, BeatEndLines } from "./embelishments";

export class BeatView extends ElementShape<SVGGElement> implements BeatViewBase {
  atomView: AtomView;
  needsLayout = true;
  constructor(
    public readonly beat: Beat,
    public readonly rootElement: SVGGraphicsElement,
    public readonly cycle: Cycle,
    config?: any,
  ) {
    super(
      TSU.DOM.createSVGNode("g", {
        parent: rootElement,
        attrs: {
          class: "beatView",
          beatId: "" + beat.uuid,
          id: "" + beat.uuid,
          roleName: beat.role.name,
          layoutLine: "" + beat.layoutLine,
          layoutColumn: "" + beat.layoutColumn,
          beatIndex: "" + beat.index,
        },
      }),
    );
    this.atomView = createAtomView(this.element, beat.atom, beat.role.defaultToNotes);
    this.atomView.refreshLayout();
  }

  refreshLayout(): void {
    const newX = this.hasX ? this._x : 0;
    const newY = this.hasY ? this._y : 0;
    this.element.setAttribute("transform", "translate(" + newX + "," + newY + ")");
  }

  protected createEmbelishments(): Embelishment[] {
    let embelishments: Embelishment[] = [];
    const beat = this.beat;
    // TODO - Should this be the group's parent element?
    const rootElement = this.element;
    if (beat.beatIndex == 0 && beat.barIndex == 0 && beat.instance == 0) {
      // first beat in bar - Do a BarStart
      const emb = new BeatStartLines(this, rootElement);
      embelishments = [emb];
    } else {
      const cycle = this.cycle;
      const bar = cycle.bars[beat.barIndex];
      if (beat.beatIndex == bar.beatCount - 1) {
        // It is important that we are not just looking at the last beat of the bar
        // but also in the last "instance" of the beat in this bar to account for
        // kalais
        if (beat.instance == bar.beatCounts[beat.beatIndex] - 1) {
          if (beat.barIndex == cycle.bars.length - 1) {
            // last beat in last bar so - do a thalam end (2 lines)
            const emb = new BeatEndLines(this, rootElement, 2);
            embelishments = [emb];
          } else {
            // end of a bar so single line end
            const emb = new BeatEndLines(this, rootElement);
            embelishments = [emb];
          }
        }
      }
    }
    return embelishments;
  }

  setStyles(config: any): void {
    this.needsLayout = true;
  }
}
