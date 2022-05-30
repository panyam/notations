import * as TSU from "@panyam/tsutils";
import { GridView, GridModel } from "../grids";
import { Line } from "../core";

export class LineView {
  // The beat layout associated with the layout params of this Line
  // at this point beats have already been added to the right columns
  beatGridView: GridView = new GridView(new GridModel());
  gElem: SVGGElement;

  // Space between two roles (within the same row)
  roleSpacing = 20;

  // Vertical space between two rows (of multiple roles)
  rowSpacing = 10;

  constructor(public readonly rootElement: SVGSVGElement, public line: Line, public readonly config?: any) {
    // create the gElem for wrapping and adjusting to size
    this.gElem = TSU.DOM.createSVGNode("g", {
      parent: this.rootElement,
      attrs: {
        class: "lineRoot",
        id: "lineRoot" + this.line.uuid,
      },
    }) as SVGGElement;
  }

  wrapToSize(): void {
    const bbox = (this.gElem as SVGSVGElement).getBBox();
    // set the size of the svg
    this.rootElement.setAttribute("width", "" + (4 + bbox.width));
    this.rootElement.setAttribute("height", "" + (15 + bbox.height));
    this.gElem.setAttribute("transform", `translate(${4 - bbox.x}, ${4 - bbox.y})`);
  }

  get prefSize(): TSU.Geom.Size {
    const bbox = this.rootElement.getBBox();
    // return new TSU.Geom.Size(4 + bbox.width + bbox.x, 4 + bbox.y + bbox.height);
    return new TSU.Geom.Size(4 + bbox.width, 4 + bbox.height);
  }
}
