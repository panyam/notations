import * as TSU from "@panyam/tsutils";
import { Note } from "../core";
import { BeatView } from "../beatview";
import { Embelishment, GroupView as GroupViewBase } from "../shapes";
import { LeafAtomView } from "./atomviews";
import { JaaruGamaka } from "./gamakas";

/**
 * Embelishments specifically "around" a single atom view.
 */
export abstract class LeafAtomViewEmbelishment extends Embelishment {
  constructor(public readonly atomView: LeafAtomView) {
    super();
  }
}

export class OctaveIndicator extends LeafAtomViewEmbelishment {
  dotRadius = 1;
  dotSpacing = 2.5;
  dotsElem: SVGGElement;

  constructor(
    public readonly noteView: LeafAtomView,
    public readonly note: Note,
  ) {
    super(noteView);
    const rootElem = this.noteView.embRoot();
    const numDots = Math.abs(note.octave);
    this.dotsElem = TSU.DOM.createSVGNode("g", {
      doc: document,
      parent: rootElem,
      attrs: {
        width: this.dotRadius * 2 * numDots + (numDots - 1) * this.dotSpacing,
        height: this.dotRadius * 2,
        source: "atom" + this.noteView.leafAtom.uuid,
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
          class: "notation-octave-dot",
        },
      });
      cx += this.dotRadius + this.dotRadius + this.dotSpacing;
    }
  }

  protected refreshBBox(): TSU.Geom.Rect {
    return TSU.DOM.svgBBox(this.dotsElem);
  }

  protected refreshMinSize(): TSU.Geom.Size {
    const numDots = Math.abs(this.note.octave);
    return {
      width: this.dotRadius * 2 * numDots + (numDots - 1) * this.dotSpacing,
      height: this.dotRadius * 2,
    };
  }

  protected updateBounds(
    x: null | number,
    y: null | number,
    _w: null | number,
    _h: null | number,
  ): [number | null, number | null, number | null, number | null] {
    if (x == null) x = this.x;
    if (y == null) y = this.y;
    // cannot set w/h
    // this.bbox.x = x;
    // this.bbox.y = y;
    return [x, y, null, null];
  }

  refreshLayout(): void {
    this.dotsElem.setAttribute("transform", "translate(" + this.x + "," + this.y + ")");
  }
}

////////// Carnatic embelishments
export class LabelEmbelishment extends LeafAtomViewEmbelishment {
  labelElem: SVGTextElement;
  constructor(
    public readonly label: string,
    public readonly atomView: LeafAtomView,
  ) {
    super(atomView);
    const rootElem = this.atomView.embRoot();
    this.labelElem = TSU.DOM.createSVGNode("text", {
      doc: document,
      parent: rootElem,
      text: label,
      attrs: {
        source: "atom" + this.atomView.leafAtom.uuid,
        class: "notation-embelishment-label",
        "dominant-baseline": "hanging",
      },
    });
  }

  protected refreshBBox(): TSU.Geom.Rect {
    return TSU.DOM.svgBBox(this.labelElem);
  }

  protected refreshMinSize(): TSU.Geom.Size {
    return TSU.DOM.svgBBox(this.labelElem);
  }

  protected updateBounds(
    x: null | number,
    y: null | number,
    w: null | number,
    h: null | number,
  ): [number | null, number | null, number | null, number | null] {
    return [x, y, w, h];
  }

  refreshLayout(): void {
    this.labelElem.setAttribute("x", "" + this.x);
    this.labelElem.setAttribute("y", "" + this.y);
  }
}

export class BeatStartLines extends Embelishment {
  barSpacing = 10;
  protected line: SVGLineElement;

  constructor(
    public readonly source: BeatView,
    public readonly rootElement: SVGGraphicsElement,
  ) {
    super();
    this.line = TSU.DOM.createSVGNode("line", {
      doc: document,
      parent: this.rootElement,
      attrs: {
        class: "bar-start-line",
      },
    });
  }

  protected refreshBBox(): TSU.Geom.Rect {
    return new TSU.Geom.Rect(0, 0, 0, 0);
  }

  protected refreshMinSize(): TSU.Geom.Size {
    return new TSU.Geom.Rect(0, 0, 0, 0);
  }

  refreshLayout(): void {
    const line = this.line;
    const x = this.source.x - this.barSpacing;
    line.setAttribute("x1", "" + x);
    line.setAttribute("x2", "" + x);
    const y = this.source.y + this.source.bbox.y;
    const h = this.source.bbox.height;
    line.setAttribute("y1", "" + y);
    line.setAttribute("y2", "" + (y + h));
  }

  protected updateBounds(
    x: null | number,
    y: null | number,
    w: null | number,
    h: null | number,
  ): [number | null, number | null, number | null, number | null] {
    return [x, y, null, h];
  }
}

export class BeatEndLines extends Embelishment {
  lineSpacing = 2;
  protected lines: SVGLineElement[];

  constructor(
    public readonly source: BeatView,
    public readonly rootElement: SVGGraphicsElement,
    nLines = 1,
  ) {
    super();
    this.lines = [];
    for (let i = 0; i < nLines; i++) {
      this.lines.push(
        TSU.DOM.createSVGNode("line", {
          doc: document,
          // parent: l2g,
          parent: this.rootElement,
          attrs: {
            class: "bar-end-line",
          },
        }),
      );
    }
  }

  protected refreshBBox(): TSU.Geom.Rect {
    return new TSU.Geom.Rect(0, 0, 0, 0);
  }

  protected refreshMinSize(): TSU.Geom.Size {
    return new TSU.Geom.Rect(0, 0, 0, 0);
  }

  protected updatePosition(x: null | number, y: null | number): [number | null, number | null] {
    return [x, y];
  }

  barSpacing = 0;

  refreshLayout(): void {
    // const x = this.source.width + this.barSpacing;
    // const y = 0;
    // const h = this.source.height;
    const x = this.source.x + this.source.width + this.barSpacing;
    const y = this.source.y + this.source.bbox.y;
    const h = this.source.bbox.height;
    let currX = x;
    for (const line of this.lines) {
      const lx = "" + currX;
      line.setAttribute("x1", lx);
      line.setAttribute("x2", lx);
      currX += 4;
    }
    for (const line of this.lines) {
      line.setAttribute("y1", "" + y);
      line.setAttribute("y2", "" + (y + h));
    }
  }

  protected updateBounds(
    _x: null | number,
    _y: null | number,
    _w: null | number,
    _h: null | number,
  ): [number | null, number | null, number | null, number | null] {
    return [null, null, null, null];
  }
}

/// Carnatic Embelishments
export class Kampitham extends LabelEmbelishment {
  constructor(public readonly atomView: LeafAtomView) {
    super("~", atomView);
  }
}

export class Nokku extends LabelEmbelishment {
  constructor(public readonly atomView: LeafAtomView) {
    super("w", atomView);
  }
}

export class Prathyagatham extends LabelEmbelishment {
  constructor(public readonly atomView: LeafAtomView) {
    super("∵", atomView);
  }
}
export class Spuritham extends LabelEmbelishment {
  constructor(public readonly atomView: LeafAtomView) {
    super("∴", atomView);
  }
}
export class Raavi extends LabelEmbelishment {
  constructor(public readonly atomView: LeafAtomView) {
    super("^", atomView);
  }
}
export class Kandippu extends LabelEmbelishment {
  constructor(public readonly atomView: LeafAtomView) {
    super("✓", atomView);
  }
}

export class Vaali extends LabelEmbelishment {
  constructor(public readonly atomView: LeafAtomView) {
    super("⌒", atomView);
  }
}
export class Odukkal extends LabelEmbelishment {
  constructor(public readonly atomView: LeafAtomView) {
    super("x", atomView);
  }
}
export class Orikkai extends LabelEmbelishment {
  constructor(public readonly atomView: LeafAtomView) {
    super("γ", atomView);
  }
}

export class Jaaru extends LeafAtomViewEmbelishment {
  pathElem: SVGPathElement;
  constructor(
    public readonly jaaru: JaaruGamaka,
    public readonly atomView: LeafAtomView,
  ) {
    super(atomView);
    // TODO - Create the "fancier" view
    // for now represent this with just a slant line (like a slash)
    const rootElem = this.atomView.embRoot();
    this.pathElem = TSU.DOM.createSVGNode("path", {
      doc: document,
      parent: rootElem,
      attrs: {
        source: "atom" + this.atomView.leafAtom.uuid,
        class: "notation-jaaru-path",
        d: this.pathAttribute(),
      },
    });
  }

  pathAttribute(x = 0): string {
    const avbbox = this.atomView.glyph.minSize;
    let y2 = 0;
    const h2 = avbbox.height / 2;
    const x2 = x + h2;
    let y = this.atomView.y;
    if (this.jaaru.ascending) {
      y += avbbox.height;
      y2 = y - h2;
    } else {
      y -= h2;
      y2 = y + h2;
    }
    return [`M ${x} ${y}`, `Q ${x2} ${y} ${x2} ${y2}`].join(" ");
  }

  protected refreshMinSize(): TSU.Geom.Size {
    return TSU.DOM.svgBBox(this.pathElem);
  }

  protected refreshBBox(): TSU.Geom.Rect {
    return TSU.DOM.svgBBox(this.pathElem);
  }

  protected updateBounds(
    x: null | number,
    _y: null | number,
    _w: null | number,
    _h: null | number,
  ): [number | null, number | null, number | null, number | null] {
    return [x, null, null, null];
  }

  refreshLayout(): void {
    this.pathElem.setAttribute("d", this.pathAttribute(this.x));
  }
}

/**
 * Position mode for GroupBracket - controls how the bracket interacts with embellishments.
 */
export type GroupBracketPositionMode = "above-all" | "below-embellishments" | "separate-space";

/**
 * Renders a single bracket line as the top border of a GroupView container.
 * Each nested group gets its own bracket line, creating a visual effect where
 * atoms inside deeply nested groups appear to have multiple lines above them.
 *
 * For example, with notation `A B [ S R [ P D [ W X ] ] ]`:
 * - Group 1 (outermost) has 1 bracket line
 * - Group 2 has 1 bracket line (inside Group 1's bracket)
 * - Group 3 (innermost) has 1 bracket line (inside Groups 1 & 2's brackets)
 * - Atoms W X visually appear to have 3 lines above (cumulative effect)
 */
export class GroupBracket extends Embelishment {
  private line: SVGLineElement | null = null;
  private leftCircle: SVGCircleElement | null = null;
  private rightCircle: SVGCircleElement | null = null;
  private bracketGroup: SVGGElement | null = null;

  // Configuration - exposed for experimentation
  /** Distance above group content */
  lineOffset = 4;
  /** End circle radius */
  circleRadius = 1.5;
  /** How far line extends beyond group content on each side */
  lineExtension = 2;

  /**
   * Position mode for embellishment interaction experimentation:
   * - 'above-all': Bracket at very top, above all embellishments (default)
   * - 'below-embellishments': Bracket between glyphs and embellishments
   * - 'separate-space': Bracket in dedicated reserved space
   */
  positionMode: GroupBracketPositionMode = "above-all";

  constructor(public readonly groupView: GroupViewBase) {
    super();

    this.bracketGroup = TSU.DOM.createSVGNode("g", {
      doc: document,
      parent: this.groupView.groupElement,
      attrs: {
        class: "group-bracket",
        source: "group" + this.groupView.group.uuid,
      },
    });

    this.line = TSU.DOM.createSVGNode("line", {
      doc: document,
      parent: this.bracketGroup,
      attrs: {
        class: "group-bracket-line",
      },
    });

    this.leftCircle = TSU.DOM.createSVGNode("circle", {
      doc: document,
      parent: this.bracketGroup,
      attrs: {
        class: "group-bracket-circle",
        r: String(this.circleRadius),
      },
    });

    this.rightCircle = TSU.DOM.createSVGNode("circle", {
      doc: document,
      parent: this.bracketGroup,
      attrs: {
        class: "group-bracket-circle",
        r: String(this.circleRadius),
      },
    });
  }

  protected refreshBBox(): TSU.Geom.Rect {
    if (!this.bracketGroup) return new TSU.Geom.Rect(0, 0, 0, 0);
    return TSU.DOM.svgBBox(this.bracketGroup);
  }

  protected refreshMinSize(): TSU.Geom.Size {
    // Single bracket line height contribution
    return new TSU.Geom.Size(0, this.lineOffset + this.circleRadius);
  }

  protected updateBounds(
    x: null | number,
    y: null | number,
    w: null | number,
    h: null | number,
  ): [number | null, number | null, number | null, number | null] {
    return [x, y, w, h];
  }

  refreshLayout(): void {
    if (!this.line || !this.leftCircle || !this.rightCircle) return;

    const bbox = this.groupView.bbox;
    const groupWidth = bbox.width;

    // Calculate Y position based on position mode
    let y: number;
    switch (this.positionMode) {
      case "below-embellishments":
        // Position just above glyph content, below other embellishments
        y = bbox.y + this.lineOffset;
        break;
      case "separate-space":
        // Use dedicated space at very top of group bbox
        y = bbox.y - this.lineOffset;
        break;
      case "above-all":
      default:
        // Position above everything including embellishments
        y = bbox.y - this.lineOffset;
        break;
    }

    const x1 = -this.lineExtension;
    const x2 = groupWidth + this.lineExtension;

    this.line.setAttribute("x1", String(x1));
    this.line.setAttribute("y1", String(y));
    this.line.setAttribute("x2", String(x2));
    this.line.setAttribute("y2", String(y));

    this.leftCircle.setAttribute("cx", String(x1));
    this.leftCircle.setAttribute("cy", String(y));
    this.rightCircle.setAttribute("cx", String(x2));
    this.rightCircle.setAttribute("cy", String(y));
  }
}
