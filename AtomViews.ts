import * as TSU from "@panyam/tsutils";
import { Carnatic, Literal, AtomType, Label, Note, Space, Syllable, FlatAtom } from "notations";
import { AtomView, Embelishment, EmbelishmentDir } from "./Core";

export function createAtomView(parent: SVGGraphicsElement, atom: FlatAtom): AtomView {
  let out: AtomView;
  switch (atom.atom.type) {
    // Dealing with leaf atoms
    case AtomType.SPACE:
      out = new SpaceView(atom);
      break;
    case AtomType.SYLLABLE:
      out = new SyllableView(atom);
      break;
    case AtomType.NOTE:
      out = new NoteView(atom);
      break;
    default:
      // We should never get a group as we are iterating
      // at leaf atom levels
      throw new Error("Invalid atom type: " + atom.atom.type);
  }
  out.createElements(parent);
  out.createEmbelishments();
  return out;
}

class Slot {
  currentOffset = -2;
  embelishments: Embelishment[] = [];

  constructor(public readonly dir: EmbelishmentDir, public atomView: LeafAtomView) {
    //
  }

  clear(): void {
    this.currentOffset = -2;
    this.embelishments = [];
  }

  refreshLayout(): void {
    const bbox = this.atomView.element.getBBox();
    // Initialise current offset
    switch (this.dir) {
      case EmbelishmentDir.LEFT:
        this.currentOffset = bbox.x - 2;
        break;
      case EmbelishmentDir.TOP:
        this.currentOffset = bbox.y - 2;
        break;
      case EmbelishmentDir.RIGHT:
        this.currentOffset = bbox.x + bbox.width + 2;
        break;
      case EmbelishmentDir.BOTTOM:
        this.currentOffset = bbox.y + bbox.height + 4;
        break;
    }

    for (const emb of this.embelishments) {
      const bb = emb.bbox;
      switch (this.dir) {
        case EmbelishmentDir.LEFT:
          emb.x = this.currentOffset - bb.width;
          this.currentOffset = emb.x;
          break;
        case EmbelishmentDir.TOP:
          emb.x = bbox.x + (bbox.width - bb.width) / 2;
          emb.y = this.currentOffset - bb.height;
          this.currentOffset = emb.y;
          break;
        case EmbelishmentDir.RIGHT:
          emb.x = this.currentOffset;
          this.currentOffset = emb.x + bb.width;
          break;
        case EmbelishmentDir.BOTTOM:
          emb.x = bbox.x + (bbox.width - bb.width) / 2;
          emb.y = this.currentOffset;
          this.currentOffset = emb.y + bb.height;
          break;
      }
      emb.refreshLayout();
    }
  }

  push(embelishment: Embelishment): void {
    this.embelishments.push(embelishment);
  }
}

abstract class LeafAtomView extends AtomView {
  leftSlot = new Slot(EmbelishmentDir.LEFT, this);
  topSlot = new Slot(EmbelishmentDir.TOP, this);
  rightSlot = new Slot(EmbelishmentDir.RIGHT, this);
  bottomSlot = new Slot(EmbelishmentDir.BOTTOM, this);

  refreshLayout(): void {
    // refresh layout of embelishments slots
    this.leftSlot.refreshLayout();
    this.topSlot.refreshLayout();
    this.rightSlot.refreshLayout();
    this.bottomSlot.refreshLayout();
  }

  // Group and Order embelishments into left, top, right and bottom slots
  createEmbelishments(): void {
    const atom = this.flatAtom.atom;
    if (atom.type != AtomType.SYLLABLE && atom.type != AtomType.NOTE) {
      return;
    }
    const lit = atom as Literal;
    if (lit.embelishments.length == 0) return;
    for (const emb of lit.embelishments) {
      switch (emb.type) {
        case Carnatic.GamakaType.Kampitham:
          this.topSlot.push(new Kampitham(this));
          break;
        case Carnatic.GamakaType.Nokku:
          this.topSlot.push(new Nokku(this));
          break;
        case Carnatic.GamakaType.Spuritham:
          this.topSlot.push(new Spuritham(this));
          break;
        case Carnatic.GamakaType.Prathyagatham:
          this.topSlot.push(new Prathyagatham(this));
          break;
        case Carnatic.GamakaType.Orikkai:
          this.topSlot.push(new Orikkai(this));
          break;
        case Carnatic.GamakaType.Odukkal:
          this.topSlot.push(new Odukkal(this));
          break;
        case Carnatic.GamakaType.Aahaatam_Raavi:
          this.topSlot.push(new Raavi(this));
          break;
        case Carnatic.GamakaType.Aahaatam_Kandippu:
          this.topSlot.push(new Kandippu(this));
          break;
        case Carnatic.GamakaType.Vaali:
          this.topSlot.push(new Vaali(this));
          break;
        case Carnatic.GamakaType.Jaaru_Eetra:
        case Carnatic.GamakaType.Jaaru_Irakka:
          this.leftSlot.push(new Jaaru(emb, this));
          break;
      }
    }
    throw new Error("TBD");
  }
}

class SpaceView extends LeafAtomView {
  createElements(parent: SVGGraphicsElement): void {
    const space = this.space;
    this.element = TSU.DOM.createSVGNode("tspan", {
      doc: document,
      parent: parent,
      attrs: {
        depth: this.flatAtom.depth || 0,
        atomid: space.uuid,
        id: "atom" + space.uuid,
      },
      text: (space.isSilent ? " " : ",") + (space.beforeRest ? " - " : " "),
    });
  }

  get space(): Space {
    return this.flatAtom.atom as Space;
  }
}

class LiteralView extends LeafAtomView {
  preTSpans = [] as SVGTSpanElement[];
  postTSpans = [] as SVGTSpanElement[];

  get lit(): Literal {
    return this.flatAtom.atom as Literal;
  }

  createElements(parent: SVGGraphicsElement): void {
    const lit = this.lit;
    if (lit.beforeRest) {
      // create as 2 sub span elements
      const parentTSpan = TSU.DOM.createSVGNode("tspan", {
        doc: document,
        parent: parent,
        attrs: {
          depth: this.flatAtom.depth || 0,
          atomid: lit.uuid,
          id: "atom" + lit.uuid,
        },
      });
      this.element = TSU.DOM.createSVGNode("tspan", {
        doc: document,
        parent: parentTSpan,
        attrs: {
          depth: this.flatAtom.depth || 0,
          atomid: lit.uuid,
          id: "atom" + lit.uuid,
        },
        text: lit.value + " ", // + (note.beforeRest ? " - " : " "),
      });
      // Create the rest marker
      // TODO - add to list of "post elements"
      this.postTSpans.push(
        TSU.DOM.createSVGNode("tspan", {
          doc: document,
          parent: parentTSpan,
          attrs: {
            depth: this.flatAtom.depth || 0,
            atomid: lit.uuid,
            id: "atom" + lit.uuid,
          },
          text: "- ",
        }),
      );
    } else {
      this.element = TSU.DOM.createSVGNode("tspan", {
        doc: document,
        parent: parent,
        attrs: {
          depth: this.flatAtom.depth || 0,
          atomid: lit.uuid,
          id: "atom" + lit.uuid,
        },
        text: lit.value + " ",
      });
    }
  }
}

class NoteView extends LiteralView {
  get note(): Note {
    return this.flatAtom.atom as Note;
  }

  createElements(parent: SVGGraphicsElement): void {
    super.createElements(parent);
    const note = this.note;
    // create the embelishments if needed
    if (note.octave > 0) {
      this.topSlot.push(new OctaveIndicator(this));
    } else if (this.note.octave < 0) {
      this.bottomSlot.push(new OctaveIndicator(this));
    }
  }
}

class SyllableView extends LiteralView {
  get syllable(): Syllable {
    return this.flatAtom.atom as Syllable;
  }
}

/**
 * Embelishments specifically "around" a single atom view.
 */
export class AtomViewEmbelishment extends Embelishment {
  constructor(public readonly atomView: AtomView) {
    super();
  }
}

/**
 * Very simple embelishments where just a text is shown either left, top, right
 * or bottom.
 */
export class LabelEmbelishment extends AtomViewEmbelishment {
  labelElem: SVGTextElement;

  constructor(public readonly label: string, public readonly atomView: AtomView) {
    super(atomView);
    const rootElem = this.atomView.embRoot();
    this.labelElem = TSU.DOM.createSVGNode("text", {
      doc: document,
      parent: rootElem,
      text: label,
      attrs: {
        source: "atom" + this.atomView.flatAtom.atom.uuid,
      },
    });
  }

  refreshBBox(): SVGRect {
    this._bbox = this.labelElem.getBBox();
    return super.refreshBBox();
  }

  refreshLayout(): void {
    const out = this.atomView.bbox;
    const emb = this.labelElem;
    if (emb) {
      /*
      const bb2 = emb.getBBox();
      const gX = out.x + (out.width - bb2.width) / 2;
      const gY = this.noteView.note.octave > 0 ? out.y - bb2.height : out.y + out.height + this.dotRadius;
      emb.setAttribute("transform", "translate(" + gX + "," + gY + ")");
      */
    }
  }
}

class OctaveIndicator extends AtomViewEmbelishment {
  dotRadius = 1.5;
  dotSpacing = 3;
  dotsElem: SVGGElement;

  constructor(public readonly noteView: NoteView) {
    super(noteView);
    const rootElem = this.noteView.embRoot();
    const note = this.noteView.note;
    const numDots = Math.abs(note.octave);
    this.dotsElem = TSU.DOM.createSVGNode("g", {
      doc: document,
      parent: rootElem,
      attrs: {
        width: this.dotRadius * 2 * numDots + (numDots - 1) * this.dotSpacing,
        height: this.dotRadius * 2,
        source: "atom" + this.noteView.flatAtom.atom.uuid,
      },
    });
    let cx = 0;
    for (let i = 0; i < numDots; i++) {
      TSU.DOM.createSVGNode("circle", {
        doc: document,
        parent: this.dotsElem,
        attrs: {
          cx: cx,
          cy: 0,
          r: this.dotRadius,
          stroke: "black",
          "stroke-width": "1",
        },
      });
      cx += this.dotRadius + this.dotRadius + this.dotSpacing;
    }
  }

  refreshBBox(): SVGRect {
    this._bbox = this.dotsElem.getBBox();
    return super.refreshBBox();
  }

  refreshLayout(): void {
    // Cache this
    // const out = this.noteView.element.getBBox();
    const emb = this.dotsElem;
    if (emb) {
      const gX = this.bbox.x;
      const gY = this.bbox.y; // this.noteView.note.octave > 0 ? out.y - bb2.height : out.y + out.height + this.dotRadius;
      emb.setAttribute("transform", "translate(" + gX + "," + gY + ")");
    }
  }
}

////////// Carnatic embelishments

export class Kampitham extends AtomViewEmbelishment {}
export class Nokku extends AtomViewEmbelishment {}
export class Prathyagatham extends AtomViewEmbelishment {}
export class Spuritham extends AtomViewEmbelishment {}
export class Raavi extends AtomViewEmbelishment {}
export class Kandippu extends AtomViewEmbelishment {}
export class Vaali extends AtomViewEmbelishment {}
export class Odukkal extends AtomViewEmbelishment {}
export class Orikkai extends AtomViewEmbelishment {}
export class Jaaru extends AtomViewEmbelishment {
  constructor(public readonly jaaru: Carnatic.Jaaru, public readonly atomView: AtomView) {
    super(atomView);
  }
}
