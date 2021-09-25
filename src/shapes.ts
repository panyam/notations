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
  /*
  protected xChanged = true;
  protected yChanged = true;
  protected widthChanged = true;
  protected heightChanged = true;
  */
  /**
   * Note that x and y coordinates are not always the x and y coordinates of the bounding box.
   * Eg a circle's x and y coordinates are its center point and not the top left corner
   * These "main" coordinates are referred as control coordinates.
   */
  protected _x: number | null = null;
  protected _y: number | null = null;
  protected _width: number | null = null;
  protected _height: number | null = null;
  protected _bbox: TSU.Geom.Rect;
  protected parentShape: Shape | null = null;
  children: Shape[] = [];

  /**
   * Add a child shape.
   */
  addShape(child: Shape, index = -1): void {
    // Orphan it first
    child.removeFromParent();

    // Then add it
    if (index >= 0) {
      this.children.splice(index, 0, child);
    } else {
      this.children.push(child);
    }
    child.parentShape = this;
  }

  /**
   * Remove a child from our children list if it exists.
   */
  removeShape(child: Shape): void {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
    }
    child.parentShape = null;
  }

  /**
   * Remove ourselves from our parent.
   */
  removeFromParent(): void {
    if (this.parentShape) {
      this.parentShape.removeShape(this);
    }
  }

  /**
   * Returns the unioned bounding box of all child shapes.
   */
  protected childrenBBox(): TSU.Geom.Rect | null {
    let bbox: TSU.Geom.Rect | null = null;
    for (let i = this.children.length - 1; i >= 0; i--) {
      if (bbox == null) bbox = TSU.Geom.Rect.from(this.children[i].bbox);
      else bbox = bbox.union(this.children[i].bbox);
    }
    return bbox;
  }

  /**
   * refreshBBox is called by the Shape when it knows the bbox it is tracking
   * cannot be trusted and has to be refreshed by calling native methods.
   */
  protected abstract refreshBBox(): TSU.Geom.Rect;
  protected abstract updatePosition(x: null | number, y: null | number): [number | null, number | null];
  protected updateSize(w: null | number, h: null | number): [number | null, number | null] {
    // By default sizes CANNOT be updated unless overridden
    return [null, null];
  }

  resetBBox(): void {
    /*
    this.xChanged = true;
    this.yChanged = true;
    this.widthChanged = true;
    this.heightChanged = true;
    */
    this.needsLayout = true;
    this._bbox = null as unknown as TSU.Geom.Rect;
  }

  /**
   * Sets the x or y coordinate of this shape in coordinate system within its
   * parent.
   */
  setPosition(x: number | null, y: number | null): [number | null, number | null] {
    [x, y] = this.updatePosition(x, y);
    if (x != null) this.bbox.x = x;
    if (y != null) this.bbox.y = y;
    return [x, y];
  }

  /**
   * Sets the size of this shape in coordinate system within its
   * parent.
   */
  setSize(w: number | null, h: number | null): [number | null, number | null] {
    [w, h] = this.updateSize(w, h);
    if (w != null) this.bbox.width = w;
    if (h != null) this.bbox.height = h;
    return [w, h];
  }

  /**
   * Gets the bounding box of this shape in the coordinate system within
   * the parent.
   */
  get bbox(): TSU.Geom.Rect {
    if (!this._bbox) {
      this._bbox = this.refreshBBox().union(this.childrenBBox());
      // this.xChanged = this.yChanged = this.widthChanged = this.heightChanged = false;
    }
    return this._bbox;
  }

  /**
   * Called internally when x or y has changed and if any flags need to be updated
   * indicating a layout refresh.
   */
  protected boundsUpdated(x: number | null, y: number | null, w: number | null, h: number | null): void {
    if (x != null) {
      // this.xChanged = true;
      this.needsLayout = true;
      this.bbox.x = x;
    }
    if (y != null) {
      // this.yChanged = true;
      this.needsLayout = true;
      this.bbox.y = y;
    }
    if (w != null) {
      // this.widthChanged = true;
      this.needsLayout = true;
      this.bbox.width = w;
    }
    if (h != null) {
      // this.heightChanged = true;
      this.needsLayout = true;
      this.bbox.height = h;
    }
  }

  /**
   * Gets the x coordinate within the parent's coordinate system.
   */
  get x(): number {
    return this.bbox.x;
  }

  /**
   * Sets the x coordinate within the parent's coordinate system.
   */
  set x(x: number) {
    const [nx, ny] = this.updatePosition(x, null);
    this.boundsUpdated(nx, ny, null, null);
  }

  /**
   * Gets the y coordinate within the parent's coordinate system.
   */
  get y(): number {
    return this.bbox.y;
  }

  /**
   * Sets the y coordinate within the parent's coordinate system.
   */
  set y(y: number) {
    const [nx, ny] = this.updatePosition(null, y);
    this.boundsUpdated(nx, ny, null, null);
  }

  get width(): number {
    return this.bbox.width;
  }

  set width(w: number) {
    const [nw, nh] = this.updateSize(w, null);
    this.boundsUpdated(null, null, nw, nh);
  }

  get height(): number {
    return this.bbox.height;
  }

  set height(h: number) {
    const [nw, nh] = this.updateSize(null, h);
    this.boundsUpdated(null, null, nw, nh);
  }
}

export abstract class Embelishment extends Shape {
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

  protected updateSize(w: null | number, h: null | number): [number | null, number | null] {
    return [w, h];
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

  /**
   * Creates views needed for this AtomView.
   */
  abstract createElements(parent: SVGGraphicsElement): void;
  abstract refreshLayout(): void;
  abstract get minSize(): TSU.Geom.Size;

  /**
   * By default the glyph's bbox is our bbox.
   */
  protected refreshBBox(): TSU.Geom.Rect {
    return this.glyph.bbox;
  }

  protected updatePosition(x: null | number, y: null | number): [number | null, number | null] {
    return this.glyph.setPosition(x, y);
  }

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
