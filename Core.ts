import * as TSU from "@panyam/tsutils";
import { LayoutParams, Beat, BeatsBuilder, FlatAtom, Role, Atom } from "notations";

export enum EmbelishmentDir {
  LEFT,
  TOP,
  RIGHT,
  BOTTOM,
}

export abstract class Shape {
  private static idCounter = 0;
  readonly shapeId: number = Shape.idCounter++;
  xChanged = true;
  yChanged = true;
  widthChanged = true;
  heightChanged = true;
  protected _bbox: TSU.Geom.Rect;

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

  protected xyUpdated(x: number | null, y: number | null): void {
    if (x != null) {
      this.xChanged = true;
      this.bbox.x = x;
    }
    if (y != null) {
      this.yChanged = true;
      this.bbox.y = y;
    }
  }

  get x(): number {
    return this.bbox.x;
  }

  set x(x: number) {
    // if (x != this.bbox.x) {
    const [nx, ny] = this.updatePosition(x, null);
    this.xyUpdated(nx, ny);
    // }
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
}

export abstract class Embelishment extends Shape {
  refreshLayout(): void {
    // throw new Error("Implement this");
  }
}

export interface TimedView {
  x: number;
  readonly bbox: TSU.Geom.BBox;
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
}

export abstract class AtomView extends Shape implements TimedView {
  glyph: ElementShape;
  depth = 0;
  roleIndex = 0;

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

/**
 * Delegate interface ensuring layout of timed entities in a LineView.
 *
 * Laying out the notes in a temporal manner is an important step in rendering
 * music.  Our challenge is given a set of lines, roles and atoms (in that
 * hierarchy) we need the atoms to align based on "some" rules.  Since we dont
 * know what the right rules are we want some flexibility in playing with this.
 *
 * Initially the LineView had all the rules built in via the layoutAtoms method.
 * This was not bad and ensured that within a Line all roles were aligned.
 * But global alignment in a page was not possible if we had multiple lines in
 * a section (or say different sangathis of the same line) then even though
 * swaras and sahithya are aligned within a line, they could go out of whack
 * across lines.  And aesthetically it is desirable to align notes across a
 * group of lines.
 *
 * The second problem is that there coule be different layout algorithms we
 * want to try.  eg should all notes in a group be aligned to the same "x"
 * value if they are in the same offset?   Do we only care that beats are
 * aligned?  Having an interface with different implementations make this
 * experimentable.
 *
 * The third criteria is to have reactability.  For example as views are added,
 * deleted, updated layouts need to be recomputed.  Having to handle layout
 * changes as well as extensions in a single place becomes very unweildy soon.
 * This layout delegate concept makes this easier to manage as it has access
 * to all views it oversees.
 *
 * The fourth problem this delegate solves is managing and cascading changes
 * to embelishments.  Embelishments (or decorators) are views that depend
 * on the location of one or more dependent views.  Eg octave indicators,
 * bar separator lines, "slur indicators" and so on.
 *
 * It is getting apparent that AtomLayout delegates serve the role of a
 * declarative constraint collector.
 */
export interface AtomViewProvider {
  createAtomView(beat: Beat, flatAtom: FlatAtom, beforeAtom: null | FlatAtom): AtomView;
  rootElementForBeat(beat: Beat): SVGGraphicsElement;
}

export abstract class AtomLayout {
  private layoutLine: number;
  // embelishments: Embelishment[] = [];
  constructor(public readonly layoutParams: LayoutParams, public readonly atomViewProvider: AtomViewProvider) {}

  protected abstract addAtomView(atomView: AtomView, beat: Beat): void;

  /*
  refreshEmbelishments(): void {
    console.log("# Embelishments: ", this.embelishments.length);
    this.embelishments.forEach((emb) => emb.refreshLayout());
  }
  */

  /**
   * Called when more atoms for a particular line are added
   * This ensures that the atoms are broken down appropriately
   * into flatatoms and their respective AtomViews are created.
   */
  addAtoms(role: Role, ...atoms: Atom[]): void {
    //
    // We need to continue for some set of "beats"
    const builder = this.getBeatsBuilder(role);
    builder.addAtoms(...atoms);
  }

  /**
   * Get the Role by a given name in a given Line.
   */
  protected beatsBuilders = new Map<number, BeatsBuilder>();
  getBeatsBuilder(role: Role): BeatsBuilder {
    let builder = this.beatsBuilders.get(role.uuid) || null;
    if (builder == null) {
      builder = this.createBeatsBuilder(role);
      this.beatsBuilders.set(role.uuid, builder);
    }
    return builder;
  }

  protected createBeatsBuilder(role: Role): BeatsBuilder {
    return new BeatsBuilder(role, this.layoutParams);
  }
}
