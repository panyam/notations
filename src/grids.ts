import * as TSU from "@panyam/tsutils";

/**
 * A sparse array type which is optimized for "holes" while not penalizing
 * runs of values.
 */
export class SparseArray<T> {
  runs: [number, T[]][] = [];

  valueAt(index: number): T | null {
    return null;
  }

  setAt(index: number, ...values: (T | null)[]): T | null {
    return null;
  }

  removeAt(index: number, count = 1): T | null {
    return null;
  }

  get length(): number {
    return 0;
  }

  splice(index: number, numToDelete: number, ...valuesToInsert: (T | null)[]) {
    //
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
export class GridView<T> {
  rows: GridRow<T>[] = [];
  cols: GridCol<T>[] = [];

  setValue(row: number, col: number, value: T | null): T | null {
    const gridCol = this.cols[col];
    const gridRow = this.rows[row];
    const oldRowVal = gridCol.valueAt(row);
    const oldColVal = gridRow.valueAt(col);
    if (oldRowVal != oldColVal) {
      // these *should* be the same object
      throw new Error("Value in col and row should be the same");
    }
    gridCol.setAt(row, value);
    gridRow.setAt(col, value);
    return oldRowVal;
  }

  /**
   * Add a new column at the given index.
   */
  addColumn(insertBefore = -1): GridCol<T> {
    let index = insertBefore;
    if (index < 0) {
      index = this.cols.length;
    }
    const out = new GridCol<T>(index);
    this.cols.splice(index, 0, out);
    for (let i = index + 1; i < this.cols.length; i++) {
      this.cols[i].index = i;
    }
    return out;
  }

  /**
   * Add a new row at the given index.
   */
  addRow(insertBefore = -1): GridRow<T> {
    let index = insertBefore;
    if (index < 0) {
      index = this.rows.length;
    }
    const out = new GridRow<T>(index);
    this.rows.splice(index, 0, out);
    for (let i = index + 1; i < this.cols.length; i++) {
      this.rows[i].index = i;
    }
    return out;
  }

  /**
   * Get the column at the given location.
   */
  getColumn(col: number): GridCol<T> | null {
    return this.cols[col] || null;
  }

  /**
   * Get the row at the given location.
   */
  getRow(row: number): GridRow<T> | null {
    return this.rows[row] || null;
  }
}

export class GridRow<T> extends SparseArray<T> {
  protected _y = 0;
  protected _maxHeight = 0;
  needsLayout = false;
  paddingTop = 15;
  paddingBottom = 15;
  values = new SparseArray<T>();

  constructor(public index: number) {
    super();
  }

  get y(): number {
    return this._y;
  }

  /**
   * Get the maximum height of the row.
   */
  get maxHeight(): number {
    return this._maxHeight + this.paddingTop + this.paddingBottom;
  }

  setPadding(top: number, bottom: number): void {
    if (top >= 0) {
      this.paddingTop = top;
    }
    if (bottom >= 0) {
      this.paddingBottom = bottom;
    }
  }
}

export class GridCol<T> extends SparseArray<T> {
  protected _x = 0;
  protected _maxWidth = 0;
  needsLayout = false;
  paddingLeft = 15;
  paddingRight = 15;
  values = new SparseArray<T>();

  constructor(public index: number) {
    super();
  }

  get x(): number {
    return this._x;
  }

  /**
   * Return the maximum width of a particular column.
   */
  get maxWidth(): number {
    return this._maxWidth + this.paddingLeft + this.paddingRight;
  }

  setMaxWidth(width: number) {
    this._maxWidth = width;
  }

  setPadding(left: number, right: number): void {
    if (left >= 0) {
      this.paddingLeft = left;
    }
    if (right >= 0) {
      this.paddingRight = right;
    }
  }
}
