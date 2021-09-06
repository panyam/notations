import * as TSU from "@panyam/tsutils";
import * as TSV from "@panyam/tsutils-ui";
import { LayoutParams, Beat, BeatsBuilder, FlatAtom, Role, Atom } from "notations";

export interface Embelishment {
  refreshLayout(): void;
}

export interface TimedView {
  readonly viewId: number;
  x: number;
  readonly bbox: TSV.BBox;
}

export abstract class AtomView implements TimedView {
  element: SVGGraphicsElement;
  depth = 0;
  roleIndex = 0;

  constructor(public flatAtom: FlatAtom) {}

  abstract createElements(parent: SVGGraphicsElement): void;
  refreshLayout(): void {}
  // get embelishments(): Embelishment[] { return []; }

  xChanged = true;
  yChanged = true;
  widthChanged = true;
  heightChanged = true;
  protected _bbox: SVGRect;

  get viewId(): number {
    return this.flatAtom.uuid;
  }

  refreshBBox(): SVGRect {
    this._bbox = this.element.getBBox();
    // Due to safari bug which returns really crazy span widths!
    if (TSU.Browser.IS_SAFARI()) {
      const clientRect = this.element.getClientRects()[0];
      if (clientRect) {
        const parentClientRect = this.element.parentElement?.getBoundingClientRect();
        this._bbox.x = this._bbox.x + clientRect.x - (parentClientRect?.x || 0);
        // this._bbox.y = clientRect.y; //  - (parentClientRect?.y || 0);
        this._bbox.width = clientRect.width;
        this._bbox.height = clientRect.height;
      }
    }
    this.xChanged = this.yChanged = this.widthChanged = this.heightChanged = false;
    return this._bbox;
  }

  get bbox(): SVGRect {
    if (!this._bbox) {
      this.refreshBBox();
    }
    return this._bbox;
  }

  get x(): number {
    return this.bbox.x;
  }

  set x(x: number) {
    // remove the dx attribute
    this.element.removeAttribute("dx");
    this.element.setAttribute("x", "" + x);
    this.bbox.x = x;
  }

  get y(): number {
    return this.bbox.y;
  }

  set y(y: number) {
    this.element.setAttribute("y", "" + y);
    this.bbox.y = y;
    this.element.removeAttribute("dy");
  }

  get width(): number {
    return this.bbox.width;
  }

  get height(): number {
    return this.bbox.height;
  }

  set dx(dx: number) {
    this.element.removeAttribute("x");
    if (dx == 0) {
      this.element.removeAttribute("dx");
    } else {
      this.element.setAttribute("dx", "" + dx);
    }
    this.xChanged = true;
    this._bbox = null as unknown as SVGRect;
  }

  set dy(dy: number) {
    this.element.setAttribute("dy", "" + dy);
    this.yChanged = true;
    this._bbox = null as unknown as SVGRect;
    this.element.removeAttribute("y");
  }

  get size(): TSV.Size {
    const bbox = this.bbox;
    return new TSV.Size(bbox.width, bbox.height);
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
