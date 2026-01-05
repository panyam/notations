import * as TSU from "@panyam/tsutils";
// import * as kiwi from "@lume/kiwi";

/**
 * Event emitted when layout changes occur in a GridLayoutGroup.
 * Subscribers can use this to update their views incrementally.
 */
export interface LayoutChangeEvent {
  /** The range of rows affected by the change */
  affectedRowRange: { start: number; end: number } | null;
  /** The range of columns affected by the change */
  affectedColRange: { start: number; end: number } | null;
  /** Whether column widths changed (requires horizontal re-layout) */
  columnWidthsChanged: boolean;
  /** Whether row heights changed (requires vertical re-layout) */
  rowHeightsChanged: boolean;
  /** The grid models that were affected */
  affectedGridModels: GridModel[];
}

/**
 * Callback type for layout change subscribers.
 */
export type LayoutChangeCallback = (event: LayoutChangeEvent) => void;

/**
 * A generic grid layout system for hosting child views (similar to GridBagLayout).
 * This provides a framework for hosting BeatViews in a structured grid arrangement,
 * with support for rows, columns, and alignment.
 *
 * Grid "cells" can be referred to by cell indexes. Additionally, grid rows and
 * columns can have names (like in spreadsheets) so that even when rows and columns
 * are inserted, though indexes may change, the "addresses" remain fixed and immovable.
 */
export class GridModel extends TSU.Events.EventEmitter {
  private static idCounter = 0;
  readonly uuid = GridModel.idCounter++;
  /** Timestamp of the last update to this grid */
  lastUpdatedAt = 0;
  // cells = new SparseArray<SparseArray<GridCell>>();
  /** The rows in this grid */
  rows: GridRow[] = [];
  /** Mapping of row indices to row alignment objects */
  rowAligns = new Map<number, RowAlign>();
  /** Mapping of column indices to column alignment objects */
  colAligns = new Map<number, ColAlign>();

  /**
   * Returns a debug-friendly representation of this GridModel.
   * @returns An object containing debug information
   */
  debugValue() {
    const out = {
      rows: this.rows.map((r) => r.debugValue()),
      lastUpdatedAt: this.lastUpdatedAt,
    } as any;
    return out;
  }

  /**
   * Gets the index of the first non-empty row.
   * @returns The index of the first row containing cells, or -1 if none
   */
  get firstRow(): number {
    for (const gr of this.rows) {
      if (gr.numCells > 0) return gr.rowIndex;
    }
    return -1;
  }

  /**
   * Gets the index of the leftmost column containing cells.
   * @returns The index of the first column containing cells, or -1 if none
   */
  get firstCol(): number {
    let minCol = -1;
    for (const gr of this.rows) {
      const fc = gr.firstCol;
      if (fc >= 0) {
        if (minCol < 0 || fc < minCol) {
          minCol = fc;
        }
      }
    }
    return minCol;
  }

  /**
   * Gets all non-empty cells in a specific row.
   * @param row The index of the row
   * @returns An array of cells in the row
   */
  cellsInRow(row: number): GridCell[] {
    const out = [] as GridCell[];
    const gr = this.rows[row];
    if (gr) {
      for (const cell of gr.cells) {
        if (cell?.value) out.push(cell);
      }
    }
    return out;
  }

  /**
   * Gets all non-empty cells in a specific column.
   * @param col The index of the column
   * @returns An array of cells in the column
   */
  cellsInCol(col: number): GridCell[] {
    const out = [] as GridCell[];
    for (const gr of this.rows) {
      const cell = gr.cellAt(col);
      if (cell?.value) out.push(cell);
    }
    return out;
  }

  /**
   * Adds a row alignment object to the grid.
   * @param align The row alignment to add
   */
  addRowAlign(align: RowAlign): void {
    this.rowAligns.set(align.uuid, align);
  }

  /**
   * Adds a column alignment object to the grid.
   * @param align The column alignment to add
   */
  addColAlign(align: ColAlign): void {
    this.colAligns.set(align.uuid, align);
  }

  /**
   * Adds rows to the grid.
   * @param insertBefore The index before which to insert the rows, or -1 to append
   * @param numRows The number of rows to add
   * @returns This grid instance for method chaining
   */
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

  /**
   * Gets a row at the specified index, creating it if necessary.
   * @param row The index of the row to get
   * @returns The row at the specified index
   */
  getRow(row: number): GridRow {
    if (row >= this.rows.length) {
      this.addRows(-1, 1 + row - this.rows.length);
    }
    return this.rows[row];
  }

  /**
   * Sets a value in a cell at the specified row and column.
   * @param row The row index
   * @param col The column index
   * @param value The value to set
   * @param cellCreator Optional function to create a custom cell
   * @returns The previous value of the cell
   */
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

  /**
   * Handles changes to the event hub.
   */
  protected eventHubChanged(): void {
    console.log("Event Hub Changed for GridModel");
  }
}

/**
 * Interface for a view associated with a grid cell.
 * GridCellView defines the contract for views that can be placed in grid cells.
 */
export interface GridCellView {
  /** The grid cell this view is associated with */
  readonly cell: GridCell;
  /** X-coordinate of the view */
  x: number;
  /** Y-coordinate of the view */
  y: number;
  /** Width of the view */
  width: number;
  /** Height of the view */
  height: number;

  /**
   * Sets the bounds of the view.
   * @param x New x-coordinate, or null to keep current value
   * @param y New y-coordinate, or null to keep current value
   * @param w New width, or null to keep current value
   * @param h New height, or null to keep current value
   * @param applyLayout Whether to apply layout immediately
   * @returns The new bounds values
   */
  setBounds(
    x: number | null,
    y: number | null,
    w: number | null,
    h: number | null,
    applyLayout: boolean,
  ): [number | null, number | null, number | null, number | null];

  /** Whether this view needs layout */
  readonly needsLayout: boolean;

  /** The minimum size this view requires */
  readonly minSize: TSU.Geom.Size;

  /** The bounding box of this view */
  readonly bbox: TSU.Geom.Rect;
}

/**
 * Enum defining the events that can occur on grid cells.
 */
export enum GridCellEvent {
  ADDED = "CellAdded",
  CLEARED = "CellCleared",
  REMOVED = "CellRemoved",
  UPDATED = "CellUpdated",
  MOVED = "CellMoved",
}

/**
 * Represents a cell in the grid.
 * GridCell holds a value and manages alignment with rows and columns.
 */
export class GridCell {
  private static idCounter = 0;
  readonly uuid = GridCell.idCounter++;
  /** The view associated with this cell */
  cellView: GridCellView | null;
  private _rowAlign: RowAlign;
  private _colAlign: ColAlign;

  /**
   * Creates a new GridCell.
   * @param gridRow The row this cell belongs to
   * @param colIndex The column index of this cell
   * @param value Optional initial value for the cell
   */
  constructor(
    public gridRow: GridRow,
    public colIndex: number,
    public value: any = null,
  ) {
    this.rowAlign = gridRow.defaultRowAlign;
  }

  /**
   * Gets the row alignment for this cell.
   */
  get rowAlign(): RowAlign {
    return this._rowAlign;
  }

  /**
   * Sets the row alignment for this cell.
   */
  set rowAlign(val: RowAlign) {
    val.addCell(this);
    this._rowAlign = val;
  }

  /**
   * Gets the column alignment for this cell.
   */
  get colAlign(): ColAlign {
    return this._colAlign;
  }

  /**
   * Sets the column alignment for this cell.
   */
  set colAlign(val: ColAlign) {
    val.addCell(this);
    this._colAlign = val;
  }

  /**
   * Gets the location string for this cell (rowIndex:colIndex).
   */
  get location(): string {
    return this.gridRow.rowIndex + ":" + this.colIndex;
  }

  /**
   * Gets the grid this cell belongs to.
   */
  get grid(): GridModel {
    return this.gridRow.grid;
  }

  /**
   * Gets the row index of this cell.
   */
  get rowIndex(): number {
    return this.gridRow.rowIndex;
  }

  /**
   * Returns a debug-friendly representation of this GridCell.
   * @returns An object containing debug information
   */
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
 * Represents a row of grid cells in a GridModel.
 */
export class GridRow {
  /** The cells in this row */
  cells: (null | GridCell)[] = [];
  /** The default vertical alignment for all cells in this row */
  defaultRowAlign: RowAlign;

  /**
   * Creates a new GridRow.
   * @param grid The grid this row belongs to
   * @param rowIndex The index of this row
   */
  constructor(
    public grid: GridModel,
    public rowIndex: number,
  ) {
    this.defaultRowAlign = new RowAlign();
    this.grid.addRowAlign(this.defaultRowAlign);
  }

  /**
   * Gets the index of the first non-empty column in this row.
   */
  get firstCol() {
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i]?.value) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Gets the number of columns in this row.
   */
  get numCols() {
    return this.cells.length;
  }

  /**
   * Gets the number of cells that contain values.
   */
  get numCells() {
    let i = 0;
    for (const cell of this.cells) {
      if (cell != null && cell.value != null) i++;
    }
    return i;
  }

  /**
   * Gets the cell at the specified column index, optionally creating it if it doesn't exist.
   * @param col The column index
   * @param creator Optional function to create the cell if it doesn't exist
   * @returns The cell at the specified index, or null if it doesn't exist and no creator was provided
   */
  cellAt(col: number, creator?: (row: GridRow, col: number) => GridCell): GridCell | null {
    let out = this.cells[col] || null;
    if (!out && creator) {
      this.cells[col] = out = creator(this, col);
      out.gridRow = this;
      out.colIndex = col;
      if (out.rowAlign) {
        this.grid.addRowAlign(out.rowAlign);
      }
      if (out.colAlign) {
        this.grid.addColAlign(out.colAlign);
      }
    }
    return out;
  }

  /**
   * Clears the cell at the given column.
   * Note this is not the same as "removing" a cell.
   * Removing a cell would require all cells to the "right" to be shifted left.
   * @param col The column index
   * @returns The cell that was cleared, or null if none existed
   */
  clearCellAt(col: number): GridCell | null {
    const out = this.cells[col] || null;
    if (out) {
      this.cells[col] = null;
    }
    return out;
  }

  /**
   * Returns a debug-friendly representation of this GridRow.
   * @returns An object containing debug information
   */
  debugValue() {
    return {
      r: this.rowIndex,
      cells: this.cells.filter((c) => c).map((c) => c?.debugValue()),
    };
  }
}

/**
 * Base class for row and column alignment objects.
 * AlignedLine manages the alignment of cells along a line (row or column).
 */
export abstract class AlignedLine {
  private static idCounter = 0;
  readonly uuid = AlignedLine.idCounter++;
  /** Whether this line needs layout */
  needsLayout = false;
  /** The coordinate offset of this line */
  protected _coordOffset = 0;
  /** The maximum length of this line */
  protected _maxLength = 0;
  /** Padding before this line */
  paddingBefore = 5;
  /** Padding after this line */
  paddingAfter = 5;
  /** The cells that belong to this line */
  cells: GridCell[] = [];
  /** Function to get a view for a cell value */
  getCellView: (value: any) => GridCellView;

  /**
   * Sets the offset of this line.
   * @param val The new offset value
   */
  abstract setOffset(val: number): void;

  /**
   * Evaluates the maximum length required for this line.
   * @param changedCells Cells that have changed and need re-evaluation
   * @returns The maximum length
   */
  abstract evalMaxLength(changedCells: GridCell[]): number;

  /**
   * Gets the coordinate offset of this line.
   */
  get coordOffset(): number {
    return this._coordOffset;
  }

  /**
   * Gets the maximum length of this line, including padding.
   */
  get maxLength(): number {
    return this._maxLength + this.paddingBefore + this.paddingAfter;
  }

  /**
   * Sets the maximum length of this line.
   * @param length The new maximum length
   */
  setMaxLength(length: number) {
    this._maxLength = length;
  }

  /**
   * Sets the padding before and after this line.
   * @param before Padding before the line
   * @param after Padding after the line
   */
  setPadding(before: number, after: number): void {
    if (before >= 0) {
      this.paddingBefore = before;
    }
    if (after >= 0) {
      this.paddingAfter = after;
    }
  }

  /**
   * Adds a cell to this line.
   * @param cell The cell to add
   * @returns This line instance for method chaining
   */
  addCell(cell: GridCell): this {
    if (this.beforeAddingCell(cell)) {
      this.cells.push(cell);
    }
    return this;
  }

  /**
   * Called before adding a cell to perform validation or preparation.
   * @param cell The cell to be added
   * @returns Whether the cell should be added
   */
  protected abstract beforeAddingCell(cell: GridCell): boolean;

  /**
   * Removes a cell from this line.
   * @param cell The cell to remove
   * @returns This line instance for method chaining
   */
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

  /**
   * Called before removing a cell to perform validation.
   * @param cell The cell to be removed
   * @returns Whether the cell should be removed
   */
  protected abstract beforeRemovingCell(cell: GridCell): boolean;

  // The "neighboring" lines that depend on this line to be placed
  // before they are placed
  /** Lines that must be positioned before this line */
  prevLines = [] as this[];
  /** Lines that must be positioned after this line */
  nextLines = [] as this[];

  /**
   * Adds a successor line to this line.
   * @param next The line to add as a successor
   */
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

/**
 * Manages the alignment of cells in a column.
 */
export class ColAlign extends AlignedLine {
  paddingBefore = 10;
  /** Padding after this line */
  paddingAfter = 10;

  /**
   * Sets the offset of this column and updates all associated cells.
   * @param val The new offset value
   */
  setOffset(val: number): void {
    this._coordOffset = val;
    for (const cell of this.cells) {
      if (cell.value) {
        const cellView = this.getCellView(cell);
        if (this._maxLength <= 0) {
          // this hasnt been evaluated yet so do it!
          this.evalMaxLength();
        }
        cellView.setBounds(val, null, this.maxLength, null, true);
      }
    }
  }

  /**
   * Evaluates the maximum width required for this column.
   * @param changedCells Cells that have changed and need re-evaluation
   * @returns The maximum width
   */
  evalMaxLength(changedCells: GridCell[] = []): number {
    this._maxLength = 0;
    for (const cell of this.cells) {
      if (cell.value) {
        const cellView = this.getCellView(cell);
        this._maxLength = Math.max(cellView.minSize.width, this._maxLength);
      }
    }
    return this._maxLength;
  }

  /**
   * Called before adding a cell to perform validation or preparation.
   * @param cell The cell to be added
   * @returns Whether the cell should be added
   */
  protected beforeAddingCell(cell: GridCell): boolean {
    if (cell.colAlign && cell.colAlign != this) {
      cell.colAlign.removeCell(cell);
    }
    return cell.colAlign != this;
  }

  /**
   * Called before removing a cell to perform validation.
   * @param cell The cell to be removed
   * @returns Whether the cell should be removed
   */
  beforeRemovingCell(cell: GridCell): boolean {
    return cell.colAlign == this;
  }
}

/**
 * Manages the alignment of cells in a row.
 */
export class RowAlign extends AlignedLine {
  /**
   * Sets the Y coordinate of all cells in this row.
   * @param val The new Y coordinate
   */
  setOffset(val: number): void {
    this._coordOffset = val;
    for (const cell of this.cells) {
      if (cell.value) {
        const cellView = this.getCellView(cell);
        if (this._maxLength <= 0) {
          // this hasnt been evaluated yet so do it!
          this.evalMaxLength();
        }
        cellView.setBounds(null, val, null, this.maxLength, true);
      }
    }
  }

  /**
   * Evaluates the maximum height required for this row.
   * @param changedCells Cells that have changed and need re-evaluation
   * @returns The maximum height
   */
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

  /**
   * Called before adding a cell to perform validation or preparation.
   * @param cell The cell to be added
   * @returns Whether the cell should be added
   */
  protected beforeAddingCell(cell: GridCell): boolean {
    if (cell.rowAlign && cell.rowAlign != this) {
      cell.rowAlign.removeCell(cell);
    }
    return cell.rowAlign != this;
  }

  /**
   * Called before removing a cell to perform validation.
   * @param cell The cell to be removed
   * @returns Whether the cell should be removed
   */
  beforeRemovingCell(cell: GridCell): boolean {
    return cell.rowAlign == this;
  }
}

/**
 * The layout manager for a collection of GridViews bound by common alignment objects.
 * Manages the layout of multiple grid models, ensuring proper alignment between them.
 */
export class GridLayoutGroup {
  // rowAligns = new Map<number, RowAlign>();
  // colAligns = new Map<number, ColAlign>();
  /** The grid models managed by this layout group */
  gridModels = [] as GridModel[];

  /** Subscribers to layout change events */
  private layoutChangeSubscribers = new Set<LayoutChangeCallback>();

  /**
   * Subscribes to layout change events.
   * @param callback Function to call when layout changes
   * @returns Unsubscribe function
   */
  onLayoutChange(callback: LayoutChangeCallback): () => void {
    this.layoutChangeSubscribers.add(callback);
    return () => {
      this.layoutChangeSubscribers.delete(callback);
    };
  }

  /**
   * Notifies all subscribers of a layout change.
   * @param event The layout change event
   */
  protected notifyLayoutChange(event: LayoutChangeEvent): void {
    for (const callback of this.layoutChangeSubscribers) {
      try {
        callback(event);
      } catch (e) {
        console.error("Error in layout change callback:", e);
      }
    }
  }

  /**
   * Gets the number of layout change subscribers.
   */
  get subscriberCount(): number {
    return this.layoutChangeSubscribers.size;
  }

  /**
   * Event handler for processing events from grid models.
   */
  private eventHandler = (event: TSU.Events.TEvent) => {
    this.applyModelEvents(event.payload);
  };

  /**
   * Adds a grid model to this layout group.
   * @param gridModel The grid model to add
   * @returns True if the model was added successfully
   */
  addGridModel(gridModel: GridModel): boolean {
    gridModel.eventHub?.on(TSU.Events.EventHub.BATCH_EVENTS, this.eventHandler);
    this.gridModels.push(gridModel);
    return true;
  }

  /**
   * Gets all row alignment objects that have no predecessors.
   * @returns An array of starting row alignments
   */
  startingRowAligns(): RowAlign[] {
    const out = [] as RowAlign[];
    const visited = {} as any;
    for (const gm of this.gridModels) {
      for (const cell of gm.cellsInRow(gm.firstRow)) {
        if (cell.rowAlign && !visited[cell.rowAlign.uuid]) {
          visited[cell.rowAlign.uuid] = true;
          out.push(cell.rowAlign);
        }
      }
    }
    return out;
  }

  /**
   * Gets all column alignment objects that have no predecessors.
   * @returns An array of starting column alignments
   */
  startingColAligns(): ColAlign[] {
    const out = [] as ColAlign[];
    const visited = {} as any;
    for (const gm of this.gridModels) {
      for (const cell of gm.cellsInCol(gm.firstCol)) {
        if (cell.colAlign && !visited[cell.colAlign.uuid]) {
          visited[cell.colAlign.uuid] = true;
          out.push(cell.colAlign);
        }
      }
    }
    return out;
  }

  /**
   * Removes a grid model from this layout group.
   * @param gridModel The grid model to remove
   */
  removeGridModel(gridModel: GridModel): void {
    gridModel.eventHub?.removeOn(TSU.Events.EventHub.BATCH_EVENTS, this.eventHandler);
  }

  /**
   * Function to get a view for a cell value.
   */
  getCellView: (cell: GridCell) => GridCellView;

  /**
   * Gets the starting row alignments.
   */
  get startingRows(): RowAlign[] {
    return this.startingRowAligns();
  }

  /**
   * Gets the starting column alignments.
   */
  get startingCols(): ColAlign[] {
    return this.startingColAligns();
  }

  /**
   * Forces a full refresh of the layout.
   * This recalculates all row and column sizes and positions.
   * @param notify Whether to notify subscribers of the change (default: true)
   */
  refreshLayout(notify = true): void {
    const changedRowAligns = {} as any;
    const changedColAligns = {} as any;

    for (const rowAlign of this.startingRowAligns()) {
      if (!(rowAlign.uuid in changedRowAligns)) {
        changedRowAligns[rowAlign.uuid] = {
          align: rowAlign,
          cells: [],
        };
      }
    }

    for (const colAlign of this.startingColAligns()) {
      if (!(colAlign.uuid in changedColAligns)) {
        changedColAligns[colAlign.uuid] = {
          align: colAlign,
          cells: [],
        };
      }
    }

    this.doBfsLayout(this.startingRows, changedRowAligns);
    this.doBfsLayout(this.startingCols, changedColAligns);

    // Notify subscribers of full refresh
    if (notify && this.layoutChangeSubscribers.size > 0) {
      this.notifyLayoutChange({
        affectedRowRange: null, // null means all rows
        affectedColRange: null, // null means all columns
        columnWidthsChanged: true,
        rowHeightsChanged: true,
        affectedGridModels: this.gridModels,
      });
    }
  }

  /**
   * Applies model events to update the layout.
   * @param events The events to process
   */
  protected applyModelEvents(events: TSU.Events.TEvent[]): void {
    // As the grid model changes (cell content changed, cleared etc) we need
    // to refresh our layout based on this.
    // As a first step the new height and width of all changed cells is
    // evaluted to see which rows and/or columns are affected (and need to be
    // resized/repositioned).
    const [changedRowAligns, changedColAligns, affectedGridModels] = this.changesForEvents(events);
    const hadRowChanges = Object.keys(changedRowAligns).length > 0;
    const hadColChanges = Object.keys(changedColAligns).length > 0;

    this.doBfsLayout(this.startingRows, changedRowAligns);
    this.doBfsLayout(this.startingCols, changedColAligns);

    // Notify subscribers of incremental changes
    if (this.layoutChangeSubscribers.size > 0 && (hadRowChanges || hadColChanges)) {
      // Calculate affected ranges from the changed alignments
      const affectedRowRange = this.calculateAffectedRowRange(changedRowAligns);
      const affectedColRange = this.calculateAffectedColRange(changedColAligns);

      this.notifyLayoutChange({
        affectedRowRange,
        affectedColRange,
        columnWidthsChanged: hadColChanges,
        rowHeightsChanged: hadRowChanges,
        affectedGridModels: affectedGridModels,
      });
    }
  }

  /**
   * Calculates the range of affected rows from changed row alignments.
   * Returns null if no rows changed or range cannot be determined.
   */
  protected calculateAffectedRowRange(changedRowAligns: any): { start: number; end: number } | null {
    let minRow = Infinity;
    let maxRow = -Infinity;

    for (const alignId in changedRowAligns) {
      const { cells } = changedRowAligns[alignId];
      for (const cell of cells) {
        const rowIndex = cell.gridRow.rowIndex;
        minRow = Math.min(minRow, rowIndex);
        maxRow = Math.max(maxRow, rowIndex);
      }
    }

    if (minRow === Infinity) return null;
    return { start: minRow, end: maxRow };
  }

  /**
   * Calculates the range of affected columns from changed column alignments.
   * Returns null if no columns changed or range cannot be determined.
   */
  protected calculateAffectedColRange(changedColAligns: any): { start: number; end: number } | null {
    let minCol = Infinity;
    let maxCol = -Infinity;

    for (const alignId in changedColAligns) {
      const { cells } = changedColAligns[alignId];
      for (const cell of cells) {
        const colIndex = cell.colIndex;
        minCol = Math.min(minCol, colIndex);
        maxCol = Math.max(maxCol, colIndex);
      }
    }

    if (minCol === Infinity) return null;
    return { start: minCol, end: maxCol };
  }

  /**
   * Determines which rows and columns need to be updated based on events.
   * @param events The events to process
   * @returns A tuple containing the changed row alignments, column alignments, and affected grid models
   */
  protected changesForEvents(events: TSU.Events.TEvent[]): [any, any, GridModel[]] {
    // Step 1 - topologically sort RowAligns of changed cells
    // Step 2 - topologically sort ColAligns of changed cells
    // Step 3 -
    const cellVisited = {} as any;
    const changedRowAligns = {} as any;
    const changedColAligns = {} as any;
    const affectedGridModelsSet = new Set<GridModel>();
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
      const gridModel = event.source as GridModel;
      affectedGridModelsSet.add(gridModel);
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
    return [changedRowAligns, changedColAligns, Array.from(affectedGridModelsSet)];
  }

  /**
   * Ensures that a cell view getter function is available for an alignment.
   * @param align The alignment to check
   * @returns The cell view getter function
   */
  protected ensureGetCellView(align: AlignedLine) {
    if (!align.getCellView) {
      if (!this.getCellView) {
        return null;
      }
      align.getCellView = this.getCellView;
    }
    return align.getCellView;
  }

  /**
   * Performs a breadth-first layout of aligned lines.
   * @param startingLines The lines to start from
   * @param changedAligns Map of alignment IDs to changed alignments
   */
  protected doBfsLayout<T extends AlignedLine>(startingLines: T[], changedAligns: any) {
    // 1. start from the starting lines and do a BF traversal
    // 2. If a line not visited (ie laid out):
    //      if it is in the changedAlign list then reval its length (w/h)
    //      set its offset and length if either width or offset has changed
    //      offset can be thought of changed if the preceding line's offset has changed
    // first do above for rows
    if (!this.getCellView) return;
    for (const alignId in changedAligns) {
      const val = changedAligns[alignId];
      this.ensureGetCellView(val.align);
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
        let newOffset = lineAlign.coordOffset;
        let lineChanged = lineAlign.uuid in changedAligns;
        if (prevLineAlign) {
          if (lineOffsetChanged[prevLineAlign.uuid]) {
            newOffset = prevLineAlign.coordOffset + prevLineAlign.maxLength;
            lineChanged = true;
          }
        }
        if (lineChanged) {
          this.ensureGetCellView(lineAlign);
          lineAlign.setOffset(newOffset);
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
