import * as TSU from "@panyam/tsutils";
import { ZERO, Atom, LeafAtom, Group } from "./core";

/**
 * Base class for all renderable objects.
 *
 * Shape caches properties like bounding boxes to improve performance,
 * since bounding box calculations can be expensive. This also allows
 * testing layouts and positioning without worrying about implementation details.
 */
export abstract class Shape {
  private static idCounter = 0;
  readonly shapeId: number = Shape.idCounter++;

  /**
   * Note that x and y coordinates are not always the x and y coordinates
   * of the bounding box.
   * E.g., a circle's x and y coordinates are its center point and not the
   * top left corner.
   * These "main" coordinates are referred to as control coordinates.
   */
  protected _x: number | null = null;
  protected _y: number | null = null;
  protected _width: number | null = null;
  protected _height: number | null = null;
  protected _bbox: TSU.Geom.Rect;
  protected _minSize: TSU.Geom.Size;
  protected parentShape: Shape | null = null;
  /** Child shapes contained within this shape */
  children: Shape[] = [];

  /**
   * Gets the bounding box of this shape.
   * Calculates it if it hasn't been calculated yet.
   */
  get bbox(): TSU.Geom.Rect {
    if (!this._bbox) {
      this._bbox = this.refreshBBox();
    }
    return this._bbox;
  }

  /**
   * Gets the minimum size of this shape.
   * This is usually the size of the bounding box.
   */
  get minSize(): TSU.Geom.Size {
    if (!this._minSize) {
      this._minSize = this.refreshMinSize();
    }
    return this._minSize;
  }

  /**
   * Refreshes the bounding box of this shape.
   * Called when the shape knows the bbox it is tracking cannot be trusted
   * and has to be refreshed by calling native methods.
   * @returns The refreshed bounding box
   */
  protected abstract refreshBBox(): TSU.Geom.Rect;

  /**
   * Refreshes the minimum size of this shape.
   * @returns The refreshed minimum size
   */
  protected abstract refreshMinSize(): TSU.Geom.Size;

  /**
   * Updates the bounds of this shape.
   * @param x New x coordinate, or null to keep current value
   * @param y New y coordinate, or null to keep current value
   * @param w New width, or null to keep current value
   * @param h New height, or null to keep current value
   * @returns The updated bounds values
   */
  protected abstract updateBounds(
    x: null | number,
    y: null | number,
    w: null | number,
    h: null | number,
  ): [number | null, number | null, number | null, number | null];

  /**
   * Invalidates the cached bounds of this shape.
   * Forces recalculation of bounding box and minimum size.
   */
  invalidateBounds(): void {
    this._minSize = null as unknown as TSU.Geom.Size;
    this._bbox = null as unknown as TSU.Geom.Rect;
  }

  /**
   * Sets the bounds of this shape.
   *
   * Note that null and NaN are valid values and mean the following:
   * - null: Don't change the value
   * - NaN: Set the value to null (use the bounding box's value)
   *
   * @param x New x coordinate, or null to keep current value
   * @param y New y coordinate, or null to keep current value
   * @param w New width, or null to keep current value
   * @param h New height, or null to keep current value
   * @param applyLayout Whether to apply layout immediately
   * @returns The updated bounds values
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
   * Checks if this shape has an explicit x coordinate.
   */
  get hasX(): boolean {
    return this._x != null && !isNaN(this._x);
  }

  /**
   * Checks if this shape has an explicit y coordinate.
   */
  get hasY(): boolean {
    return this._y != null && !isNaN(this._y);
  }

  /**
   * Checks if this shape has an explicit width.
   */
  get hasWidth(): boolean {
    return this._width != null && !isNaN(this._width);
  }

  /**
   * Checks if this shape has an explicit height.
   */
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

  /**
   * Gets the width of this shape.
   */
  get width(): number {
    if (this._width != null) return this._width;
    return 0; // this.bbox.width;
  }

  /**
   * Sets the width of this shape.
   */
  set width(w: number | null) {
    this.setBounds(null, null, w == null ? NaN : w, null);
  }

  /**
   * Gets the height of this shape.
   */
  get height(): number {
    if (this._height != null) return this._height;
    return 0; // this.bbox.height;
  }

  /**
   * Sets the height of this shape.
   */
  set height(h: number | null) {
    this.setBounds(null, null, null, h == null ? NaN : h);
  }

  /**
   * Refreshes the layout of this shape.
   * Called when bounds or other properties have changed to give the shape an
   * opportunity to layout its children. For shapes with no children this is a no-op.
   */
  refreshLayout(): void {
    // throw new Error("Implement this");
  }
}

/**
 * Represents an embellishment applied to a musical element.
 */
export abstract class Embelishment extends Shape {}

/**
 * A shape that wraps an SVG element.
 * ElementShape provides the base class for all shapes that are rendered as SVG elements.
 */
export class ElementShape<T extends SVGGraphicsElement = SVGGraphicsElement> extends Shape {
  /**
   * Creates a new ElementShape.
   * @param element The SVG element this shape wraps
   */
  constructor(public readonly element: T) {
    super();
  }

  /**
   * Refreshes the bounding box of this element.
   * @returns The refreshed bounding box
   */
  protected refreshBBox(): TSU.Geom.Rect {
    return TSU.DOM.svgBBox(this.element);
  }

  /**
   * Refreshes the minimum size of this element.
   * @returns The refreshed minimum size
   */
  protected refreshMinSize(): TSU.Geom.Size {
    return TSU.DOM.svgBBox(this.element);
  }

  /**
   * Updates the bounds of this element.
   * @param x New x coordinate, or null to keep current value
   * @param y New y coordinate, or null to keep current value
   * @param w New width, or null to keep current value
   * @param h New height, or null to keep current value
   * @returns The updated bounds values
   */
  protected updateBounds(
    x: null | number,
    y: null | number,
    w: null | number,
    h: null | number,
  ): [number | null, number | null, number | null, number | null] {
    return [x, y, w, h];
  }

  /**
   * Refreshes the layout of this element.
   * Updates the element's attributes based on the shape's properties.
   */
  refreshLayout(): void {
    if (this.hasX) this.element.setAttribute("x", "" + this._x);
    if (this.hasY) this.element.setAttribute("y", "" + this._y);
  }
}

/**
 * Base class for views that represent atoms in the notation.
 * AtomView provides the visual representation of an atom.
 */
export abstract class AtomView extends Shape {
  /** Nesting depth of this atom in the structure */
  depth = 0;
  /** Index of the role containing this atom */
  roleIndex = 0;

  // LayoutMetrics for the AtomView so all atomviews laid out on the
  // same baseline will show up aligned vertically
  /** Baseline position for vertical alignment */
  baseline: number;
  /** Ascent (space above baseline) */
  ascent: number;
  /** Descent (space below baseline) */
  descent: number;
  /** Height of capital letters */
  capHeight: number;
  /** Space between lines */
  leading: number;

  /**
   * Checks if this atom view represents a leaf atom.
   */
  abstract isLeaf(): boolean;

  abstract get totalDuration(): TSU.Num.Fraction;

  /**
   * Creates the SVG elements needed for this atom view.
   * @param parent The parent SVG element to attach to
   */
  abstract createElements(parent: SVGGraphicsElement): void;
}

/**
 * A view for leaf atoms (those that cannot contain other atoms).
 */
export abstract class LeafAtomView extends AtomView {
  /**
   * Creates a new LeafAtomView.
   * @param leafAtom The leaf atom this view represents
   */
  constructor(public leafAtom: LeafAtom) {
    super();
  }

  /**
   * Leaf atom views always return true for isLeaf().
   */
  isLeaf(): boolean {
    return true;
  }

  /**
   * Gets a unique identifier for this view based on the atom's UUID.
   */
  get viewId(): number {
    return this.leafAtom.uuid;
  }

  /**
   * Returns the total duration of the atom rendered by this view.
   */
  get totalDuration(): TSU.Num.Fraction {
    return this.leafAtom.duration;
  }
}

/**
 * A view for group atoms that contain multiple child atoms.
 */
export abstract class GroupView extends AtomView {
  /** Space between atoms in this group */
  protected atomSpacing: number;
  /** The SVG group element for this view */
  protected groupElement: SVGGElement;
  /** Views for the atoms in this group */
  protected atomViews: AtomView[] = [];
  private _embelishments: Embelishment[];
  /** Whether this group represents notes by default */
  defaultToNotes = true;
  /** Whether this view needs layout */
  needsLayout = true;
  /** Scale factor for this group */
  scaleFactor = 1.0;

  /**
   * Creates a new GroupView.
   * @param group The group atom this view represents
   * @param config Optional configuration object
   */
  constructor(
    public group: Group,
    config?: any,
  ) {
    super();
    this.atomSpacing = 5;
    this.setStyles(config || {});
  }

  /**
   * Returns the total duration of the group rendered by this view.
   */
  get totalDuration(): TSU.Num.Fraction {
    return this.group.totalChildDuration;
  }

  /**
   * Creates the SVG elements needed for this group view.
   * @param parent The parent SVG element to attach to
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
    this.invalidateBounds();
  }

  /**
   * Group views always return false for isLeaf().
   */
  isLeaf(): boolean {
    return false;
  }

  /**
   * Refreshes the bounding box of this group.
   * @returns The refreshed bounding box
   */
  protected refreshBBox(): TSU.Geom.Rect {
    return TSU.DOM.svgBBox(this.groupElement);
  }

  /**
   * Refreshes the minimum size of this group.
   * @returns The refreshed minimum size
   */
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

  /**
   * Creates an atom view for a specific atom.
   * @param atom The atom to create a view for
   * @returns The created atom view
   */
  abstract createAtomView(atom: Atom): AtomView;

  /**
   * Updates the bounds of this group.
   * @param x New x coordinate, or null to keep current value
   * @param y New y coordinate, or null to keep current value
   * @param w New width, or null to keep current value
   * @param h New height, or null to keep current value
   * @returns The updated bounds values
   */
  protected updateBounds(
    x: null | number,
    y: null | number,
    w: null | number,
    h: null | number,
  ): [number | null, number | null, number | null, number | null] {
    return [x, y, w, h];
  }

  /**
   * Refreshes the layout of this group.
   * Updates the position and size of the group and its child atoms.
   */
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

    if (true) {
      this.atomViews.forEach((av, index) => {
        av.setBounds(currX, currY, null, null, true);
        currX += this.atomSpacing + av.minSize.width;
      });
    } else {
      // currently this is disabled because "smaller" beats are not EXPANDED to what they could be
      // smart alignment based layout where X = F(offset)
      // we want an atom's X offset to be something like (atom.timeOffset / group.duration) * groupWidth
      const totalDur = this.group.totalChildDuration;
      let currTime = ZERO;
      this.atomViews.forEach((av, index) => {
        const newX = currTime.timesNum(this.minSize.width).divby(this.group.duration).floor;
        if (newX >= currX) {
          currX = newX;
        }
        av.setBounds(currX, currY, null, null, true);
        currX += this.atomSpacing + av.minSize.width;
        currTime = currTime.plus(av.totalDuration);
      });
    }
    this.invalidateBounds();
    for (const e of this.embelishments) e.refreshLayout();
    this.invalidateBounds();
  }

  /**
   * Gets the embellishments for this group.
   */
  get embelishments(): Embelishment[] {
    if (!this._embelishments) {
      this._embelishments = this.createEmbelishments();
    }
    return this._embelishments;
  }

  /**
   * Creates the embellishments for this group.
   * @returns An array of embellishments
   */
  protected createEmbelishments(): Embelishment[] {
    return [];
  }

  /**
   * Sets the styles for this group.
   * @param config Style configuration object
   */
  setStyles(config: any): void {
    if ("atomSpacing" in config) this.atomSpacing = config.atomSpacing;
    this.needsLayout = true;
  }
}
