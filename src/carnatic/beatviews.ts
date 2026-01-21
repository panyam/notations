import * as TSU from "@panyam/tsutils";
import { Embelishment } from "../shapes";
import { GridCell, GridCellView } from "../grids";
import { ElementShape } from "../shapes";
import { createAtomView } from "./atomviews";
import { Marker } from "../core";
import { Beat } from "../beats";
import { BeatView as BeatViewBase } from "../beatview";
import { BeatStartLines, BeatEndLines } from "./embelishments";

export class MarkerView extends ElementShape<SVGGElement> implements GridCellView {
  needsLayout = true;
  rootGroup: SVGGElement;
  textElement: SVGTextElement;
  constructor(
    public readonly cell: GridCell,
    public readonly beat: Beat,
    public readonly markers: Marker[],
    public readonly isPreMarker: boolean,
    public readonly rootElement: SVGGraphicsElement,
    config?: any,
  ) {
    const rootGroup = TSU.DOM.createSVGNode("g", {
      parent: rootElement,
      attrs: {
        class: "markerView",
        pre: isPreMarker,
        roleName: beat.role.name,
        beatIndex: "" + beat.index,
        gridRow: cell.rowIndex,
        gridCol: cell.colIndex,
      },
    });
    super(rootGroup);
    this.rootGroup = rootGroup as SVGGElement;
    this.textElement = TSU.DOM.createSVGNode("text", {
      parent: rootGroup,
      attrs: {
        class: "markerText",
        pre: isPreMarker,
        dx: isPreMarker ? 0 : 15,
      },
      text: this.markers[0].text,
    });
  }

  protected refreshMinSize(): TSU.Geom.Size {
    const ts = TSU.DOM.svgBBox(this.textElement);
    const totalWidth = ts.width;
    const maxHeight = ts.height;
    return new TSU.Geom.Size(totalWidth + 5, maxHeight + 5);
  }

  refreshLayout(): void {
    // TODO - move this code out to refreshLayout?
    // set the glyphs Y first so we can layout others
    this.rootGroup.setAttribute("transform", "translate(" + this.x + "," + this.y + ")");
  }

  protected updateBounds(
    x: null | number,
    y: null | number,
    w: null | number,
    h: null | number,
  ): [number | null, number | null, number | null, number | null] {
    return [x, y, NaN, NaN];
  }
}

export class BeatView extends BeatViewBase {
  createAtomView() {
    // Use contentAtom to exclude markers (they're rendered in separate pre/post columns)
    const atom = this.beat.contentAtom;
    if (!atom) return null;
    return createAtomView(this.element, atom, this.beat.role.defaultToNotes);
  }

  /**
   * Refreshes the layout of this beat view.
   *
   * This method propagates the column width from the grid layout system to
   * the atomView, enabling duration-based positioning within beats to use
   * consistent widths across the entire column.
   *
   * ### Width Propagation Flow:
   * ```
   * ColAlign.setOffset() → BeatView.setBounds(width) → atomView.setBounds(width)
   *                                                  → atomView.refreshLayout()
   * ```
   *
   * This ensures that atoms within different beats of the same column are
   * aligned based on their time offset, creating a visually consistent grid.
   */
  refreshLayout(): void {
    const newX = this.hasX ? this._x : 0;
    const newY = this.hasY ? this._y : 0;
    this.element.setAttribute("transform", "translate(" + newX + "," + newY + ")");

    // Propagate column width to atomView for duration-based layout
    // This enables global alignment across beats in the same column
    // atomView may be null if beat contains only markers
    if (this.hasWidth && this.atomView) {
      this.atomView.setBounds(0, 0, this.width, null, false);
      this.atomView.refreshLayout();
    }

    this.invalidateBounds();
    for (const e of this.embelishments) e.refreshLayout();
    this.invalidateBounds();
  }

  protected createEmbelishments(): Embelishment[] {
    let embelishments: Embelishment[] = [];
    const beat = this.beat;
    // TODO - Should this be the group's parent element?
    const rootElement = this.rootElement;
    if (beat.beatIndex == 0 && beat.barIndex == 0 && beat.instance == 0) {
      // first beat in bar - Do a BarStart
      const emb = new BeatStartLines(this, rootElement);
      embelishments = [emb];
    } else {
      const cycle = this.cycle;
      const bar = cycle.bars[beat.barIndex];
      if (beat.beatIndex == bar.beatCount - 1) {
        // It is important that we are not just looking at the last beat of the bar
        // but also in the last "instance" of the beat in this bar to account for
        // kalais
        if (beat.instance == bar.instanceCount(beat.beatIndex) - 1) {
          if (beat.barIndex == cycle.bars.length - 1) {
            // last beat in last bar so - do a thalam end (2 lines)
            const emb = new BeatEndLines(this, rootElement, 2);
            embelishments = [emb];
          } else {
            // end of a bar so single line end
            const emb = new BeatEndLines(this, rootElement);
            embelishments = [emb];
          }
        }
      }
    }
    return embelishments;
  }
}
