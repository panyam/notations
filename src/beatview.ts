import * as TSU from "@panyam/tsutils";
import { AtomView, Embelishment, ElementShape } from "./shapes";
import { GridCell, GridCellView } from "./grids";
import { Cycle } from "./cycle";
import { Beat } from "./beats";

export abstract class BeatView extends ElementShape<SVGGElement> implements GridCellView {
  private _embelishments: Embelishment[];
  atomView: AtomView;
  needsLayout = true;
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

  get embelishments(): Embelishment[] {
    if (!this._embelishments) {
      this._embelishments = this.createEmbelishments();
    }
    return this._embelishments;
  }

  setStyles(config: any): void {
    this.needsLayout = true;
  }

  protected abstract createEmbelishments(): Embelishment[];
  protected abstract createAtomView(): AtomView;
}
