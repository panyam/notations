import * as TSU from "@panyam/tsutils";
import { Entity, Line } from "../models";
import { KeyedEnv } from "./env";

export const CURSOR_START = -1;

export type CmdParam = { key: TSU.Nullable<string>; value: any };

export interface Cursor {
  readonly id: string;
  readonly indexes: ReadonlyArray<number>;
}

class DefaultCursor implements Cursor {
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

/**
 * A snippet notebook shared by all snippets on a document.
 */
export class Notebook extends Entity {
  private _lines: Line[] = [];
  private _snippets: Snippet[] = [];

  /**
   * Cursors in our Notebook.
   *
   * There are a few constraints/invariants these must satisfy.
   *
   * 1. All cursors must always be in sorted order.
   * 2. When items are inserted or deleted at a particular cursor,
   *    any subsequent cursors that share a common ancestor will be
   *    "nudged" or "pulled in" at the common ancestor.
   *
   *    For example, if our tree was (A = Score, B = Section, C = Line):
   *
   *                                  N
   *                A0                A1                        A2
   *     B0         B1     B2        B0     B1     B2      B0     B1
   *  C0 C1 C2  C0  C1 C2  _      C0 C1 C2  _   C0 C1 C2   _   C0 C1 C2
   *
   *  If we had the following cursors (sorted by pre order locations):
   *
   *  0. N (start cursor)
   *  1. N.A0.B0.C1
   *  2. N.A0.B0.C2
   *  3. N.A0.B1.C2
   *  4. N.A1.B0.C2
   *  5. N.A1.B1.-1
   *  6. N.A2.B1.C1
   *
   *  If a Score (A1') was added after cursor 4 then A1' will be "between"
   *  A1 and A2.  This would result in all cursors from 4 onwards
   *  shited to accomodate this.  However only the "level" at which this
   *  nudging happens would only be at level 1 (of A) for all cursors that
   *  share the same parent as that was where the insertion had occured.
   *
   *  As another example if a Section (B0') was added at cursor
   */
  private _cursors: DefaultCursor[] = [];

  get type(): unknown {
    return "Notebook";
  }

  get lines(): ReadonlyArray<Line> {
    return this._lines;
  }

  get cursors(): ReadonlyArray<Cursor> {
    return this._cursors;
  }

  get snippets(): ReadonlyArray<Snippet> {
    return this._snippets;
  }

  children(): Entity[] {
    return this._lines;
  }

  private toInternalCursor(atCursor: Cursor): DefaultCursor {
    const cursorIndex = this.indexOfCursor(atCursor);
    return this._cursors[cursorIndex];
  }

  /**
   * Return a new cursor after a given cursor.
   * If this is not provided then a cursor at the "end" of the notebook
   * is created and returned
   */
  newCursor(pos?: Cursor, after = true): Cursor {
    const index = pos ? this.indexOfCursor(pos) : this._cursors.length - 1;
    const c2 = index >= 0 ? this._cursors[index].clone() : new DefaultCursor(CURSOR_START);
    this._cursors.splice(after ? index + 1 : index, 0, c2);
    return c2;
  }

  cursorAtEntity(entity: Entity, createAlways = false): TSU.Nullable<Cursor> {
    const indexes: number[] = [entity.childCount - 1];
    let curr: TSU.Nullable<Entity> = entity.parent;
    while (curr != null) {
      const parent = curr.parent;
      if (parent != null) {
        const index = parent.indexOfChild(curr);
        indexes.splice(0, 0, index);
      }
      curr = parent;
    }
    const cursor = new DefaultCursor(...indexes);
    let i = 0;
    while (i < this._cursors.length) {
      const cmp = cursor.cmp(this._cursors[i]);
      if (cmp == 0 && !createAlways) {
        return this._cursors[i];
      } else if (cmp < 0) {
        // None found so create new?
        break;
      }
      i++;
    }
    this._cursors.splice(i, 0, cursor);
    return cursor;
  }

  /**
   * Remove a given cursor.
   */
  removeCursor(cursor: Cursor): void {
    const index = this.indexOfCursor(cursor, false);
    if (index >= 0) {
      this._cursors.splice(index, 1);
    }
  }

  /**
   * Returns the index of a particular cursor.
   */
  indexOfCursor(cursor: Cursor, ensure = true): number {
    return TSU.Misc.firstIndexOf(this._cursors, (c) => c.id == cursor.id, 0, ensure);
  }

  /**
   * Insert an entity at the cursor.
   */
  insertAt<C extends Entity>(atCursor: Cursor, child: C, parentType: unknown): void {
    const cursorIndex = this.indexOfCursor(atCursor);
    const cursor = this._cursors[cursorIndex];
    const estack = this.popUntil(cursor, parentType);
    const parent = estack[estack.length - 1];
    const top = cursor.top();

    // Add a child at this spot
    parent.addChild(child, top + 1);

    // increment the value on top
    cursor.top(Math.min(top + 1, parent.childCount));
    estack.push(child);
    cursor.indexes.push(CURSOR_START);

    // push all indexes after this one out
  }

  insertLine(cursor: Cursor, line: Line): void {
    return this.insertAt(cursor, line, "Notebook");
  }

  // Ensure that a Line exists at the cursor by
  // adding a Line if required and updating the cursor
  // accordingly
  ensureLine(atCursor: Cursor): Line {
    const cursor = this.toInternalCursor(atCursor);
    const estack = this.popUntil(cursor, "Line", "Notebook");
    const parent = estack[estack.length - 1];
    if (parent.type == "Line") {
      return parent as Line;
    }
    // Create otherwise
    const s = new Line();
    this.insertLine(cursor, s);
    return s;
  }

  /**
   * Ensures a new snippet starting at the current cursor.
   */
  newSnippet(): Snippet {
    const out = new Snippet(this);
    let last: TSU.Nullable<Snippet> = null;
    if (this._snippets.length > 0) {
      last = this._snippets[this._snippets.length - 1];
    }
    out.prevSnippet = last;
    if (last != null) {
      last.nextSnippet = out;
      out.cursor = this.newCursor(last.cursor);
    } else {
      out.cursor = this.newCursor();
    }
    this._snippets.push(out);
    return out;
  }

  /**
   * Returns the index of a snippet.
   */
  indexOfSnippet(snippet: Snippet, ensure = true): number {
    return TSU.Misc.firstIndexOf(this._snippets, (c) => c.uuid == snippet.uuid, 0, ensure);
  }

  clear() {
    this._snippets = [];
    this._cursors = [];
  }

  /**
   * Removes a given snippet and clears its cursors.
   */
  removeSnippet(snippet: Snippet): void {
    const prev = snippet.prevSnippet;
    const next = snippet.nextSnippet;
    this.removeCursor(snippet.cursor);
    this._snippets.splice(this.indexOfSnippet(snippet), 1);
    if (prev != null) prev.nextSnippet = next;
    if (next != null) next.prevSnippet = prev;
    snippet.prevSnippet = snippet.nextSnippet = null;
  }

  /**
   * Here the entity stack and cursor must be of equal depth.
   * C[x] is the index of the child "after" which the next element will be
   * added in E[x].
   */
  private popUntil(cursor: DefaultCursor, ...eTypes: unknown[]): Entity[] {
    const estack = this.entityStackFor(cursor);
    if (estack.length != cursor.indexes.length) {
      throw new Error("Entity stack and cursor lengths not equal.");
    }
    while (estack.length > 0) {
      const top = estack[estack.length - 1];
      if (eTypes.findIndex((eType) => eType == top.type) >= 0) break;
      estack.pop();
      cursor.pop();
    }
    if (estack.length == 0) {
      throw new Error(`Entity stack is empty.  No parent found matching: ${eTypes}`);
    }
    return estack;
  }

  private entityStackFor(cursor: DefaultCursor): Entity[] {
    let curr: Entity = this as Entity;
    const out: Entity[] = [curr];
    let child: TSU.Nullable<Entity> = null;
    for (let i = 1; i < cursor.indexes.length; i++) {
      const index = cursor.indexes[i - 1];
      child = curr.childAt(index);
      if (child == null) {
        throw new Error(`Invalid Cursor: [${cursor.indexes}] at index ${i}`);
      }
      out.push(child);
      curr = child;
    }
    return out;
  }
}

export class Role {
  name = "";
  notesOnly = false;
  index = 0;
}

/**
 * Our scores are not "first class" documents.  Instead
 * scores are usually embedded in another document (html, md
 * docx etc).  By virtual of being embedded, a score can be
 * broken up into multiple parts that themselves could look
 * like mini scores.  These parts are Snippets and can be thought
 * of as a grouping of entities for rendering/viewing purposes.
 *
 * In this regard Snippets are not data but _instructions on how
 * to view and manipulate the document.
 */
export class Snippet {
  private static counter = 0;
  readonly uuid: string = "" + Snippet.counter++;
  private _currRole: TSU.Nullable<Role> = null;
  readonly notebook: Notebook;
  private _instructions: Instruction[] = [];
  cursor: Cursor;
  roles: Role[] = [];
  readonly locals = new KeyedEnv();
  readonly properties = new KeyedEnv();
  private _prevSnippet: TSU.Nullable<Snippet> = null;
  nextSnippet: TSU.Nullable<Snippet> = null;

  constructor(notebook: Notebook) {
    this.notebook = notebook;
  }

  get prevSnippet(): TSU.Nullable<Snippet> {
    return this._prevSnippet;
  }

  set prevSnippet(snippet: TSU.Nullable<Snippet>) {
    if (this == snippet) {
      throw new Error("wtf");
    }
    if (snippet != this._prevSnippet) {
      if (this._prevSnippet != null) {
        this._prevSnippet.nextSnippet = null;
      }
      this._prevSnippet = snippet;
      this.properties.parent = null;
      if (this.prevSnippet != null) {
        this.properties.parent = this.prevSnippet.properties;
      }
    }
  }

  getRole(name: string): [TSU.Nullable<Role>, TSU.Nullable<Snippet>] {
    name = name.trim().toLowerCase();
    if (name == "") {
      return [this.roles[this.roles.length - 1] || null, this];
    }
    for (let i = 0; i < this.roles.length; i++) {
      const rd = this.roles[i];
      if (name == rd.name) return [rd, this];
    }
    if (this.prevSnippet) {
      return this.prevSnippet.getRole(name);
    }
    return [null, null];
  }

  newRole(name: string, notesOnly = false): Role {
    name = name.trim().toLowerCase();
    if (name.trim() == "") {
      throw new Error("Role name cannot be empty");
    }
    const [roleDef, snippet] = this.getRole(name);
    if (roleDef != null) {
      if (snippet == this) {
        // then replace it
        roleDef.notesOnly = notesOnly;
        return roleDef;
      }
      // throw new Error(`Role ${name} already exists`);
    }
    // create new and add
    const rd = new Role();
    rd.name = name;
    rd.notesOnly = notesOnly;
    rd.index = this.roles.length;
    this.roles.push(rd);

    return rd;
  }

  get currRole(): Role {
    if (this._currRole == null) {
      if (this.roles.length == 0) {
        if (this.prevSnippet == null) {
          throw new Error("No roles defined");
        } else {
          return this.prevSnippet.currRole;
        }
      } else {
        this._currRole = this.roles[this.roles.length - 1];
      }
    }
    return this._currRole;
  }

  setCurrRole(name: string): void {
    name = name.trim().toLowerCase();
    if (name.trim() == "") {
      throw new Error("Role name cannot be empty");
    }
    const [roleDef, snippet] = this.getRole(name);
    if (roleDef == null) {
      throw new Error("Role not found: " + name);
    }
    this._currRole = roleDef;
  }

  get instructions(): ReadonlyArray<Instruction> {
    return this._instructions;
  }

  /**
   * To be called when ever we want to restart executions
   * from the first isntruction all over again so we are
   * starting from a "clean slate".
   */
  reset(): void {
    this.locals.clear();
    this.properties.clear();
    this.roles = [];
  }

  add(instr: Instruction): void {
    instr.index = this._instructions.length;
    this._instructions.push(instr);
    // And execute it too to begin parsing
    instr.execute(this);
  }

  execute(): void {
    this.reset();
    for (const cmd of this._instructions) {
      cmd.execute(this);
    }
  }
}

export interface Instruction {
  index: number;
  readonly name: string;
  execute(snippet: Snippet): void;
}

export class Command implements Instruction {
  params: CmdParam[];
  index: number;

  get name(): string {
    throw new Error("Implement name");
  }

  constructor(params: CmdParam[] = []) {
    this.params = params;
    this.index = 0;
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

  execute(snippet: Snippet) {
    // Does nothing
  }
}

/**
 * Instructions in general update state of the Notebook and our
 * document.  Emitters are kinds of instruction that can affect
 * the world outside the Snippet via events.
 */
export class Emitter extends Command {}
