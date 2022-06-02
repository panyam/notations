import * as TSU from "@panyam/tsutils";
import { Embelishment } from "../shapes";
import { createAtomView } from "./atomviews";
import { BeatView as BeatViewBase } from "../beatview";
import { BeatStartLines, BeatEndLines } from "./embelishments";

export class BeatView extends BeatViewBase {
  createAtomView() {
    return createAtomView(this.element, this.beat.atom, this.beat.role.defaultToNotes);
  }

  refreshLayout(): void {
    const newX = this.hasX ? this._x : 0;
    const newY = this.hasY ? this._y : 0;
    this.element.setAttribute("transform", "translate(" + newX + "," + newY + ")");
    this.invalidateBounds();
    for (const e of this.embelishments) e.refreshLayout();
    this.invalidateBounds();
  }

  protected createEmbelishments(): Embelishment[] {
    let embelishments: Embelishment[] = [];
    const beat = this.beat;
    // TODO - Should this be the group's parent element?
    const rootElement = this.rootElement;
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
        if (beat.instance == bar.instanceCount(beat.beatIndex) - 1) {
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
}
