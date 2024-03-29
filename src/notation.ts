import * as TSU from "@panyam/tsutils";
import { Entity } from "./entity";
import { Cycle } from "./cycle";
import { Line } from "./core";
import { LayoutParams } from "./layouts";

export class RoleDef {
  name = "";
  notesOnly = false;
  index = 0;
}

export type CmdParam = { key: TSU.Nullable<string>; value: any };
export abstract class Command extends Entity {
  // Commands that are auto generated are usually created by other commands
  autoGenerated = false;
  prevSibling: null | Command = null;
  nextSibling: null | Command = null;
  params: CmdParam[];
  index: number;

  constructor(params: CmdParam[] = []) {
    super();
    this.params = params;
    this.index = 0;
    this.validateParams();
  }

  /**
   * called to validate parameters.
   */
  validateParams(): void {
    //
  }

  get name(): string {
    return this.constructor.name;
  }

  debugValue(): any {
    return { name: this.name, index: this.index, params: this.params };
  }

  getParam(name: string): any {
    for (const param of this.params) {
      if (param.key == name) return param.value;
    }
    return null;
  }

  getParamAt(index: number): any {
    return index < this.params.length ? this.params[index].value : null;
  }
  abstract applyToNotation(notebook: Notation): void;
}

export class RawBlock extends Entity {
  readonly TYPE: string = "RawBlock";
  constructor(public content: string, public contentType: string = "md") {
    super();
  }

  debugValue(): any {
    return { ...super.debugValue(), content: this.content, contentType: this.contentType };
  }
}

export class MetaData {
  constructor(public readonly key: string, public readonly value: string, public readonly params?: any) {
    params = params || {};
  }
}

export class Notation extends Entity {
  readonly TYPE = "Notation";
  private _unnamedLayoutParams: LayoutParams[] = [];
  private _namedLayoutParams = new Map<string, LayoutParams>();
  private _currRoleDef: TSU.Nullable<RoleDef> = null;
  roles: RoleDef[] = [];
  blocks: (Line | RawBlock)[] = [];
  currentAPB = 1;
  currentCycle: Cycle = Cycle.DEFAULT;
  currentBreaks: number[] = [];
  metadata = new Map<string, MetaData>();
  onMissingRole: (name: string) => RoleDef | null = (name) => this.newRoleDef(name, name == "sw");

  get unnamedLayoutParams(): ReadonlyArray<LayoutParams> {
    return this._unnamedLayoutParams;
  }

  get namedLayoutParams(): ReadonlyMap<string, LayoutParams> {
    return this._namedLayoutParams;
  }

  addLine(line: Line): void {
    this.blocks.push(line);
  }

  removeLine(line: Line): number {
    const index = this.blocks.findIndex((l) => l == line);
    if (index >= 0) {
      this.blocks.splice(index, 1);
    }
    return index;
  }

  addRawBlock(raw: RawBlock): void {
    this.blocks.push(raw);
    this.resetLine();
  }

  addMetaData(meta: MetaData): void {
    if (!this.metadata.has(meta.key)) {
      // Add a new raw block here
      // set this by key so even if metadata changes we can
      // get latest value of it
      const raw = new RawBlock(meta.key, "metadata");
      this.addRawBlock(raw);
    }
    this.metadata.set(meta.key, meta);
  }

  debugValue(): any {
    return {
      ...super.debugValue,
      roles: this.roles,
      blocks: this.blocks.map((b) => b.debugValue()),
      currentAPB: this.currentAPB,
      currentCycle: this.currentCycle?.uuid,
      currentBreaks: this.currentBreaks,
    };
  }

  getRoleDef(name: string): TSU.Nullable<RoleDef> {
    name = name.trim().toLowerCase();
    if (name == "") {
      return this.roles[this.roles.length - 1] || null;
    }
    for (let i = 0; i < this.roles.length; i++) {
      const rd = this.roles[i];
      if (name == rd.name) return rd;
    }
    return null;
  }

  newRoleDef(name: string, notesOnly = false): RoleDef {
    name = name.trim().toLowerCase();
    if (name.trim() == "") {
      throw new Error("Role name cannot be empty");
    }
    const roleDef = this.getRoleDef(name);
    if (roleDef != null) {
      throw new Error("Role already exists");
      // roleDef.notesOnly = notesOnly;
      // return roleDef;
    }
    // create new and add
    const rd = new RoleDef();
    rd.name = name;
    rd.notesOnly = notesOnly;
    rd.index = this.roles.length;
    this.roles.push(rd);

    return rd;
  }

  get currRoleDef(): RoleDef | null {
    if (this._currRoleDef == null) {
      if (this.roles.length == 0) {
        return null;
      } else {
        this._currRoleDef = this.roles[this.roles.length - 1];
      }
    }
    return this._currRoleDef;
  }

  setCurrRole(name: string): void {
    name = name.trim().toLowerCase();
    if (name.trim() == "") {
      throw new Error("Role name cannot be empty");
    }
    const roleDef = this.getRoleDef(name) || (this.onMissingRole ? this.onMissingRole(name) || null : null);
    if (roleDef == null) {
      throw new Error("Role not found: " + name);
    }
    this._currRoleDef = roleDef;
  }

  // Gets the current line, creating it if needed
  private _currentLine: Line | null = null;
  get currentLine(): Line {
    if (this._currentLine == null) {
      return this.newLine();
    }
    return this._currentLine;
  }

  resetLine(): void {
    this._currentLine = null;
  }

  newLine(): Line {
    if (this._currentLine && this._currentLine.isEmpty) {
      // then remove it first instead of adding another
      // so we dont have a string of empty lines
      this.removeLine(this._currentLine);
    }
    this._currentLine = new Line();
    this.addLine(this._currentLine);
    return this._currentLine;
  }

  private _layoutParams: LayoutParams | null = null;
  resetLayoutParams(): void {
    this._layoutParams = null;
    this.resetLine();
  }

  get layoutParams(): LayoutParams {
    if (this._layoutParams == null) {
      // create it or find one that matches current params
      this._layoutParams = this.findUnnamedLayoutParams();
      if (this._layoutParams == null) {
        this._layoutParams = this.snapshotLayoutParams();
        this._unnamedLayoutParams.push(this._layoutParams);
      }
    }
    return this._layoutParams;
  }

  ensureNamedLayoutParams(name: string): LayoutParams {
    let lp = this._namedLayoutParams.get(name) || null;
    if (lp == null || this._layoutParams != lp) {
      // no change so go ahead
      if (lp == null) {
        // does not exist so create one by re-snapshotting it
        // and saving it
        lp = this.snapshotLayoutParams();
        this._namedLayoutParams.set(name, lp);
      } else {
        // copy named LPs attributes into our locals
        this.currentCycle = lp.cycle;
        this.currentAPB = lp.beatDuration;
        this.currentBreaks = lp.lineBreaks;
      }
      this._layoutParams = lp;
      this.resetLine(); // since layout params have changed
    }
    return this._layoutParams;
  }

  protected snapshotLayoutParams(): LayoutParams {
    return new LayoutParams({
      cycle: this.currentCycle,
      beatDuration: this.currentAPB,
      layout: this.currentBreaks,
    });
  }

  /**
   * Find a layout params that is currently _unnamed but matches one
   * by current set of layout attributes.
   */
  protected findUnnamedLayoutParams(): LayoutParams | null {
    return (
      this._unnamedLayoutParams.find((lp) => {
        return (
          lp.beatDuration == this.currentAPB &&
          this.currentCycle.equals(lp.cycle) &&
          lp.lineBreaksEqual(this.currentBreaks)
        );
      }) || null
    );
  }
}
