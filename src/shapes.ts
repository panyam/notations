import * as TSU from "@panyam/tsutils";
import { Atom, LeafAtom, Group } from "./core";

/**
 * Base class of all renderable objects for caching things like bounding boxes etc.
 * We do this since a lot of the property setters dont change bounding boxes but
 * bounding box reads are a bit slow in general.  This also allows us to test
 * layouts, positioning etc without having to worry about implementation details.
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
   * refreshBBox is called by the Shape when it knows the bbox it is tracking
   * cannot be trusted and has to be refreshed by calling native methods.
   */
  protected abstract refreshMinSize(): TSU.Geom.Size;
  protected abstract updateBounds(
    x: null | number,
    y: null | number,
    w: null | number,
    h: null | number,
  ): [number | null, number | null, number | null, number | null];

  resetMinSize(): void {
    this._minSize = null as unknown as TSU.Geom.Size;
  }

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

export class ElementShape<T extends SVGGraphicsElement = SVGGraphicsElement> extends Shape {
  constructor(public readonly element: T) {
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
  depth = 0;
  roleIndex = 0;

  // LayoutMetrics for the AtomView so all atomviews laid out on the
  // same baseline will show up aligned vertically
  baseline: number;
  ascent: number;
  descent: number;
  capHeight: number;
  leading: number;

  abstract isLeaf(): boolean;

  /**
   * Creates views needed for this AtomView.
   */
  abstract createElements(parent: SVGGraphicsElement): void;
}

export abstract class LeafAtomView extends AtomView {
  constructor(public leafAtom: LeafAtom) {
    super();
  }

  isLeaf(): boolean {
    return true;
  }

  get viewId(): number {
    return this.leafAtom.uuid;
  }

  /*
  embRoot(): SVGGraphicsElement {
    let rootElem = this.glyph.element.parentElement as any as SVGGraphicsElement;
    while (rootElem && (rootElem.tagName == "tspan" || rootElem.tagName == "text")) {
      rootElem = rootElem.parentElement as any as SVGGraphicsElement;
    }
    return rootElem;
  }
  */
}

/**
 * An GroupView that contains a collection of AtomViews.
 */
export abstract class GroupView extends AtomView {
  protected atomSpacing: number;
  protected groupElement: SVGGElement;
  protected atomViews: AtomView[] = [];
  private _embelishments: Embelishment[];
  defaultToNotes = true;
  needsLayout = true;
  scaleFactor = 1.0;
  constructor(public group: Group, config?: any) {
    super();
    this.atomSpacing = 5;
    this.setStyles(config || {});
  }

  /**
   * Creates views needed for this AtomView.
   */
  createElements(parent: SVGGraphicsElement): void {
    this.groupElement = TSU.DOM.createSVGNode("g", {
      parent: parent,
      attrs: {
        class: "groupViewRoot",
        id: "groupViewRoot" + this.group.uuid,
      },
    });

    // now create child atom views for each atom in this Group
    for (const atom of this.group.atoms.values()) {
      const atomView = this.createAtomView(atom);
      this.atomViews.push(atomView);
    }
    this.resetMinSize();
  }

  isLeaf(): boolean {
    return false;
  }

  protected refreshMinSize(): TSU.Geom.Size {
    let totalWidth = 0;
    let maxHeight = 0;
    this.atomViews.forEach((av, index) => {
      const ms = av.minSize;
      totalWidth += ms.width + this.atomSpacing;
      maxHeight = Math.max(maxHeight, ms.height);
    });
    return new TSU.Geom.Size(totalWidth * this.scaleFactor, maxHeight * this.scaleFactor);
  }

  abstract createAtomView(atom: Atom): AtomView;

  protected updateBounds(
    x: null | number,
    y: null | number,
    w: null | number,
    h: null | number,
  ): [number | null, number | null, number | null, number | null] {
    return [x, y, w, h];
  }

  refreshLayout(): void {
    let transform = "translate(" + this.x + "," + this.y + ")";
    if (this.scaleFactor < 1) {
      transform += " scale(" + this.scaleFactor + ")";
    }
    this.groupElement.setAttribute("transform", transform);
    // if (this.widthChanged) {
    // All our atoms have to be laid out between startX and endX
    // old way of doing where we just set dx between atom views
    // this worked when atomviews were single glyphs. But
    // as atomViews can be complex (eg with accents and pre/post
    // spaces etc) explicitly setting x/y may be important
    let currX = 0;
    const currY = 0; // null; // this.y; //  + 10;
    this.atomViews.forEach((av, index) => {
      av.setBounds(currX, currY, null, null, true);
      currX += this.atomSpacing + av.minSize.width;
    });
    this.resetMinSize();
    for (const e of this.embelishments) e.refreshLayout();
    this.resetMinSize();
  }

  get embelishments(): Embelishment[] {
    if (!this._embelishments) {
      this._embelishments = this.createEmbelishments();
    }
    return this._embelishments;
  }

  protected createEmbelishments(): Embelishment[] {
    return [];
  }

  setStyles(config: any): void {
    if ("atomSpacing" in config) this.atomSpacing = config.atomSpacing;
    this.needsLayout = true;
  }
}
