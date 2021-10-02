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

  protected refreshMinSize(): TSU.Geom.Size {
    const out = { ...(this.rootShape || this.glyph).minSize };
    const totalWidth =
      this.leftSlot.reduce((a, b) => a + b.minSize.width, 0) +
      this.rightSlot.reduce((a, b) => a + b.minSize.width, 0) +
      this.leftSlot.length + // Padding of 1
      this.rightSlot.length; // Padding of 1
    const totalHeight =
      this.topSlot.reduce((a, b) => a + b.minSize.height, 0) +
      this.bottomSlot.reduce((a, b) => a + b.minSize.height, 0);
    out.width += totalWidth;
    out.height += totalHeight;
    // if (this.postSpacingSpan) out.width += this.postSpacingSpan.getBBox().width;
    return out;
  }

  protected updateBounds(
    x: null | number,
    y: null | number,
    w: null | number,
    h: null | number,
  ): [number | null, number | null, number | null, number | null] {
    return [x, y, NaN, NaN];
  }

  refreshLayout(): void {
    // TODO - move this code out to refreshLayout?
    // set the glyphs Y first so we can layout others
    const x = this.x;
    const y = this.y;
    this.glyph.setBounds(null, y, null, null, true);

    // now layout leftSlots
    let currX = x;
    let currY = y;
    if (currX != null) {
      // place left embelishments
      for (const emb of this.leftSlot) {
        emb.x = currX;
        emb.refreshLayout();
        currX += emb.minSize.width + 1;
      }

      // now place the glyph
      const glyphRoot = this.rootShape || this.glyph;
      glyphRoot.x = currX;
      glyphRoot.refreshLayout();
      currX += glyphRoot.minSize.width;

      // And right embelishments
      for (const emb of this.rightSlot) {
        emb.x = currX;
        emb.refreshLayout();
        currX += emb.minSize.width + 1;
      }
    }

    // layout top and bottom if x or y has changed
    if (currX != null || currY != null) {
      const gminSize = this.glyph.minSize;

      // top embelishments
      const glyphX = this.glyph.x;
      const glyphY = this.glyph.y;
      currY = glyphY - 1;
      for (const emb of this.topSlot) {
        const bb = emb.minSize;
        emb.setBounds(glyphX + (gminSize.width - bb.width) / 2, currY - bb.height, null, null, true);
        currY = emb.y;
      }

      // bottom embelishments
      currY = glyphY + gminSize.height + 2;
      for (const emb of this.bottomSlot) {
        const bb = emb.minSize;
        emb.setBounds(glyphX + (gminSize.width - bb.width) / 2, currY, null, null, true);
        currY = emb.y + bb.height;
      }
    }
    this.resetMinSize();
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
