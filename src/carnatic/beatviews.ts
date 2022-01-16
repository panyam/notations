import * as TSU from "@panyam/tsutils";
import { Cycle } from "../cycle";
import { AtomType, Syllable, Note, Literal } from "../core";
import { BeatView as BeatViewBase, Beat } from "../layouts";
import { Embelishment, AtomViewGroup } from "../shapes";
import { createAtomView } from "./atomviews";
import { BeatStartLines, BeatEndLines } from "./embelishments";

export class BeatView extends AtomViewGroup implements BeatViewBase {
  textElement: SVGTextElement;

  constructor(
    public readonly beat: Beat,
    public readonly rootElement: Element,
    public readonly cycle: Cycle,
    config?: any,
  ) {
    super(rootElement);
    this.groupElement.setAttribute("beatId", "" + beat.uuid);
    this.groupElement.setAttribute("id", "" + beat.uuid);
    this.groupElement.setAttribute("roleName", beat.role.name);
    this.groupElement.setAttribute("layoutLine", "" + beat.layoutLine);
    this.groupElement.setAttribute("layoutColumn", "" + beat.layoutColumn);
    this.groupElement.setAttribute("beatIndex", "" + beat.index);
    this.textElement = TSU.DOM.createSVGNode("text", {
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
      const atomView = createAtomView(this.textElement, flatAtom);
      atomView.depth = flatAtom.depth;
      this.addAtomViews(atomView);
    }
  }

  protected createEmbelishments(): Embelishment[] {
    let embelishments: Embelishment[] = [];
    const beat = this.beat;
    // TODO - Should this be the group's parent element?
    const rootElement = this.textElement.parentElement as any as SVGGraphicsElement;
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
}
