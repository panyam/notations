import * as TSU from "@panyam/tsutils";
// import * as kiwi from "@lume/kiwi";

/**
 * A generic way to host child views in a grid (very similar to gridbag
 * layout) This allows us to have a framework for hosting BeatViews instead
 * of mucking about with beat rows and beat columns etc.
 *
 * Grid "cells" can be referred by cell indexes.  Additionally we want our
 * grid rows and columns to have names (like in Spreadsheets) so that even
 * when rows and columns are inserted, though indexes may change, the
 * "addresses" will be fixed and immovable.  This helps us do things like
 * insert a new new column (say for markers) and not have to worry other
 * columns index changes impacting us.
 */
export class GridModel extends TSU.Events.EventEmitter {
  private _lastUpdatedAt = 0;
  private _lastSyncedAt = -1;
  // cells = new SparseArray<SparseArray<GridCell>>();
  rows: GridRow[] = [];

  debugValue() {
    const out = {
      rows: this.rows.map((r) => r.debugValue()),
      lastUpdatedAt: this.lastUpdatedAt,
      lastSyncedAt: this.lastSyncedAt,
    } as any;
    return out;
  }

  get lastSyncedAt() {
    return this._lastSyncedAt;
  }

  get lastUpdatedAt() {
    return this._lastUpdatedAt;
  }

  markSynced() {
    this._lastSyncedAt = this._lastUpdatedAt;
  }

  setUpdatedAt(val: number) {
    this._lastUpdatedAt = val;
  }

  addRows(insertBefore = -1, numRows = 1): this {
    if (insertBefore < 0) {
      insertBefore = this.rows.length;
    }
    let next = this.rows[insertBefore] || null;
    let prev = this.rows[insertBefore - 1] || null;
    for (let i = numRows - 1; i >= 0; i--) {
      const newRow = new GridRow(this, insertBefore + i);
      this.rows.splice(insertBefore, 0, newRow)
      if (next != null) {
        newRow.defaultRowAlign.addSuccessor(next.defaultRowAlign);
      }
      if (i == 0 && insertBefore > 0) {
        prev.defaultRowAlign.addSuccessor(newRow.defaultRowAlign);
      }
      next = newRow;
    }
    for (let i = insertBefore + numRows; i < this.rows.length; i++) {
      this.rows[i].rowIndex += numRows;
    }
    return this;
  }

  getRow(row: number): GridRow {
    if (row >= this.rows.length) {
      this.addRows(-1, 1 + row - this.rows.length);
    }
    return this.rows[row];
  }

  setValue(row: number, col: number, value: any, cellCreator?: (row: GridRow, col: number) => GridCell): any {
    const grow = this.getRow(row);
    if (!cellCreator) {
      cellCreator = (row: GridRow, col: number) => {
        return new GridCell(row, col);
      };
    }
    if (value == null) {
      const out = grow.clearCellAt(col);
      if (out != null) {
        this.eventHub?.emit(GridCellEvent.CLEARED, this, {
          loc: out.location,
        });
      }
      return out;
    } else {
      const cell = grow.cellAt(col, cellCreator) as GridCell;
      const oldValue = cell.value;
      this.eventHub?.emit(GridCellEvent.UPDATED, this, {
        loc: cell.location,
        cell: cell,
        oldValue: cell.value,
      });
      cell.value = value;
      return oldValue;
    }
  }

  protected eventHubChanged(): void {
    console.log("Event Hub Changed for GridModel");
  }
}

export class GridView {
  constructor(public readonly gridModel: GridModel) {
    gridModel.eventHub?.on(TSU.Events.EventHub.BATCH_EVENTS, (event) => {
      this.applyModelEvents(event.payload);
    });
  }

  get startingRows(): RowAlign[] {
    const out = [] as RowAlign[];
    let firstRow: null | GridRow = null;
    for (let i = 0; i < this.gridModel.rows.length; i++) {
      if (this.gridModel.getRow(i).numCells > 0) {
        firstRow = this.gridModel.getRow(i);
        break;
      }
    }
    if (firstRow != null) {
      const visited = {} as any;
      for (let i = 0; i < firstRow.numCols; i++) {
        const cell = firstRow.cellAt(i);
        if (cell && !visited[cell.rowAlign.uuid]) {
          visited[cell.rowAlign.uuid] = true;
          out.push(cell.rowAlign);
        }
      }
    }
    return out;
  }

  get startingCols(): ColAlign[] {
    const out = [] as ColAlign[];
    const visited = {} as any;
    for (let i = 0; i < this.gridModel.rows.length; i++) {
      const cell = this.gridModel.getRow(i).cellAt(0);
      if (cell && !visited[cell.colAlign.uuid]) {
        visited[cell.colAlign.uuid] = true;
        out.push(cell.colAlign);
      }
    }
    return out;
  }

  /**
   * As the grid model changes (cell content changed, cleared etc) we need
   * to refresh our layout based on this.
   * As a first step the new height and width of all changed cells is evaluted
   * to see which rows and/or columns are affected (and need to be
   * resized/repositioned).
   */
  protected applyModelEvents(events: TSU.Events.TEvent[]) {
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
    for (let i = events.length - 1; i >= 0; i--) {
      const event = events[i];
      const loc = event.payload.loc;
      if (cellVisited[loc]) continue;
      cellVisited[loc] = true;
      const [row, col] = loc.split(":").map((x: string) => parseInt(x));
      const gMod = this.gridModel;
      const cell = gMod.getRow(row).cellAt(col);
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
    // let firstRowChanged = this.gridModel.rows.length;
    // let firstColChanged = 1000000000; // INT_MAX
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
        visitedRows[rowAlign.uuid] = true;
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
          rowOffsetChanged[rowAlign.uuid] = true;
        }

        // Add next neighbors now
        for (const next of rowAlign.nextLines) {
          if (!visitedRows[next.uuid]) {
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
        visitedCols[colAlign.uuid] = true;
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
          colOffsetChanged[colAlign.uuid] = true;
        }

        // Add next neighbors now
        for (const next of colAlign.nextLines) {
          if (!visitedCols[next.uuid]) {
            nextQueue.push([colAlign, next]);
          }
        }
      }
      colQueue = nextQueue;
    }
    this.gridModel.markSynced();
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
  ADDED = "CellAdded",
  CLEARED = "CellCleared",
  REMOVED = "CellRemoved",
  UPDATED = "CellUpdated",
  MOVED = "CellMoved",
}

/**
 * Interface for a view for a given cell in the grid.
 */
export class GridCell {
  private static idCounter = 0;
  readonly uuid = GridCell.idCounter++;
  cellView: GridCellView | null;
  private _rowAlign: RowAlign;
  private _colAlign: ColAlign;

  constructor(public gridRow: GridRow, public colIndex: number, public value: any = null) {
    this.rowAlign = gridRow.defaultRowAlign;
  }

  get rowAlign(): RowAlign {
    return this._rowAlign;
  }

  set rowAlign(val: RowAlign) {
    val.addCell(this);
    this._rowAlign = val;
  }

  get colAlign(): ColAlign {
    return this._colAlign;
  }

  set colAlign(val: ColAlign) {
    val.addCell(this);
    this._colAlign = val;
  }

  get location(): string {
    return this.gridRow.rowIndex + ":" + this.colIndex;
  }

  get grid(): GridModel {
    return this.gridRow.grid;
  }

  get rowIndex(): number {
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
 * Represents a row of grid cells in a GridModel
 */
export class GridRow {
  cells: (null | GridCell)[] = [];
  // The default vertical alignment manager for all cells in this row
  defaultRowAlign = new RowAlign();

  constructor(public grid: GridModel, public rowIndex: number) {}

  get numCols() {
    return this.cells.length;
  }

  /**
   * Returns the number of cells that contain values.
   */
  get numCells() {
    let i = 0;
    for (const cell of this.cells) {
      if (cell != null && cell.value != null) i++;
    }
    return i;
  }

  cellAt(col: number, creator?: (row: GridRow, col: number) => GridCell): GridCell | null {
    let out = this.cells[col] || null;
    if (!out && creator) {
      this.cells[col] = out = creator(this, col);
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
  getCellView: (value: any) => GridCellView;

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
    return this;
  }

  removeCell(cell: GridCell): this {
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i].uuid == cell.uuid) {
        this.cells.splice(i, 1);
        break;
      }
    }
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
        const cellView = this.getCellView(cell);
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
        const cellView = this.getCellView(cell);
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
        const cellView = this.getCellView(cell);
        cellView.y = val + this.paddingBefore;
        cellView.height = this._maxLength;
      }
    }
  }

  evalMaxHeight(changedCells: GridCell[] = []): number {
    this._maxLength = 0;
    for (const cell of this.cells) {
      if (cell.value) {
        const cellView = this.getCellView(cell);
        this._maxLength = Math.max(cellView.minSize.height, this._maxLength);
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
