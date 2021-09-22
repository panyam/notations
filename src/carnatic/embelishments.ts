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

export class BeatStartLines extends Embelishment {
  barSpacing = 20;
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

  refreshLayout(): void {
    // At this point it is possible that we are starting a bar but
    // there are no atoms in the bar
    const x = "" + (this.source.x - this.barSpacing);
    const line = this.line;
    line.setAttribute("x1", x);
    line.setAttribute("x2", x);
    line.setAttribute("y1", "" + this.source.y);
    line.setAttribute("y2", "" + (this.source.y + this.source.height));
  }

  protected refreshBBox(): TSU.Geom.Rect {
    return new TSU.Geom.Rect(0, 0, 0, 0);
  }

  protected updatePosition(x: null | number, y: null | number): [number | null, number | null] {
    return [x, y];
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

  protected refreshBBox(): TSU.Geom.Rect {
    return new TSU.Geom.Rect(0, 0, 0, 0);
  }

  protected updatePosition(x: null | number, y: null | number): [number | null, number | null] {
    return [x, y];
  }

  barSpacing = 15;
  refreshLayout(): void {
    let currX = this.source.x + this.source.width + this.barSpacing;
    this.lines.forEach((line) => {
      const lx = "" + currX;
      line.setAttribute("x1", lx);
      line.setAttribute("x2", lx);
      line.setAttribute("y1", "" + this.source.y);
      line.setAttribute("y2", "" + (this.source.y + this.source.height));
      currX += 4;
    });
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
