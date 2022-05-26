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
    return {
      rows: this.rows.map((r) => r.debugValue()),
      lastUpdatedAt: this.lastUpdatedAt,
      lastSyncedAt: this.lastSyncedAt,
    };
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
    }
    this.rows.splice(insertBefore, 0, ...out);
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
      cell.value = value;
      return oldValue;
    }
  }

  /**
   * Mark a cell as updated in this iteration so only these can
   * be used in the calculation of layout changes.
   */
  updatedCells = {} as TSU.NumMap<GridCell>;
  clearedCells = {} as TSU.NumMap<GridCell>;
  setCellCleared(cell: GridCell) {
    this.clearedCells[cell.uuid] = cell;
  }
  setCellUpdated(cell: GridCell) {
    this.updatedCells[cell.uuid] = cell;
  }

  applyChanges(): void {
    this._lastSyncedAt = this._lastUpdatedAt;
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
  alignRow: AlignedRow;
  alignCol: AlignedCol;
  cellView: GridCellView | null;

  // Variables that will be "solved for"
  varCellX = new kiwi.Variable();
  varCellY = new kiwi.Variable();
  varCellWidth = new kiwi.Variable();
  varCellHeight = new kiwi.Variable();

  constructor(public gridRow: GridRow, public colIndex: number, public value: any = null) {
    this.alignRow = gridRow.defaultAlignRow;
  }

  get grid(): GridView {
    return this.gridRow.grid;
  }

  get row(): number {
    return this.gridRow.rowIndex;
  }

  debugValue() {
    const out = {
      row: this.gridRow.rowIndex,
      col: this.colIndex,
      value: this.value,
      y: this.alignRow.coordOffset,
      h: this.alignRow.maxLength,
    } as any;
    if (this.alignCol) {
      out.x = this.alignCol.coordOffset;
      out.w = this.alignCol.maxLength;
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
  defaultAlignRow = new AlignedRow();

  constructor(public grid: GridView, public rowIndex: number) {}

  cellAt(col: number, creator?: () => GridCell): GridCell | null {
    let out = this.cells[col] || null;
    if (!out && creator) {
      this.cells[col] = out = creator();
      out.gridRow = this;
      out.colIndex = col;
      this.grid.setCellUpdated(out);
    }
    return out;
  }

  // Clears the cell at the given column.
  // Note this is not the same as "removing" a cell.
  // Removing a cell needs all cells to the "right" to be shifted left.
  clearCellAt(col: number): GridCell | null {
    const out = this.cells[col] || null;
    if (out) {
      this.cells[col] = null;
    }
    return out;
  }

  debugValue() {
    return {
      row: this.rowIndex,
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
}

export class AlignedCol extends AlignedLine {
  // The "neighboring" columns that depend on this column to be placed
  // before they are placed
  nextCols = [] as AlignedCol[];
  addSuccessor(nextCol: AlignedCol): void {
    // Set nextCol as a successor of this col
    // TODO - Ensure no cycles
    for (const c of this.nextCols) {
      if (c == nextCol) return;
    }
    this.nextCols.push(nextCol);
  }

  setX(val: number): void {
    this._coordOffset = val;
    for (const cell of this.cells) {
      if (cell.value) {
        const cellView = cell.grid.getCellView(cell.value);
        cellView.x = val + this.paddingBefore;
        cellView.width = this._maxLength;
      }
    }
  }

  evalMaxWidth(): number {
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
    if (cell.alignCol != this) {
      throw new Error("Cell's alignCol is set to another Col");
    }
    return super.addCell(cell);
  }

  removeCell(cell: GridCell): this {
    if (cell.alignCol != this) {
      throw new Error("Cell's alignCol is set to another Col");
    }
    return super.removeCell(cell);
  }
}

export class AlignedRow extends AlignedLine {
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

  evalMaxHeight(): number {
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
    if (cell.alignRow != this) {
      throw new Error("Cell's alignRow is set to another Row");
    }
    return super.addCell(cell);
  }

  removeCell(cell: GridCell): this {
    if (cell.alignRow != this) {
      throw new Error("Cell's alignRow is set to another Row");
    }
    return super.removeCell(cell);
  }
}
