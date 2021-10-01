import * as TSU from "@panyam/tsutils";
import { Note } from "../core";
import { BeatView } from "../layouts";
import { AtomView, Embelishment } from "../shapes";
import { JaaruGamaka } from "./gamakas";

/**
 * Embelishments specifically "around" a single atom view.
 */
export abstract class AtomViewEmbelishment extends Embelishment {
  constructor(public readonly atomView: AtomView) {
    super();
  }
}

export class OctaveIndicator extends AtomViewEmbelishment {
  dotRadius = 1;
  dotSpacing = 2.5;
  dotsElem: SVGGElement;

  constructor(public readonly noteView: AtomView, public readonly note: Note) {
    super(noteView);
    const rootElem = this.noteView.embRoot();
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

  protected refreshMinSize(): TSU.Geom.Size {
    return TSU.Geom.Rect.from(this.dotsElem.getBBox());
  }

  protected updateBounds(
    x: null | number,
    y: null | number,
    w: null | number,
    h: null | number,
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

  constructor(public readonly source: BeatView, public readonly rootElement: SVGGraphicsElement) {
    super();
    this.line = TSU.DOM.createSVGNode("line", {
      doc: document,
      parent: this.rootElement,
      attrs: {
        stroke: "black",
        "stroke-width": "1",
        class: "bar-start-line",
      },
    });
  }

  protected refreshMinSize(): TSU.Geom.Size {
    return new TSU.Geom.Rect(0, 0, 0, 0);
  }

  refreshLayout(): void {
    const line = this.line;
    const x = -this.barSpacing;
    line.setAttribute("x1", "" + x);
    line.setAttribute("x2", "" + x);
    const y = 0;
    const h = this.source.height;
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

  constructor(public readonly source: BeatView, public readonly rootElement: SVGGraphicsElement, nLines = 1) {
    super();
    this.lines = [];
    for (let i = 0; i < nLines; i++) {
      this.lines.push(
        TSU.DOM.createSVGNode("line", {
          doc: document,
          // parent: l2g,
          parent: this.rootElement,
          attrs: {
            stroke: "black",
            "stroke-width": "1",
            class: "bar-end-line",
          },
        }),
      );
    }
  }

  protected refreshMinSize(): TSU.Geom.Size {
    return new TSU.Geom.Rect(0, 0, 0, 0);
  }

  protected updatePosition(x: null | number, y: null | number): [number | null, number | null] {
    return [x, y];
  }

  barSpacing = 15;

  refreshLayout(): void {
    const x = this.source.width + this.barSpacing;
    const y = 0;
    const h = this.source.height;
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
    x: null | number,
    y: null | number,
    w: null | number,
    h: null | number,
  ): [number | null, number | null, number | null, number | null] {
    return [null, null, null, null];
  }
}

/// Carnatic Embelishments
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
  constructor(public readonly jaaru: JaaruGamaka, public readonly atomView: AtomView) {
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
    const avbbox = this.atomView.minSize;
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

  protected updateBounds(
    x: null | number,
    y: null | number,
    w: null | number,
    h: null | number,
  ): [number | null, number | null, number | null, number | null] {
    return [x, null, null, null];
  }

  refreshLayout(): void {
    this.pathElem.setAttribute("d", this.pathAttribute(this.x));
  }
}
