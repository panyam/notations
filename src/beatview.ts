import * as TSU from "@panyam/tsutils";
import { AtomView, Embelishment, ElementShape } from "./shapes";
import { GridCell, GridCellView } from "./grids";
import { Cycle } from "./cycle";
import { Beat } from "./beats";

/**
 * Abstract base class for views that represent beats in the notation.
 * BeatView provides the visual representation of a beat and implements the GridCellView
 * interface to support placement in a grid.
 */
export abstract class BeatView extends ElementShape<SVGGElement> implements GridCellView {
  /** Embellishments applied to this beat view */
  private _embelishments: Embelishment[];
  
  /** View for the atom contained in this beat */
  atomView: AtomView;
  
  /** Whether this view needs layout */
  needsLayout = true;
  
  /**
   * Creates a new BeatView.
   * @param cell The grid cell this beat view belongs to
   * @param beat The beat this view represents
   * @param rootElement The root SVG element to attach to
   * @param cycle The cycle this beat belongs to
   * @param config Optional configuration object
   */
  constructor(
    public readonly cell: GridCell,
    public readonly beat: Beat,
    public readonly rootElement: SVGGraphicsElement,
    public readonly cycle: Cycle,
    config?: any,
  ) {
    super(
      TSU.DOM.createSVGNode("g", {
        parent: rootElement,
        attrs: {
          class: `beatView role_${beat.role.name}`,
          beatId: "" + beat.uuid,
          id: "" + beat.uuid,
          roleName: beat.role.name,
          beatIndex: "" + beat.index,
          gridRow: cell.rowIndex,
          gridCol: cell.colIndex,
        },
      }),
    );
    this.atomView = this.createAtomView();
    this.atomView.refreshLayout();
  }

  /**
   * Gets the embellishments for this beat view.
   */
  get embelishments(): Embelishment[] {
    if (!this._embelishments) {
      this._embelishments = this.createEmbelishments();
    }
    return this._embelishments;
  }

  /**
   * Sets the styles for this beat view.
   * @param config Style configuration object
   */
  setStyles(config: any): void {
    this.needsLayout = true;
  }

  /**
   * Creates the embellishments for this beat view.
   * @returns An array of embellishments
   */
  protected abstract createEmbelishments(): Embelishment[];
  
  /**
   * Creates the atom view for this beat view.
   * @returns The created atom view
   */
  protected abstract createAtomView(): AtomView;
}
