import * as TSU from "@panyam/tsutils";
import { Carnatic, Literal, AtomType, Note, Space, Syllable, FlatAtom } from "notations";
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

  // Spaces required before and after to accomodate for left and right slots
  protected preSpacingSpan: SVGTSpanElement;
  protected postSpacingSpan: SVGTSpanElement;
  // Sometimes this.element may not be the root element if we need spacings
  // the rootElement is the top of the chain
  protected rootElement: SVGGraphicsElement;

  abstract get glyphLabel(): string;

  get needsLeftSpacing(): boolean {
    return this.leftSlot.embelishments.length > 0;
  }

  get needsRightSpacing(): boolean {
    return this.rightSlot.embelishments.length > 0 || this.flatAtom.atom.beforeRest;
  }

  /**
   * Orders embelishments and creates their views.
   */
  orderEmbelishments(): void {
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
  }

  createElements(parent: SVGGraphicsElement): void {
    // Create the glyph element first before anything
    // this allows embelishments to get early access to this element
    this.createGlyphElement(parent);

    // Order embelishments (without creating any views)
    this.orderEmbelishments();
    const atom = this.flatAtom.atom;
    if (this.needsLeftSpacing || this.needsRightSpacing) {
      // create as 2 sub span elements
      this.rootElement = TSU.DOM.createSVGNode("tspan", {
        doc: document,
        parent: parent,
        attrs: {
          depth: this.flatAtom.depth || 0,
          atomid: atom.uuid,
          id: "atomViewRoot" + atom.uuid,
        },
      });
      if (this.needsLeftSpacing) {
        this.preSpacingSpan = TSU.DOM.createSVGNode("tspan", {
          doc: document,
          parent: this.rootElement,
          attrs: {
            depth: this.flatAtom.depth || 0,
            atomid: atom.uuid,
            id: "preSpacing" + atom.uuid,
          },
          text: "  ",
        });
      }

      // move the element into the parent
      this.moveGlyphToRoot();

      if (this.needsRightSpacing) {
        this.postSpacingSpan = TSU.DOM.createSVGNode("tspan", {
          doc: document,
          parent: this.rootElement,
          attrs: {
            depth: this.flatAtom.depth || 0,
            atomid: atom.uuid,
            id: "postSpacing" + atom.uuid,
          },
          text: atom.beforeRest ? " - " : "  ",
        });
      }
    }
  }

  protected moveGlyphToRoot(): void {
    this.rootElement.appendChild(this.element);
  }

  protected createGlyphElement(parent: SVGGraphicsElement): void {
    const atom = this.flatAtom.atom;
    this.element = TSU.DOM.createSVGNode("tspan", {
      doc: document,
      parent: parent,
      attrs: {
        depth: this.flatAtom.depth || 0,
        atomid: atom.uuid,
        id: "atom" + atom.uuid,
      },
      text: this.glyphLabel + " ", // + (note.beforeRest ? " - " : " "),
    });
  }

  refreshLayout(): void {
    // refresh layout of embelishments slots
    this.leftSlot.refreshLayout();
    this.topSlot.refreshLayout();
    this.rightSlot.refreshLayout();
    this.bottomSlot.refreshLayout();
  }
}

class SpaceView extends LeafAtomView {
  get glyphLabel(): string {
    return this.space.isSilent ? " " : ",";
  }

  get space(): Space {
    return this.flatAtom.atom as Space;
  }
}

class NoteView extends LeafAtomView {
  protected shiftElement: SVGTSpanElement;
  get glyphLabel(): string {
    return this.note.value;
  }

  protected createGlyphElement(parent: SVGGraphicsElement): void {
    super.createGlyphElement(parent);
    if (this.note.shift == true || this.note.shift != 0) {
      this.shiftElement = TSU.DOM.createSVGNode("tspan", {
        doc: document,
        parent: parent,
        attrs: {
          depth: this.flatAtom.depth || 0,
          atomid: this.note.uuid,
          id: "noteShift" + this.note.uuid,
          "baseline-shift": "sub",
        },
        text: (this.note.shift == true ? "*" : this.note.shift) + " ",
      });
    }
  }

  protected moveGlyphToRoot(): void {
    super.moveGlyphToRoot();
    if (this.shiftElement) {
      this.rootElement.appendChild(this.shiftElement);
    }
  }

  orderEmbelishments(): void {
    const note = this.note;
    // create the embelishments if needed
    if (note.octave > 0) {
      this.topSlot.push(new OctaveIndicator(this));
    } else if (this.note.octave < 0) {
      this.bottomSlot.push(new OctaveIndicator(this));
    }
    super.orderEmbelishments();
  }

  get note(): Note {
    return this.flatAtom.atom as Note;
  }
}

class SyllableView extends LeafAtomView {
  get glyphLabel(): string {
    return this.syllable.value;
  }

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

  refreshBBox(): TSU.Geom.Rect {
    return this.dotsElem.getBBox();
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
        "dominant-baseline": "hanging",
      },
    });
  }

  refreshBBox(): TSU.Geom.Rect {
    return this.labelElem.getBBox();
  }

  protected updatePosition(x: null | number, y: null | number): boolean {
    if (x != null) {
      this.labelElem.setAttribute("x", "" + x);
    }
    if (y != null) {
      this.labelElem.setAttribute("y", "" + y);
    }
    return true;
  }

  refreshLayout(): void {
    // const out = this.atomView.bbox;
    // const emb = this.bbox;
    // this.x = out.x + (out.width - emb.width) / 2;
  }
}

export class Kampitham extends LabelEmbelishment {
  constructor(public readonly atomView: AtomView) {
    super("~", atomView);
  }
}

export class Nokku extends LabelEmbelishment {
  constructor(public readonly atomView: AtomView) {
    super("w", atomView);
  }
}

export class Prathyagatham extends LabelEmbelishment {
  constructor(public readonly atomView: AtomView) {
    super("∵", atomView);
  }
}
export class Spuritham extends LabelEmbelishment {
  constructor(public readonly atomView: AtomView) {
    super("∴", atomView);
  }
}
export class Raavi extends LabelEmbelishment {
  constructor(public readonly atomView: AtomView) {
    super("^", atomView);
  }
}
export class Kandippu extends LabelEmbelishment {
  constructor(public readonly atomView: AtomView) {
    super("✓", atomView);
  }
}

export class Vaali extends LabelEmbelishment {
  constructor(public readonly atomView: AtomView) {
    super("⌒", atomView);
  }
}
export class Odukkal extends LabelEmbelishment {
  constructor(public readonly atomView: AtomView) {
    super("x", atomView);
  }
}
export class Orikkai extends LabelEmbelishment {
  constructor(public readonly atomView: AtomView) {
    super("γ", atomView);
  }
}

export class Jaaru extends AtomViewEmbelishment {
  constructor(public readonly jaaru: Carnatic.Jaaru, public readonly atomView: AtomView) {
    super(atomView);
    // TODO - Create the "fancier" view
  }
}
