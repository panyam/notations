import * as TSU from "@panyam/tsutils";
import { Embelishment, BeatView } from "../../common/lib/models/layouts";

export class BeatStartLines implements Embelishment {
  barSpacing = 20;
  protected line: SVGLineElement;

  constructor(public readonly source: BeatView, public readonly rootElement: SVGGraphicsElement) {
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
}

export class BeatEndLines implements Embelishment {
  lineSpacing = 2;
  protected lines: SVGLineElement[];

  constructor(public readonly source: BeatView, public readonly rootElement: SVGGraphicsElement, nLines = 1) {
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
