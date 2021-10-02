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
  /**
   * Note that x and y coordinates are not always the x and y coordinates of the bounding box.
   * Eg a circle's x and y coordinates are its center point and not the top left corner
   * These "main" coordinates are referred as control coordinates.
   */
  protected _x: number | null = null;
  protected _y: number | null = null;
  protected _width: number | null = null;
  protected _height: number | null = null;
  // protected _bbox: TSU.Geom.Rect;
  protected _minSize: TSU.Geom.Size;
  protected parentShape: Shape | null = null;
  children: Shape[] = [];

  /**
   * Sizes can have a minimum size.
   * This is usually the size of the bounding box.
   */
  get minSize(): TSU.Geom.Size {
    if (!this._minSize) {
      this._minSize = this.refreshMinSize();
      // this.xChanged = this.yChanged = this.widthChanged = this.heightChanged = false;
    }
    return this._minSize;
  }

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
  /*
  protected childrenBBox(): TSU.Geom.Rect | null {
    let bbox: TSU.Geom.Rect | null = null;
    for (let i = this.children.length - 1; i >= 0; i--) {
      if (bbox == null) bbox = TSU.Geom.Rect.from(this.children[i].bbox);
      else bbox = bbox.union(this.children[i].bbox);
    }
    return bbox;
  }
 */

  /**
   * refreshBBox is called by the Shape when it knows the bbox it is tracking
   * cannot be trusted and has to be refreshed by calling native methods.
   */
  protected abstract refreshMinSize(): TSU.Geom.Size;
  // protected abstract refreshBBox(): TSU.Geom.Rect;
  protected abstract updateBounds(
    x: null | number,
    y: null | number,
    w: null | number,
    h: null | number,
  ): [number | null, number | null, number | null, number | null];

  resetMinSize(): void {
    this._minSize = null as unknown as TSU.Geom.Size;
  }
  /*
  resetBBox(): void {
    this._bbox = null as unknown as TSU.Geom.Rect;
  }
 */

  /**
   * Sets the x or y coordinate of this shape in coordinate system within its
   * parent.
   *
   * Note that null and NaN are valid values and mean the following:
   * null - Dont change the value.  Passed to "ignore" effects.
   * NaN - Ensure the value is set to null so that the bounding box specific coord is used going forward.
   */
  setBounds(
    x: number | null,
    y: number | null,
    w: number | null,
    h: number | null,
    applyLayout = false,
  ): [number | null, number | null, number | null, number | null] {
    if (x != null) {
      if (isNaN(x)) {
        this._x = null;
      } else {
        this._x = x;
      }
    }
    if (y != null) {
      if (isNaN(y)) {
        this._y = null;
      } else {
        this._y = y;
      }
    }
    if (w != null) {
      if (isNaN(w)) {
        this._width = null;
      } else {
        this._width = w;
      }
    }
    if (h != null) {
      if (isNaN(h)) {
        this._height = null;
      } else {
        this._height = h;
      }
    }
    const [nx, ny, nw, nh] = this.updateBounds(x, y, w, h);
    if (nx != null) {
      if (isNaN(nx)) {
        this._x = null;
      } else {
        this._x = nx;
      }
    }
    if (ny != null) {
      if (isNaN(ny)) {
        this._y = null;
      } else {
        this._y = ny;
      }
    }
    if (nw != null) {
      if (isNaN(nw)) {
        this._width = null;
      } else {
        this._width = nw;
      }
    }
    if (nh != null) {
      if (isNaN(nh)) {
        this._height = null;
      } else {
        this._height = nh;
      }
    }
    if (applyLayout) this.refreshLayout();
    // this.resetBBox();
    return [nx, ny, nw, nh];
  }

  /**
   * Gets the bounding box of this shape in the coordinate system within
   * the parent.
   */
  /*
  protected get bbox2(): TSU.Geom.Rect {
    if (!this._bbox) {
      this._bbox = this.refreshBBox().union(this.childrenBBox());
      // this.xChanged = this.yChanged = this.widthChanged = this.heightChanged = false;
    }
    return this._bbox;
  }
 */

  get hasX(): boolean {
    return this._x != null && !isNaN(this._x);
  }

  get hasY(): boolean {
    return this._y != null && !isNaN(this._y);
  }

  get hasWidth(): boolean {
    return this._width != null && !isNaN(this._width);
  }

  get hasHeight(): boolean {
    return this._height != null && !isNaN(this._height);
  }

  /**
   * Gets the x coordinate within the parent's coordinate system.
   */
  get x(): number {
    return this._x || 0;
  }

  /**
   * Sets the x coordinate within the parent's coordinate system.
   */
  set x(x: number | null) {
    // Here a manual x is being set - how does this interfere with the bounding box?
    // We should _x to the new value to indicate a manual value was set.
    // and reset bbox so that based on this x a new bbox may need to be calculated
    this.setBounds(x == null ? NaN : x, null, null, null);
  }

  /**
   * Gets the y coordinate within the parent's coordinate system.
   */
  get y(): number {
    if (this._y != null) return this._y;
    return 0; // this.bbox.y;
  }

  /**
   * Sets the y coordinate within the parent's coordinate system.
   */
  set y(y: number | null) {
    this.setBounds(null, y == null ? NaN : y, null, null);
  }

  get width(): number {
    if (this._width != null) return this._width;
    return 0; // this.bbox.width;
  }

  set width(w: number | null) {
    this.setBounds(null, null, w == null ? NaN : w, null);
  }

  get height(): number {
    if (this._height != null) return this._height;
    return 0; // this.bbox.height;
  }

  set height(h: number | null) {
    this.setBounds(null, null, null, h == null ? NaN : h);
  }

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

  protected refreshMinSize(): TSU.Geom.Size {
    return TSU.DOM.svgBBox(this.element);
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
    if (this.hasX) this.element.setAttribute("x", "" + this._x);
    if (this.hasY) this.element.setAttribute("y", "" + this._y);
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

  /**
   * By default the glyph's bbox is our bbox.
   */
  protected refreshMinSize(): TSU.Geom.Size {
    return this.glyph.minSize;
  }

  protected updateBounds(
    x: null | number,
    y: null | number,
    w: null | number,
    h: null | number,
  ): [number | null, number | null, number | null, number | null] {
    return this.glyph.setBounds(x, y, w, h);
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
