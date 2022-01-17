import * as TSU from "@panyam/tsutils";
import { Atom, Group, Literal, AtomType, Note, Space, Syllable } from "../core";
import {
  LeafAtomView as LeafAtomViewBase,
  GroupView as GroupViewBase,
  AtomView,
  Embelishment,
  ElementShape,
} from "../shapes";
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

export class GroupView extends GroupViewBase {
  createAtomView(atom: Atom): AtomView {
    return createAtomView(this.groupElement, atom, this.defaultToNotes, 0.7);
  }
}

export abstract class LeafAtomView extends LeafAtomViewBase {
  leftSlot: Embelishment[] = [];
  topSlot: Embelishment[] = [];
  rightSlot: Embelishment[] = [];
  bottomSlot: Embelishment[] = [];
  glyph: ElementShape;

  // Spaces required before and after to accomodate for left and right slots
  protected postSpacingSpan: SVGTSpanElement;
  // Sometimes this.element may not be the root element if we need spacings
  // the rootElement is the top of the chain
  protected rootGroup: ElementShape;
  protected rootText: ElementShape;

  abstract get glyphLabel(): string;

  protected refreshBBox(): TSU.Geom.Rect {
    return TSU.DOM.svgBBox(this.rootGroup.element);
  }

  protected refreshMinSize(): TSU.Geom.Size {
    const out = { ...this.rootText.minSize };
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

  protected layoutElements(): void {
    // Lays out all the child elements locally
    const textSize = this.rootText.minSize;
    // assume text is at 0,0 and lay things around it

    // now layout leftSlots
    let currX = 0;
    let currY = this.hasY ? this.y : 0;
    // place left embelishments
    for (const emb of this.leftSlot) {
      emb.x = currX;
      emb.refreshLayout();
      currX += emb.minSize.width + 1;
    }

    // now place the text
    const textX = currX;
    this.rootText.x = currX;
    this.rootText.refreshLayout();

    // And right embelishments
    currX += this.rootText.minSize.width;
    for (const emb of this.rightSlot) {
      emb.x = currX;
      emb.refreshLayout();
      currX += emb.minSize.width + 1;
    }

    // layout top and bottom if x or y has changed
    const gminSize = this.glyph.minSize;

    // top embelishments
    const glyphX = textX + this.glyph.x;
    let glyphY = this.glyph.y;
    if (!TSU.Browser.IS_SAFARI()) {
      glyphY += 3;
    }
    currY = glyphY - 1 - this.glyph.minSize.height;
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
    this.invalidateBounds();
  }

  refreshLayout(): void {
    // TODO - move this code out to refreshLayout?
    // set the glyphs Y first so we can layout others
    this.layoutElements();
    this.rootGroup.element.setAttribute("transform", "translate(" + this.x + "," + this.y + ")");
  }

  protected addEmbelishment(slot: Embelishment[], emb: Embelishment): void {
    slot.push(emb);
    // this.addShape(emb);
  }

  /**
   * Orders embelishments and creates their views.
   */
  orderEmbelishments(): void {
    const atom = this.leafAtom;
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

  embRoot(): SVGGraphicsElement {
    return this.rootGroup.element;
  }

  needsRootElement(): boolean {
    return true; // this.rightSlot.length > 0 || this.leafAtom.beforeRest;
  }

  createElements(parent: SVGGraphicsElement): void {
    // Create the glyph element first before anything
    // this allows embelishments to get early access to this element
    this.createGlyphRoot(parent);
    this.createGlyphElement();
    // Order embelishments (without creating any views)
    this.orderEmbelishments();
    this.createPostSpacingElement();
    this.invalidateBounds();
  }

  protected createGlyphRoot(parent: SVGGraphicsElement): void {
    this.rootGroup = new ElementShape(
      TSU.DOM.createSVGNode("g", {
        doc: document,
        parent: parent,
        attrs: {
          atomid: this.leafAtom.uuid,
          class: "atomViewRootGroup",
          id: "atomViewRootGroup" + this.leafAtom.uuid,
        },
      }),
    );
    this.rootText = new ElementShape(
      TSU.DOM.createSVGNode("text", {
        doc: document,
        parent: this.rootGroup.element,
        attrs: {
          atomid: this.leafAtom.uuid,
          class: "atomViewTextRoot",
          id: "atomViewTextRoot" + this.leafAtom.uuid,
        },
      }),
    );
  }

  protected createGlyphElement(): void {
    const atom = this.leafAtom;
    this.glyph = new ElementShape(
      TSU.DOM.createSVGNode("tspan", {
        doc: document,
        parent: this.rootText.element,
        attrs: {
          atomid: atom.uuid,
          id: "atomGlyph" + atom.uuid,
        },
        text: this.glyphLabel, // + (note.beforeRest ? " - " : " "),
      }),
    );
  }

  protected createPostSpacingElement(): void {
    if (this.leafAtom.beforeRest) {
      this.postSpacingSpan = TSU.DOM.createSVGNode("tspan", {
        doc: document,
        parent: this.rootText.element,
        attrs: {
          atomid: this.leafAtom.uuid,
          id: "postSpacing" + this.leafAtom.uuid,
        },
        text: this.leafAtom.beforeRest ? " - " : "  ",
      });
    }
  }
}

class SpaceView extends LeafAtomView {
  get glyphLabel(): string {
    if (this.space.isSilent) return " ";
    if (this.space.duration.isOne) return ",";
    if (this.space.duration.cmpNum(2) == 0) return ";";
    return "_";
  }

  get space(): Space {
    return this.leafAtom as Space;
  }
}

class NoteView extends LeafAtomView {
  protected shiftElement: SVGTSpanElement;
  get glyphLabel(): string {
    return this.note.value;
  }

  needsRootElement(): boolean {
    return true; // this.note.shift == true || this.note.shift != 0 || super.needsRootElement();
  }

  protected createGlyphElement(): void {
    super.createGlyphElement();
    if (this.note.shift == true || this.note.shift != 0) {
      this.shiftElement = TSU.DOM.createSVGNode("tspan", {
        doc: document,
        parent: this.rootText.element,
        attrs: {
          atomid: this.note.uuid,
          class: "noteShiftTSpan",
          id: "noteShift" + this.note.uuid,
          "baseline-shift": "sub",
        },
        text: (this.note.shift == true ? "*" : this.note.shift) + " ",
      });
    }
  }

  protected moveGlyphToRoot(): void {
    // super.moveGlyphToRoot();
    if (this.shiftElement) {
      this.rootGroup.element.appendChild(this.shiftElement);
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
    return this.leafAtom as Note;
  }
}

class SyllableView extends LeafAtomView {
  get glyphLabel(): string {
    return this.syllable.value;
  }

  get syllable(): Syllable {
    return this.leafAtom as Syllable;
  }
}

export function createAtomView(
  parent: SVGGraphicsElement,
  atom: Atom,
  litDefaultsToNote = false,
  groupViewScale = 1.0,
): AtomView {
  let out: AtomView;
  switch (atom.type) {
    // Dealing with leaf atoms
    case AtomType.SPACE:
      out = new SpaceView(atom as Space);
      break;
    case AtomType.SYLLABLE:
      out = new SyllableView(atom as Syllable);
      break;
    case AtomType.NOTE:
      out = new NoteView(atom as Note);
      break;
    case AtomType.LITERAL:
      if (litDefaultsToNote) {
        const lit = Note.fromLit(atom as Note);
        out = new NoteView(lit);
      } else {
        const lit = Syllable.fromLit(atom as Syllable);
        out = new SyllableView(lit);
      }
      break;
    case AtomType.GROUP:
      out = new GroupView(atom as Group);
      (out as GroupView).defaultToNotes = litDefaultsToNote;
      (out as GroupView).scaleFactor = groupViewScale;
      break;
    default:
      // We should never get a group as we are iterating
      // at leaf atom levels
      throw new Error("Invalid atom type: " + atom.type);
  }
  out.createElements(parent);
  return out;
}
