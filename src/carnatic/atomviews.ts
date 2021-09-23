import * as TSU from "@panyam/tsutils";
import { Literal, AtomType, Note, Space, Syllable } from "../core";
import { AtomView, Embelishment, ElementShape } from "../shapes";
import { FlatAtom } from "../iterators";
import {
  OctaveIndicator,
  Kampitham,
  Nokku,
  Spuritham,
  Prathyagatham,
  Orikkai,
  Odukkal,
  Raavi,
  Kandippu,
  Vaali,
  Jaaru,
} from "./embelishments";
import { GamakaType } from "./gamakas";

export abstract class LeafAtomView extends AtomView {
  leftSlot: Embelishment[] = [];
  topSlot: Embelishment[] = [];
  rightSlot: Embelishment[] = [];
  bottomSlot: Embelishment[] = [];

  // Spaces required before and after to accomodate for left and right slots
  protected postSpacingSpan: SVGTSpanElement;
  // Sometimes this.element may not be the root element if we need spacings
  // the rootElement is the top of the chain
  protected rootShape: ElementShape;

  abstract get glyphLabel(): string;

  // With LeafAtomViews unlike AtomViews, our bbox is the union of all views we manage
  protected refreshBBox(): TSU.Geom.Rect {
    return this.glyph.bbox;
  }

  get minSize(): TSU.Geom.Size {
    const out = TSU.Geom.Rect.from((this.rootShape || this.glyph).bbox);
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
    // TODO - move this code out to refreshLayout?

    // set the glyphs Y first so we can layout others
    if (y != null) {
      this.glyph.setPosition(null, y);
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
      const glyphRoot = this.rootShape || this.glyph;
      glyphRoot.x = x;
      x += glyphRoot.bbox.width;
      if (this.rootShape) this.glyph.resetBBox();

      // And right embelishments
      for (const emb of this.rightSlot) {
        emb.x = x;
        x += emb.bbox.width + 1;
      }

      // now the spacing span
      // if (this.postSpacingSpan) { this.postSpacingSpan.setAttribute("x", "" + x); }
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
    // reset our BBox since we forced a layout
    // this.resetBBox();
    return [this.currX, this.currY];
  }

  protected addEmbelishment(slot: Embelishment[], emb: Embelishment): void {
    slot.push(emb);
    this.addShape(emb);
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
        case GamakaType.Kampitham:
          this.addEmbelishment(this.topSlot, new Kampitham(this));
          break;
        case GamakaType.Nokku:
          this.addEmbelishment(this.topSlot, new Nokku(this));
          break;
        case GamakaType.Spuritham:
          this.addEmbelishment(this.topSlot, new Spuritham(this));
          break;
        case GamakaType.Prathyagatham:
          this.addEmbelishment(this.topSlot, new Prathyagatham(this));
          break;
        case GamakaType.Orikkai:
          this.addEmbelishment(this.topSlot, new Orikkai(this));
          break;
        case GamakaType.Odukkal:
          this.addEmbelishment(this.topSlot, new Odukkal(this));
          break;
        case GamakaType.Aahaatam_Raavi:
          this.addEmbelishment(this.topSlot, new Raavi(this));
          break;
        case GamakaType.Aahaatam_Kandippu:
          this.addEmbelishment(this.topSlot, new Kandippu(this));
          break;
        case GamakaType.Vaali:
          this.addEmbelishment(this.topSlot, new Vaali(this));
          break;
        case GamakaType.Jaaru_Eetra:
        case GamakaType.Jaaru_Irakka:
          this.addEmbelishment(this.leftSlot, new Jaaru(emb, this));
          break;
      }
    }
  }

  needsRootElement(): boolean {
    return this.rightSlot.length > 0 || this.flatAtom.atom.beforeRest;
  }

  createElements(parent: SVGGraphicsElement): void {
    // Create the glyph element first before anything
    // this allows embelishments to get early access to this element
    if (this.needsRootElement()) {
      this.createGlyphRoot(parent);
    }
    this.createGlyphElement(this.rootShape?.element || parent);

    // Order embelishments (without creating any views)
    this.orderEmbelishments();
    if (this.needsRootElement()) {
      // create as 2 sub span elements
      if (!this.rootShape) {
        this.createGlyphRoot(parent);
        // move the element into the parent
        this.moveGlyphToRoot();
      }

      this.createPostSpacingElement();
    }
  }

  protected createGlyphRoot(parent: SVGGraphicsElement): void {
    this.rootShape = new ElementShape(
      TSU.DOM.createSVGNode("tspan", {
        doc: document,
        parent: parent,
        attrs: {
          depth: this.flatAtom.depth || 0,
          atomid: this.flatAtom.atom.uuid,
          id: "atomViewRoot" + this.flatAtom.atom.uuid,
        },
      }),
    );
  }

  protected createPostSpacingElement(): void {
    this.postSpacingSpan = TSU.DOM.createSVGNode("tspan", {
      doc: document,
      parent: this.rootShape.element,
      attrs: {
        depth: this.flatAtom.depth || 0,
        atomid: this.flatAtom.atom.uuid,
        id: "postSpacing" + this.flatAtom.atom.uuid,
      },
      text: this.flatAtom.atom.beforeRest ? " - " : "  ",
    });
  }

  protected moveGlyphToRoot(): void {
    this.rootShape.element.appendChild(this.glyph.element);
  }

  protected createGlyphElement(parent: SVGGraphicsElement): void {
    const atom = this.flatAtom.atom;
    this.glyph = new ElementShape(
      TSU.DOM.createSVGNode("tspan", {
        doc: document,
        parent: parent,
        attrs: {
          depth: this.flatAtom.depth || 0,
          atomid: atom.uuid,
          id: "atom" + atom.uuid,
        },
        text: this.glyphLabel, // + (note.beforeRest ? " - " : " "),
      }),
    );
  }

  refreshLayout(): void {
    // refresh layout of embelishments slots
  }
}

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

  needsRootElement(): boolean {
    return this.note.shift == true || this.note.shift != 0 || super.needsRootElement();
  }

  protected createGlyphElement(parent: SVGGraphicsElement): void {
    super.createGlyphElement(parent);
    if (this.note.shift == true || this.note.shift != 0) {
      this.shiftElement = TSU.DOM.createSVGNode("tspan", {
        doc: document,
        parent: this.rootShape.element,
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
      this.rootShape.element.appendChild(this.shiftElement);
    }
  }

  orderEmbelishments(): void {
    const note = this.note;
    // create the embelishments if needed
    if (note.octave > 0) {
      this.topSlot.push(new OctaveIndicator(this, note));
    } else if (this.note.octave < 0) {
      this.bottomSlot.push(new OctaveIndicator(this, note));
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
