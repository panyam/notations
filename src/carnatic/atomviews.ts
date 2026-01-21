import * as TSU from "@panyam/tsutils";
import { Atom, Group, Literal, AtomType, Note, Space, Syllable, Marker } from "../core";
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
  GroupBracket,
} from "./embelishments";
import { GamakaType } from "./gamakas";

export class GroupView extends GroupViewBase {
  /** Height reserved for bracket line (lineOffset + circleRadius + padding) */
  static readonly BRACKET_HEIGHT = 8;

  createAtomView(atom: Atom): AtomView {
    // Propagate depth + 1 to child atoms
    return createAtomView(this.groupElement, atom, this.defaultToNotes, 0.7, this.depth + 1);
  }

  /**
   * Creates embellishments for this group, including the bracket line
   * that serves as the top border of this group container.
   */
  protected createEmbelishments(): Embelishment[] {
    const embelishments = super.createEmbelishments();
    // Add bracket line for nested groups (depth >= 1)
    if (this.depth >= 1) {
      embelishments.push(new GroupBracket(this));
    }
    return embelishments;
  }

  /**
   * Calculates the minimum size of this group, including space for the bracket line.
   * The bracket line adds height for nested groups (depth >= 1).
   */
  protected refreshMinSize(): TSU.Geom.Size {
    const baseSize = super.refreshMinSize();

    // Add height for bracket line if this is a nested group
    if (this.depth >= 1) {
      return new TSU.Geom.Size(baseSize.width, baseSize.height + GroupView.BRACKET_HEIGHT * this.scaleFactor);
    }

    return baseSize;
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

  /**
   * Returns the horizontal offset from the atom's origin to where the note glyph starts.
   * This is the total width of left embellishments (e.g., Jaaru symbols).
   */
  get glyphOffset(): number {
    return (
      this.leftSlot.reduce((a, b) => a + b.minSize.width, 0) + this.leftSlot.length // Padding of 1 per embellishment
    );
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
    const glyphY = this.glyph.y;
    currY = glyphY - this.glyph.minSize.height + 5;
    for (const emb of this.topSlot) {
      const bb = emb.minSize;
      emb.setBounds(glyphX + (gminSize.width - bb.width) / 2, currY - bb.height, null, null, true);
      currY = emb.y;
    }

    // bottom embelishments
    currY = glyphY + 7;
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
    if (atom.TYPE != AtomType.SYLLABLE && atom.TYPE != AtomType.NOTE) {
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

/**
 * View for rendering Marker atoms (annotations like \@label).
 * Displays the marker's text content.
 */
class MarkerView extends LeafAtomView {
  get glyphLabel(): string {
    return this.marker.text;
  }

  get marker(): Marker {
    return this.leafAtom as Marker;
  }
}

/**
 * Placeholder view for unknown/unhandled atom types.
 * Shows an error indicator instead of crashing the renderer.
 */
class UnknownAtomView extends LeafAtomView {
  get glyphLabel(): string {
    // Show the atom type in brackets as a visual error indicator
    return `[?${this.leafAtom.TYPE}]`;
  }
}

export function createAtomView(
  parent: SVGGraphicsElement,
  atom: Atom,
  litDefaultsToNote = false,
  groupViewScale = 1.0,
  depth = 0,
): AtomView {
  let out: AtomView;
  switch (atom.TYPE) {
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
    case AtomType.MARKER:
      out = new MarkerView(atom as Marker);
      break;
    default:
      // Unknown atom type - show placeholder instead of crashing
      console.warn(`Unknown atom type: ${atom.TYPE} - rendering placeholder`);
      out = new UnknownAtomView(atom as any);
  }
  out.depth = depth;
  out.createElements(parent);
  return out;
}
