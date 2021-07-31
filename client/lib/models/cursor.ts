import * as TSU from "@panyam/tsutils";

export interface Cursor {
  readonly id: string;
  readonly indexes: ReadonlyArray<number>;
}

export class DefaultCursor implements Cursor {
  private static counter = 0;
  readonly id: string = "" + DefaultCursor.counter++;
  indexes: number[] = [];

  constructor(...indexes: number[]) {
    this.indexes = [...indexes];
  }

  clone(): DefaultCursor {
    return new DefaultCursor(...this.indexes);
  }

  top(newVal: TSU.Nullable<number> = null): number {
    if (this.indexes.length == 0) {
      if (newVal != null) {
        this.indexes.push(newVal);
      } else {
        throw new Error("Cursor is not deep enough.");
      }
    } else if (newVal != null) {
      this.indexes[this.indexes.length - 1] = newVal;
    }
    return this.indexes[this.indexes.length - 1];
  }

  push(val: number): void {
    this.indexes.push(val);
  }

  pop(): number {
    if (this.indexes.length < 1) {
      throw new Error("Cursor is not deep enough.");
    }
    return this.indexes.pop() as number;
  }

  cmp(another: Cursor): number {
    let i = 0;
    const otherIP = another.indexes;
    for (; i < this.indexes.length; i++) {
      if (i > otherIP.length) return 1;
      const diff = this.indexes[i] - otherIP[i];
      if (diff != 0) return diff;
    }
    if (i < otherIP.length) return -1;
    return 0;
  }
}
