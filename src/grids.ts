import * as TSU from "@panyam/tsutils";

/**
 * A sparse array type which is optimized for "holes" while not penalizing
 * runs of values.
 */
export class SparseArray<T> {
  runs: [number, T[]][] = [];

  get length(): number {
    let out = 0;
    for (const [, vals] of this.runs) {
      out += vals.length;
    }
    return out;
  }

  /**
   * Returns the value at a given index.
   * If the value does not exist an optional creator method can be passed
   * to ensure that this value is also created and set at the given index
   */
  valueAt(index: number, creator?: () => any): any {
    let out = null;
    if (out == null && creator) {
      // wasnt found
      out = creator();
      this.setAt(index, out);
    }
    return out;
  }

  setAt(index: number, ...values: (T | null)[]): this {
    return this.splice(index, values.length, ...values);
  }

  removeAt(index: number, count = 1): this {
    return this.splice(index, count);
  }

  splice(index: number, numToDelete: number, ...valuesToInsert: (T | null)[]) {
    //
    return this;
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
  constructor(public gridRow: GridRow, public colIndex: number, public value: any = null) {}

  get grid(): GridView {
    return this.gridRow.grid;
  }

  get row(): number {
    return this.gridRow.rowIndex;
  }
}

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
  currentTime = 0;
  // cells = new SparseArray<SparseArray<GridCell>>();
  rows: GridRow[] = [];
  getCellView: (value: any) => GridCellView;
  removeCellView: (cell: GridCellView) => void;

  addRows(insertBefore = -1, numRows = 1): GridRow[] {
    if (insertBefore < 0) {
      insertBefore = this.rows.length;
      this.rows.push(new GridRow(this, this.rows.length));
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

  ensureRows(count: number): this {
    if (count > this.rows.length) {
      this.addRows(-1, count - this.rows.length);
    }
    return this;
  }

  getRow(row: number): GridRow {
    this.ensureRows(row + 1);
    return this.rows[row];
  }

  setValue(row: number, col: number, value: any): any {
    const grow = this.getRow(row);
    const cell = grow.cellAt(col, () => {
      return new GridCell(grow, col, null);
    })!;
    const oldValue = cell.value;
    cell.value = value;
    return oldValue;
  }
}

/**
 * Represents a row of grid cells in a GridView
 */
export class GridRow {
  cells: (null | GridCell)[] = [];
  // The default vertical alignment manager for all cells in this row
  defaultAlignRow = new AlignedRow();

  constructor(public grid: GridView, public rowIndex: number) {}

  cellAt(col: number, creator?: () => GridCell): GridCell | null {
    let out = this.cells[col] || null;
    if (!out && creator) {
      this.cells[col] = out = creator();
    }
    return out;
  }

  setCellAt(col: number, newCell: null | GridCell): null | GridCell {
    const cellRow = this.cells;
    const oldCell = cellRow[col] || null;
    if (newCell && newCell.grid != this.grid) {
      throw new Error("Cells can only be moved within the same Grid.");
    }
    cellRow[col] = newCell;
    if (oldCell) {
      this.grid.addCellEvent(oldCell, GridCellEvent.REMOVED);
    }
    if (newCell) {
      if (newCell.gridRow != null) {
        this.grid.addCellEvent(newCell, GridCellEvent.MOVED);
      } else {
        this.grid.addCellEvent(newCell, GridCellEvent.ADDED);
      }
      newCell.gridRow = this;
      newCell.colIndex = col;
    }
    return oldCell || null;
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
