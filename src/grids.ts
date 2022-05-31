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
  private _layoutGroup: GridLayoutGroup;

  constructor() {
    super();
    this.layoutGroup = new GridLayoutGroup();
  }

  debugValue() {
    const out = {
      rows: this.rows.map((r) => r.debugValue()),
      lastUpdatedAt: this.lastUpdatedAt,
      lastSyncedAt: this.lastSyncedAt,
    } as any;
    return out;
  }

  get layoutGroup(): GridLayoutGroup {
    return this._layoutGroup;
  }

  set layoutGroup(lg: GridLayoutGroup) {
    if (lg.addGridModel(this)) {
      this._layoutGroup = lg;
    }
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
    const prev = this.rows[insertBefore - 1] || null;
    for (let i = numRows - 1; i >= 0; i--) {
      const newRow = new GridRow(this, insertBefore + i);
      this.rows.splice(insertBefore, 0, newRow);
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

export interface GridCellView {
  x: number;
  y: number;
  width: number;
  height: number;
  setBounds(
    x: number | null,
    y: number | null,
    w: number | null,
    h: number | null,
    applyLayout: boolean,
  ): [number | null, number | null, number | null, number | null];
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
  defaultRowAlign: RowAlign;

  constructor(public grid: GridModel, public rowIndex: number) {
    this.defaultRowAlign = new RowAlign();
    this.grid.layoutGroup?.addRowAlign(this.defaultRowAlign);
  }

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
      if (this.grid.layoutGroup) {
        if (out.rowAlign) {
          this.grid.layoutGroup.addRowAlign(out.rowAlign);
        }
        if (out.colAlign) {
          this.grid.layoutGroup.addColAlign(out.colAlign);
        }
      }
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

  abstract setOffset(val: number): void;
  abstract evalMaxLength(changedCells: GridCell[]): number;

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
    if (this.beforeAddingCell(cell)) {
      this.cells.push(cell);
    }
    return this;
  }

  protected beforeAddingCell(cell: GridCell): boolean {
    return true;
  }

  removeCell(cell: GridCell): this {
    if (this.beforeRemovingCell(cell)) {
      for (let i = 0; i < this.cells.length; i++) {
        if (this.cells[i].uuid == cell.uuid) {
          this.cells.splice(i, 1);
          break;
        }
      }
    }
    return this;
  }

  protected beforeRemovingCell(cell: GridCell): boolean {
    return true;
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

  /* TODO: Disabling only to improve test coverage as this method is
   * not used.
   * When we have mutable grids where we can insert/remove neighbors
   * we can enable this again.
   */
  /*
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
  */
}

export class ColAlign extends AlignedLine {
  setOffset(val: number): void {
    this._coordOffset = val;
    for (const cell of this.cells) {
      if (cell.value) {
        const cellView = this.getCellView(cell);
        cellView.setBounds(val + this.paddingBefore, null, this._maxLength, null, true);
      }
    }
  }

  evalMaxLength(changedCells: GridCell[] = []): number {
    this._maxLength = 0;
    for (const cell of this.cells) {
      if (cell.value) {
        const cellView = this.getCellView(cell);
        this._maxLength = Math.max(cellView.minSize.width, this.maxLength);
      }
    }
    return this._maxLength;
  }

  protected beforeAddingCell(cell: GridCell): boolean {
    if (cell.colAlign && cell.colAlign != this) {
      cell.colAlign.removeCell(cell);
    }
    return cell.colAlign != this;
  }

  beforeRemovingCell(cell: GridCell): boolean {
    return cell.colAlign == this;
  }
}

export class RowAlign extends AlignedLine {
  /**
   * Sets the Y coordinate of all cells in this row.
   */
  setOffset(val: number): void {
    this._coordOffset = val;
    for (const cell of this.cells) {
      if (cell.value) {
        const cellView = this.getCellView(cell);
        cellView.setBounds(null, val + this.paddingBefore, null, this._maxLength, true);
      }
    }
  }

  evalMaxLength(changedCells: GridCell[] = []): number {
    this._maxLength = 0;
    for (const cell of this.cells) {
      if (cell.value) {
        const cellView = this.getCellView(cell);
        this._maxLength = Math.max(cellView.minSize.height, this._maxLength);
      }
    }
    return this._maxLength;
  }

  protected beforeAddingCell(cell: GridCell): boolean {
    if (cell.rowAlign && cell.rowAlign != this) {
      cell.rowAlign.removeCell(cell);
    }
    return cell.rowAlign != this;
  }

  beforeRemovingCell(cell: GridCell): boolean {
    return cell.rowAlign == this;
  }
}

/**
 * The layout manager for a collection of GridViews bound by common
 * alignment objects.
 */
export class GridLayoutGroup {
  rowAligns = new Map<number, RowAlign>();
  colAligns = new Map<number, ColAlign>();
  gridModels = [] as GridModel[];

  private eventHandler = (event: TSU.Events.TEvent) => {
    this.applyModelEvents(event.payload);
  };

  addRowAlign(align: RowAlign): void {
    this.rowAligns.set(align.uuid, align);
    if (!align.getCellView) align.getCellView = this._getCellView;
  }

  addColAlign(align: ColAlign): void {
    this.colAligns.set(align.uuid, align);
    if (!align.getCellView) align.getCellView = this._getCellView;
  }

  addGridModel(gridModel: GridModel): boolean {
    if (gridModel.layoutGroup != this) {
      if (gridModel.layoutGroup) {
        gridModel.layoutGroup.removeGridModel(gridModel);
      }
      gridModel.eventHub?.on(TSU.Events.EventHub.BATCH_EVENTS, this.eventHandler);
      this.gridModels.push(gridModel);
    }
    return true;
  }

  removeGridModel(gridModel: GridModel): void {
    if (gridModel.layoutGroup == this) {
      gridModel.eventHub?.removeOn(TSU.Events.EventHub.BATCH_EVENTS, this.eventHandler);
      for (let i = 0; i < this.gridModels.length; i++) {
        if (this.gridModels[i] == gridModel) {
          this.gridModels.splice(i, 1);
          break;
        }
      }
    }
  }

  _getCellView: (cell: GridCell) => GridCellView;
  set getCellView(creator: (cell: GridCell) => GridCellView) {
    this._getCellView = creator;
    for (const [, rowAlign] of this.rowAligns) {
      rowAlign.getCellView = creator;
    }
    for (const [, colAlign] of this.colAligns) {
      colAlign.getCellView = creator;
    }
  }

  get startingRows(): RowAlign[] {
    const out = [] as RowAlign[];
    for (const [, rowAlign] of this.rowAligns) {
      if (rowAlign.prevLines.length == 0) {
        out.push(rowAlign);
      }
    }
    return out;
  }

  get startingCols(): ColAlign[] {
    const out = [] as ColAlign[];
    for (const [, colAlign] of this.colAligns) {
      if (colAlign.prevLines.length == 0) {
        out.push(colAlign);
      }
    }
    return out;
  }

  /**
   * Forces a full refresh.
   */
  refreshLayout() {
    const gridModels: GridModel[] = [];
    const changedRowAligns = {} as any;
    const changedColAligns = {} as any;

    for (const [, rowAlign] of this.rowAligns) {
      if (!(rowAlign.uuid in changedRowAligns)) {
        changedRowAligns[rowAlign.uuid] = {
          align: rowAlign,
          cells: [],
        };
      }
    }

    for (const [, colAlign] of this.colAligns) {
      if (!(colAlign.uuid in changedColAligns)) {
        changedColAligns[colAlign.uuid] = {
          align: colAlign,
          cells: [],
        };
      }
    }

    this.doBfsLayout(this.startingRows, changedRowAligns);
    this.doBfsLayout(this.startingCols, changedColAligns);
    gridModels.forEach((gm) => gm.markSynced());
  }

  /**
   * As the grid model changes (cell content changed, cleared etc) we need
   * to refresh our layout based on this.
   * As a first step the new height and width of all changed cells is
   * evaluted to see which rows and/or columns are affected (and need to be
   * resized/repositioned).
   */
  protected applyModelEvents(events: TSU.Events.TEvent[]) {
    const [gridModels, changedRowAligns, changedColAligns] = this.changesForEvents(events);
    this.doBfsLayout(this.startingRows, changedRowAligns);
    this.doBfsLayout(this.startingCols, changedColAligns);
    gridModels.forEach((gm) => gm.markSynced());
  }

  protected changesForEvents(events: TSU.Events.TEvent[]): [GridModel[], any, any] {
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
    const gridModels = [] as GridModel[];
    for (let i = events.length - 1; i >= 0; i--) {
      const event = events[i];
      const loc = event.payload.loc;
      if (cellVisited[loc]) continue;
      cellVisited[loc] = true;
      const [row, col] = loc.split(":").map((x: string) => parseInt(x));
      const gridModel = event.source;
      gridModels.push(gridModel);
      const cell = gridModel.getRow(row).cellAt(col);
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
    return [gridModels, changedRowAligns, changedColAligns];
  }

  // 1. start from the starting lines and do a BF traversal
  // 2. If a line not visited (ie laid out):
  //      if it is in the changedAlign list then reval its length (w/h)
  //      set its offset and length if either width or offset has changed
  //      offset can be thought of changed if the preceding line's offset has changed
  // first do above for rows
  protected doBfsLayout<T extends AlignedLine>(startingLines: T[], changedAligns: any) {
    // Eval max lengths for all changed aligns
    if (!this._getCellView) return;
    for (const alignId in changedAligns) {
      const val = changedAligns[alignId];
      val.align.evalMaxLength(val.cells);
    }
    let lineQueue = [] as [null | T, T][];
    const visitedLines = {} as any;
    for (const line of startingLines) lineQueue.push([null, line]);
    const lineOffsetChanged = {} as any;
    while (lineQueue.length > 0) {
      const nextQueue = [] as [null | T, T][];
      for (let i = 0; i < lineQueue.length; i++) {
        const [prevLineAlign, lineAlign] = lineQueue[i];
        visitedLines[lineAlign.uuid] = true;
        let newY = lineAlign.coordOffset;
        let lineChanged = lineAlign.uuid in changedAligns;
        if (prevLineAlign) {
          if (lineOffsetChanged[prevLineAlign.uuid]) {
            newY = prevLineAlign.coordOffset + prevLineAlign.maxLength;
            lineChanged = true;
          }
        }
        if (lineChanged) {
          lineAlign.setOffset(newY);
          lineOffsetChanged[lineAlign.uuid] = true;
        }

        // Add next neighbors now
        for (const next of lineAlign.nextLines) {
          if (!visitedLines[next.uuid]) {
            nextQueue.push([lineAlign, next]);
          }
        }
      }
      lineQueue = nextQueue;
    }
  }
}
