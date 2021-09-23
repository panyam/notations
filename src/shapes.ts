import * as TSU from "@panyam/tsutils";
import { FlatAtom } from "./iterators";

/**
 * Base class of all renderable objects for caching things like bounding boxes etc.
 * We do this since a lot of the property setters dont change bounding boxes but
 * bounding box reads are a bit slow in general.
 */
export abstract class Shape {
  private static idCounter = 0;
  readonly shapeId: number = Shape.idCounter++;
  needsLayout = true;
  protected xChanged = true;
  protected yChanged = true;
  protected widthChanged = true;
  protected heightChanged = true;
  protected _bbox: TSU.Geom.Rect;

  /**
   * refreshBBox is called by the Shape when it knows the bbox it is tracking
   * cannot be trusted and has to be refreshed by calling native methods.
   */
  protected abstract refreshBBox(): TSU.Geom.Rect;
  protected abstract updatePosition(x: null | number, y: null | number): [number | null, number | null];

  reset(): void {
    this.xChanged = true;
    this.yChanged = true;
    this.widthChanged = true;
    this.heightChanged = true;
    this._bbox = null as unknown as TSU.Geom.Rect;
  }

  moveTo(x: number | null, y: number | null): [number | null, number | null] {
    [x, y] = this.updatePosition(x, y);
    if (x != null) this.bbox.x = x;
    if (y != null) this.bbox.y = y;
    return [x, y];
  }

  get bbox(): TSU.Geom.Rect {
    if (!this._bbox) {
      this._bbox = this.refreshBBox();
      this.xChanged = this.yChanged = this.widthChanged = this.heightChanged = false;
    }
    return this._bbox;
  }

  /**
   * Called internally when x or y has changed and if any flags need to be updated
   * indicating a layout refresh.
   */
  protected xyUpdated(x: number | null, y: number | null): void {
    if (x != null) {
      this.xChanged = true;
      this.needsLayout = true;
      this.bbox.x = x;
    }
    if (y != null) {
      this.yChanged = true;
      this.needsLayout = true;
      this.bbox.y = y;
    }
  }

  get x(): number {
    return this.bbox.x;
  }

  set x(x: number) {
    const [nx, ny] = this.updatePosition(x, null);
    this.xyUpdated(nx, ny);
  }

  get y(): number {
    return this.bbox.y;
  }

  set y(y: number) {
    // if (y != this.bbox.y) {
    const [nx, ny] = this.updatePosition(null, y);
    this.xyUpdated(nx, ny);
    // }
  }

  get width(): number {
    return this.bbox.width;
  }

  get height(): number {
    return this.bbox.height;
  }

  /*
  get size(): TSU.Geom.Size {
    const bbox = this.bbox;
    return new TSU.Geom.Size(bbox.width, bbox.height);
  }
  */

  /**
   * This is called when bounds or other properties of a shape have changed to
   * give the shape an opportunity to layout the children.  For shapes
   * with no children this is a no-op.  It is expected the Shape will keep track
   * of all changes so it can apply them all in in one go in this method - A
   * form of "commit"ing the layout transaction.
   */
  refreshLayout(): void {
    // throw new Error("Implement this");
  }
}

export abstract class Embelishment extends Shape {}

export class ElementShape extends Shape {
  constructor(public readonly element: SVGGraphicsElement) {
    super();
  }

  protected refreshBBox(): TSU.Geom.Rect {
    const bbox = TSU.Geom.Rect.from(this.element.getBBox());
    // Due to safari bug which returns really crazy span widths!
    if (TSU.Browser.IS_SAFARI()) {
      const clientRect = this.element.getClientRects()[0];
      if (clientRect) {
        const parentClientRect = this.element.parentElement?.getBoundingClientRect();
        bbox.x = bbox.x + clientRect.x - (parentClientRect?.x || 0);
        // bbox.y = clientRect.y; //  - (parentClientRect?.y || 0);
        bbox.width = clientRect.width;
        bbox.height = clientRect.height;
      }
    }
    return bbox;
  }

  protected updatePosition(x: null | number, y: null | number): [number | null, number | null] {
    if (x != null) {
      this.element.removeAttribute("dx");
      this.element.setAttribute("x", "" + x);
    }
    if (y != null) {
      this.element.removeAttribute("dy");
      this.element.setAttribute("y", "" + y);
    }
    return [x, y];
  }
}

export abstract class AtomView extends Shape {
  glyph: ElementShape;
  depth = 0;
  roleIndex = 0;

  // LayoutMetrics for the AtomView so all atomviews laid out on the
  // same baseline will show up aligned vertically
  baseline: number;
  ascent: number;
  descent: number;
  capHeight: number;
  leading: number;

  constructor(public flatAtom: FlatAtom) {
    super();
  }

  abstract get minSize(): TSU.Geom.Size;
  protected refreshBBox(): TSU.Geom.Rect {
    return this.glyph.bbox;
  }

  protected updatePosition(x: null | number, y: null | number): [number | null, number | null] {
    return this.glyph.moveTo(x, y);
  }

  /**
   * Creates views needed for this AtomView.
   */
  abstract createElements(parent: SVGGraphicsElement): void;
  abstract refreshLayout(): void;

  get viewId(): number {
    return this.flatAtom.uuid;
  }

  embRoot(): SVGGraphicsElement {
    let rootElem = this.glyph.element.parentElement as any as SVGGraphicsElement;
    while (rootElem && (rootElem.tagName == "tspan" || rootElem.tagName == "text")) {
      rootElem = rootElem.parentElement as any as SVGGraphicsElement;
    }
    return rootElem;
  }
}
