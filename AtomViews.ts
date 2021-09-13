import * as TSU from "@panyam/tsutils";
import { Carnatic, Literal, AtomType, Note, Space, Syllable, FlatAtom } from "notations";
import { GlyphShape, AtomView, Embelishment, EmbelishmentDir } from "./Core";

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

abstract class LeafAtomView extends AtomView {
  leftSlot: Embelishment[] = [];
  topSlot: Embelishment[] = [];
  rightSlot: Embelishment[] = [];
  bottomSlot: Embelishment[] = [];

  // Spaces required before and after to accomodate for left and right slots
  protected postSpacingSpan: SVGTSpanElement;
  // Sometimes this.element may not be the root element if we need spacings
  // the rootElement is the top of the chain
  protected rootElement: SVGGraphicsElement;

  abstract get glyphLabel(): string;

  // With LeafAtomViews unlike AtomViews, our bbox is the union of all views we manage
  protected refreshBBox(): TSU.Geom.Rect {
    return this.glyph.bbox;
  }

  get minSize(): TSU.Geom.Size {
    const out = TSU.Geom.Rect.from(this.glyph.bbox);
    const totalWidth =
      this.leftSlot.reduce((a, b) => a + b.bbox.width, 0) +
      this.rightSlot.reduce((a, b) => a + b.bbox.width, 0) +
      this.leftSlot.length + // Padding of 1
      this.rightSlot.length; // Padding of 1
    const totalHeight =
      this.topSlot.reduce((a, b) => a + b.bbox.height, 0) + this.bottomSlot.reduce((a, b) => a + b.bbox.height, 0);
    out.width += totalWidth;
    out.height += totalHeight;
    if (this.postSpacingSpan) out.width += this.postSpacingSpan.getBBox().width;
    return out; // this.glyph.bbox;
  }

  currX = 0;
  currY = 0;
  protected updatePosition(x: null | number, y: null | number): [number | null, number | null] {
    // set the glyphs Y first so we can layout others
    if (y != null) {
      this.glyph.moveTo(null, y);
      this.currY = y;
    }

    // now layout leftSlots
    if (x != null) {
      this.currX = x;
      // place left embelishments
      for (const emb of this.leftSlot) {
        emb.x = x;
        x += emb.bbox.width + 1;
      }

      // now place the glyph
      this.glyph.x = x;
      x += this.glyph.bbox.width;

      // And right embelishments
      for (const emb of this.rightSlot) {
        emb.x = x;
        x += emb.bbox.width + 1;
      }

      // now the spacing span
      if (this.postSpacingSpan) {
        this.postSpacingSpan.setAttribute("x", "" + x);
      }
    }

    // layout top and bottom if x or y has changed
    if (x != null || y != null) {
      const gbbox = this.glyph.bbox;

      // top embelishments
      let y = gbbox.y - 1;
      for (const emb of this.topSlot) {
        const bb = emb.bbox;
        emb.x = gbbox.x + (gbbox.width - bb.width) / 2;
        emb.y = y - bb.height;
        y = emb.y;
      }

      // bottom embelishments
      y = gbbox.y + gbbox.height + 2;
      for (const emb of this.bottomSlot) {
        const bb = emb.bbox;
        emb.x = gbbox.x + (gbbox.width - bb.width) / 2;
        emb.y = y;
        y = emb.y + bb.height;
      }
    }
    return [this.currX, this.currY];
  }

  get needsRightSpacing(): boolean {
    return this.rightSlot.length > 0 || this.flatAtom.atom.beforeRest;
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
    if (this.needsRightSpacing) {
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
    this.rootElement.appendChild(this.glyph.element);
  }

  protected createGlyphElement(parent: SVGGraphicsElement): void {
    const atom = this.flatAtom.atom;
    this.glyph = new GlyphShape(
      TSU.DOM.createSVGNode("tspan", {
        doc: document,
        parent: parent,
        attrs: {
          depth: this.flatAtom.depth || 0,
          atomid: atom.uuid,
          id: "atom" + atom.uuid,
        },
        text: this.glyphLabel + " ", // + (note.beforeRest ? " - " : " "),
      }),
    );
  }

  refreshLayout(): void {
    // refresh layout of embelishments slots
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
export abstract class AtomViewEmbelishment extends Embelishment {
  constructor(public readonly atomView: AtomView) {
    super();
  }
}

class OctaveIndicator extends AtomViewEmbelishment {
  dotRadius = 1;
  dotSpacing = 2.5;
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
    return TSU.Geom.Rect.from(this.dotsElem.getBBox());
  }

  protected updatePosition(x: null | number, y: null | number): [number | null, number | null] {
    if (x == null) x = this.bbox.x;
    if (y == null) y = this.bbox.y;
    this.dotsElem.setAttribute("transform", "translate(" + x + "," + y + ")");
    return [x, y];
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
    return TSU.Geom.Rect.from(this.labelElem.getBBox());
  }

  protected updatePosition(x: null | number, y: null | number): [number | null, number | null] {
    if (x != null) {
      this.labelElem.setAttribute("x", "" + x);
    }
    if (y != null) {
      this.labelElem.setAttribute("y", "" + y);
    }
    return [x, y];
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
  pathElem: SVGPathElement;
  constructor(public readonly jaaru: Carnatic.Jaaru, public readonly atomView: AtomView) {
    super(atomView);
    // TODO - Create the "fancier" view
    // for now represent this with just a slant line (like a slash)
    const rootElem = this.atomView.embRoot();
    this.pathElem = TSU.DOM.createSVGNode("path", {
      doc: document,
      parent: rootElem,
      attrs: {
        source: "atom" + this.atomView.flatAtom.atom.uuid,
        stroke: "black",
        fill: "transparent",
        d: this.pathAttribute(),
      },
    });
  }

  pathAttribute(x = 0): string {
    const avbbox = this.atomView.bbox;
    let y2 = 0;
    const h2 = avbbox.height / 2;
    const x2 = x + h2;
    let y = avbbox.y;
    if (this.jaaru.ascending) {
      y = avbbox.y + avbbox.height;
      y2 = y - h2;
    } else {
      y -= h2;
      y2 = y + h2;
    }
    return [`M ${x} ${y}`, `Q ${x2} ${y} ${x2} ${y2}`].join(" ");
  }

  protected refreshBBox(): TSU.Geom.Rect {
    return TSU.Geom.Rect.from(this.pathElem.getBBox());
  }

  protected updatePosition(x: null | number, y: null | number): [number | null, number | null] {
    const newX = x == null ? this.x : x;
    this.pathElem.setAttribute("d", this.pathAttribute(newX));
    this.reset();
    return [x, null];
  }
}
