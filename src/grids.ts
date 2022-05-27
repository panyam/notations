import * as TSU from "@panyam/tsutils";
import * as kiwi from "@lume/kiwi";

/**
 * A generic way to host child views in a grid (very similar to gridbag layout)
 * This allows us to have a framework for hosting BeatViews instead of mucking
 * about with beat rows and beat columns etc.
 *
 * Grid "cells" can be referred by cell indexes.  Additionally we want our grid
 * rows and columns to have names (like in Spreadsheets) so that even when rows
 * and columns are inserted, though indexes may change, the "addresses" will
 * be fixed and immovable.  This helps us do things like insert a new new column
 * (say for markers) and not have to worry other columns index changes impacting
 * us.
 */
export class GridView {
  private _lastUpdatedAt = 0;
  private _lastSyncedAt = -1;
  // cells = new SparseArray<SparseArray<GridCell>>();
  rows: GridRow[] = [];
  getCellView: (value: any) => GridCellView;
  removeCellView: (cell: GridCellView) => void;

  debugValue() {
    const out = {
      rows: this.rows.map((r) => r.debugValue()),
      lastUpdatedAt: this.lastUpdatedAt,
      lastSyncedAt: this.lastSyncedAt,
    } as any;
    if (Object.keys(this.events).length > 0) {
      out["events"] = this.events;
    }
    return out;
  }

  get lastSyncedAt() {
    return this._lastSyncedAt;
  }

  get lastUpdatedAt() {
    return this._lastUpdatedAt;
  }

  setUpdatedAt(val: number) {
    this._lastUpdatedAt = val;
  }

  addRows(insertBefore = -1, numRows = 1): GridRow[] {
    if (insertBefore < 0) {
      insertBefore = this.rows.length;
    }
    const out = [];
    for (let i = 0; i < numRows; i++) {
      const newRow = new GridRow(this, insertBefore + i);
      out.push(newRow);
      if (i > 0) {
        // set the success nodes
        out[i - 1].defaultRowAlign.addSuccessor(out[i].defaultRowAlign);
      }
    }
    this.rows.splice(insertBefore, 0, ...out);
    // connect first "new" row to its predecessor
    if (insertBefore > 0 && this.rows.length > 0) {
      this.rows[insertBefore - 1].defaultRowAlign.addSuccessor(out[0].defaultRowAlign);
    }
    // connect last "new" row to its successor
    if (insertBefore < this.rows.length) {
      out[out.length - 1].defaultRowAlign.addSuccessor(this.rows[insertBefore].defaultRowAlign);
    }
    for (let i = insertBefore + numRows; i < this.rows.length; i++) {
      this.rows[i].rowIndex += numRows;
    }
    return out;
  }

  getRow(row: number): GridRow {
    if (row >= this.rows.length) {
      this.addRows(-1, 1 + row - this.rows.length);
    }
    return this.rows[row];
  }

  setValue(row: number, col: number, value: any, cellCreator?: () => GridCell): any {
    const grow = this.getRow(row);
    if (!cellCreator) {
      cellCreator = () => {
        return new GridCell(grow, col);
      };
    }
    if (value == null) {
      const out = grow.clearCellAt(col);
      if (out != null) {
        this.setCellCleared(out);
      }
      return out;
    } else {
      const cell = grow.cellAt(col, cellCreator) as GridCell;
      const oldValue = cell.value;
      this.setCellUpdated(cell);
      cell.value = value;
      return oldValue;
    }
  }

  /**
   * Mark a cell as updated in this iteration so only these can
   * be used in the calculation of layout changes.
   */
  events = [] as any[];
  setCellCleared(cell: GridCell) {
    this.events.push(["cleared", cell.location]);
  }

  setCellUpdated(cell: GridCell) {
    this.events.push(["updated", cell.location, cell.value]);
  }

  /**
   * As the grid model changes (cell content changed, cleared etc) we need
   * to refresh our layout based on this.
   * As a first step the new height and width of all changed cells is evaluted
   * to see which rows and/or columns are affected (and need to be
   * resized/repositioned).
   */
  applyChanges(): void {
    // go through events here and route them to the right row and column

    // Step 1 - topologically sort RowAligns of changed cells
    // Step 2 - topologically sort ColAligns of changed cells
    // Step 3 -
    const cellVisited = {} as any;
    const changedRowAligns = {} as any;
    const changedColAligns = {} as any;
    // Going in reverse means we only get the latest event affecting a cell
    // instead of going through every change.
    // Later on we can revisit this if the events are edge triggered instead
    // of level triggered
    for (let i = this.events.length - 1; i >= 0; i--) {
      const event = this.events[i];
      const loc = event[1];
      if (cellVisited[loc]) continue;
      cellVisited[loc] = true;
      const [row, col] = loc.split(",").map((x: string) => parseInt(x));
      const cell = this.getRow(row).cellAt(col);
      if (cell) {
        // TODO - For now we are marking both row and col as having
        // changed for a cell.  We can optimize this to only row or
        // col based on whether height or width has changed.
        if (!(cell.rowAlign.uuid in changedRowAligns)) {
          changedRowAligns[cell.rowAlign.uuid] = {
            align: cell.rowAlign,
            cells: [],
          };
        }
        changedRowAligns[cell.rowAlign.uuid]["cells"].push(cell);

        if (!(cell.colAlign.uuid in changedColAligns)) {
          changedColAligns[cell.colAlign.uuid] = {
            align: cell.colAlign,
            cells: [],
          };
        }
        changedColAligns[cell.colAlign.uuid]["cells"].push(cell);
      }
    }

    // Eval max height for all changed rowAligns
    for (const rowAlignId in changedRowAligns) {
      const val = changedRowAligns[rowAlignId];
      val.align.evalMaxHeight(val.cells);
    }

    // Eval max cols for all changed colAligns
    for (const colAlignId in changedColAligns) {
      const val = changedColAligns[colAlignId];
      val.align.evalMaxWidth(val.cells);
    }

    // 1. start from the starting lines and do a BF traversal
    // 2. If a line not visited (ie laid out):
    //      if it is in the changedAlign list then reval its length (w/h)
    //      set its offset and length if either width or offset has changed
    //      offset can be thought of changed if the preceding line's offset has changed
    // first do above for rows
    let rowQueue = [] as [null | RowAlign, RowAlign][];
    const startingRows = this.startingRows;
    const visitedRows = {} as any;
    for (const row of startingRows) rowQueue.push([null, row]);
    const rowOffsetChanged = {} as any;
    while (rowQueue.length > 0) {
      const nextQueue = [] as [null | RowAlign, RowAlign][];
      for (let i = 0; i < rowQueue.length; i++) {
        const [prevRowAlign, rowAlign] = rowQueue[i];
        let newY = rowAlign.coordOffset;
        let rowChanged = rowAlign.uuid in changedRowAligns;
        if (prevRowAlign) {
          if (rowOffsetChanged[prevRowAlign.uuid]) {
            newY = prevRowAlign.coordOffset + prevRowAlign.maxLength;
            rowChanged = true;
          }
        }
        if (rowChanged) {
          rowAlign.setY(newY);
        }

        // Add next neighbors now
        for (const next of rowAlign.nextLines) {
          if (!visitedRows[next.uuid]) {
            visitedRows[next.uuid] = true;
            nextQueue.push([rowAlign, next]);
          }
        }
      }
      rowQueue = nextQueue;
    }

    // Repeat all this with columns
    let colQueue = [] as [null | ColAlign, ColAlign][];
    const startingCols = this.startingCols;
    const visitedCols = {} as any;
    for (const col of startingCols) colQueue.push([null, col]);
    const colOffsetChanged = {} as any;
    while (colQueue.length > 0) {
      const nextQueue = [] as [null | ColAlign, ColAlign][];
      for (let i = 0; i < colQueue.length; i++) {
        const [prevColAlign, colAlign] = colQueue[i];
        let newX = colAlign.coordOffset;
        let colChanged = colAlign.uuid in changedColAligns;
        if (prevColAlign) {
          if (colOffsetChanged[prevColAlign.uuid]) {
            newX = prevColAlign.coordOffset + prevColAlign.maxLength;
            colChanged = true;
          }
        }
        if (colChanged) {
          colAlign.setX(newX);
        }

        // Add next neighbors now
        for (const next of colAlign.nextLines) {
          if (!visitedCols[next.uuid]) {
            visitedCols[next.uuid] = true;
            nextQueue.push([colAlign, next]);
          }
        }
      }
      colQueue = nextQueue;
    }
    this._lastSyncedAt = this._lastUpdatedAt;
    this.events = [];
  }

  get startingRows(): RowAlign[] {
    const out = [] as RowAlign[];
    const firstRow = this.getRow(0);
    const visited = {} as any;
    for (let i = 0; i < firstRow.numCols; i++) {
      const cell = firstRow.cellAt(i);
      if (cell && !visited[cell.rowAlign.uuid]) {
        visited[cell.rowAlign.uuid] = true;
        out.push(cell.rowAlign);
      }
    }
    return out;
  }

  get startingCols(): ColAlign[] {
    const out = [] as ColAlign[];
    const visited = {} as any;
    for (let i = 0; i < this.rows.length; i++) {
      const cell = this.getRow(i).cellAt(0);
      if (cell && !visited[cell.colAlign.uuid]) {
        visited[cell.colAlign.uuid] = true;
        out.push(cell.colAlign);
      }
    }
    return out;
  }
}

export interface GridCellView {
  x: number;
  y: number;
  width: number;
  height: number;
  readonly needsLayout: boolean;
  readonly minSize: TSU.Geom.Size;
  readonly bbox: TSU.Geom.Rect;
}

export enum GridCellEvent {
  ADDED,
  REMOVED,
  UPDATED,
  MOVED,
}

/**
 * Interface for a view for a given cell in the grid.
 */
export class GridCell {
  private static idCounter = 0;
  readonly uuid = GridCell.idCounter++;
  private _rowAlign: RowAlign;
  private _colAlign: ColAlign;
  cellView: GridCellView | null;

  // Variables that will be "solved for"
  varCellX = new kiwi.Variable();
  varCellY = new kiwi.Variable();
  varCellWidth = new kiwi.Variable();
  varCellHeight = new kiwi.Variable();

  constructor(public gridRow: GridRow, public colIndex: number, public value: any = null) {
    this.rowAlign = gridRow.defaultRowAlign;
  }

  get colAlign() {
    return this._colAlign;
  }

  set colAlign(aCol: ColAlign) {
    aCol.addCell(this);
    this._colAlign = aCol;
  }

  get rowAlign() {
    return this._rowAlign;
  }

  set rowAlign(aRow: RowAlign) {
    aRow.addCell(this);
    this._rowAlign = aRow;
  }

  get location(): string {
    return this.gridRow.rowIndex + ":" + this.colIndex;
  }

  get grid(): GridView {
    return this.gridRow.grid;
  }

  get row(): number {
    return this.gridRow.rowIndex;
  }

  debugValue() {
    const out = {
      r: this.gridRow.rowIndex,
      c: this.colIndex,
      value: this.value,
      y: this.rowAlign.coordOffset,
      h: this.rowAlign.maxLength,
    } as any;
    if (this.colAlign) {
      out.x = this.colAlign.coordOffset;
      out.w = this.colAlign.maxLength;
    }
    return out;
  }
}

/**
 * Represents a row of grid cells in a GridView
 */
export class GridRow {
  varRowX = new kiwi.Variable();
  varRowHeight = new kiwi.Variable();

  cells: (null | GridCell)[] = [];
  // The default vertical alignment manager for all cells in this row
  defaultRowAlign = new RowAlign();

  constructor(public grid: GridView, public rowIndex: number) {}

  get numCols() {
    return this.cells.length;
  }

  cellAt(col: number, creator?: () => GridCell): GridCell | null {
    let out = this.cells[col] || null;
    if (!out && creator) {
      this.cells[col] = out = creator();
      out.gridRow = this;
      out.colIndex = col;
    }
    return out;
  }

  // Clears the cell at the given column.
  // Note this is not the same as "removing" a cell.
  // Removing a cell needs all cells to the "right" to be shifted left.
  // We wont support removing yet.
  clearCellAt(col: number): GridCell | null {
    const out = this.cells[col] || null;
    if (out) {
      this.cells[col] = null;
    }
    return out;
  }

  debugValue() {
    return {
      r: this.rowIndex,
      cells: this.cells.filter((c) => c).map((c) => c?.debugValue()),
    };
  }
}

export abstract class AlignedLine {
  private static idCounter = 0;
  readonly uuid = AlignedLine.idCounter++;
  needsLayout = false;
  protected _coordOffset = 0;
  protected _maxLength = 0;
  paddingBefore = 15;
  paddingAfter = 15;
  // All the cells that belong in this column
  cells: GridCell[] = [];
  modifiedCells = new Set<number>();

  // Any extra data the caller can set
  extraData = null as any;
  // cmpFunc is a way to indicate given two AlignedLines which of them
  // needs to appear before which,
  //
  // if this returns -1 then a *must* appear before b (less than)
  // if this returns +1 then a *must* after before b (greater than)
  // if this return a 0 then a and b can appear in any order
  cmpFunc: (a: this, b: this) => number;

  // Variables that will be "solved for"
  varOffset = new kiwi.Variable();
  varLength = new kiwi.Variable();

  get coordOffset(): number {
    return this._coordOffset;
  }

  /**
   * Return the maximum width of a particular column.
   */
  get maxLength(): number {
    return this._maxLength + this.paddingBefore + this.paddingAfter;
  }

  setMaxLength(length: number) {
    this._maxLength = length;
  }

  setPadding(before: number, after: number): void {
    if (before >= 0) {
      this.paddingBefore = before;
    }
    if (after >= 0) {
      this.paddingAfter = after;
    }
  }

  addCell(cell: GridCell): this {
    this.cells.push(cell);
    this.modifiedCells.add(cell.uuid);
    return this;
  }

  removeCell(cell: GridCell): this {
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i].uuid == cell.uuid) {
        this.cells.splice(i, 1);
        break;
      }
    }
    this.modifiedCells.add(cell.uuid);
    return this;
  }

  // The "neighboring" columns that depend on this column to be placed
  // before they are placed
  prevLines = [] as this[];
  nextLines = [] as this[];
  addSuccessor(next: this): void {
    // Set nextCol as a successor of this col
    // TODO - Ensure no cycles
    for (const c of this.nextLines) {
      if (c == next) return;
    }
    this.nextLines.push(next);
    next.prevLines.push(this);
  }

  removeSuccessor(next: this): void {
    // Set nextCol as a successor of this col
    // TODO - Ensure no cycles
    for (let i = 0; i < this.nextLines.length; i++) {
      if (this.nextLines[i] == next) {
        this.nextLines.splice(i, 1);
        break;
      }
    }
    for (let i = 0; i < next.prevLines.length; i++) {
      if (next.prevLines[i] == this) {
        next.prevLines.splice(i, 1);
        break;
      }
    }
  }
}

export class ColAlign extends AlignedLine {
  setX(val: number): void {
    this._coordOffset = val;
    for (const cell of this.cells) {
      if (cell.value) {
        const cellView = cell.grid.getCellView(cell.value);
        console.log("Here CV: ", cellView);
        cellView.x = val + this.paddingBefore;
        cellView.width = this._maxLength;
      }
    }
  }

  evalMaxWidth(changedCells: GridCell[] = []): number {
    this._maxLength = 0;
    for (const cell of this.cells) {
      if (cell.value) {
        const cellView = cell.grid.getCellView(cell.value);
        this._maxLength = Math.max(cellView.minSize.width, this.maxLength);
      }
    }
    return this._maxLength;
  }

  addCell(cell: GridCell): this {
    if (cell.colAlign && cell.colAlign != this) {
      cell.colAlign.removeCell(cell);
    }
    if (cell.colAlign != this) {
      return super.addCell(cell);
    }
    return this;
  }

  removeCell(cell: GridCell): this {
    if (cell.colAlign == this) {
      return super.removeCell(cell);
    }
    return this;
  }
}

export class RowAlign extends AlignedLine {
  /**
   * Sets the Y coordinate of all cells in this row.
   */
  setY(val: number): void {
    this._coordOffset = val;
    for (const cell of this.cells) {
      if (cell.value) {
        const cellView = cell.grid.getCellView(cell.value);
        cellView.y = val + this.paddingBefore;
        cellView.height = this._maxLength;
      }
    }
  }

  evalMaxHeight(changedCells: GridCell[] = []): number {
    this._maxLength = 0;
    for (const cell of this.cells) {
      if (cell.value) {
        const beatView = cell.grid.getCellView(cell.value);
        this._maxLength = Math.max(beatView.minSize.height, this._maxLength);
      }
    }
    return this._maxLength;
  }

  addCell(cell: GridCell): this {
    if (cell.rowAlign && cell.rowAlign != this) {
      cell.rowAlign.removeCell(cell);
    }
    if (cell.rowAlign != this) {
      return super.addCell(cell);
    }
    return this;
  }

  removeCell(cell: GridCell): this {
    if (cell.rowAlign == this) {
      return super.removeCell(cell);
    }
    return this;
  }
}
