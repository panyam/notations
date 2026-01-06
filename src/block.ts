import * as TSU from "@panyam/tsutils";
import { Entity } from "./entity";
import { Cycle } from "./cycle";
import { Line } from "./core";
import { LayoutParams } from "./layouts";

/**
 * Definition of a role in a block context.
 * This is used for block-scoped role definitions.
 */
export class RoleDef {
  /** Name of the role */
  name = "";

  /** Whether this role contains only notes (true) or can also contain syllables/text (false) */
  notesOnly = false;

  /** Index of this role in the notation */
  index = 0;
}

/**
 * Represents a raw block of content in the notation.
 * Raw blocks can contain arbitrary content like markdown, HTML, etc.
 */
export class RawBlock extends Entity {
  readonly TYPE: string = "RawBlock";

  /**
   * Creates a new RawBlock.
   * @param content The content of the block
   * @param contentType The type of content (e.g., "md" for markdown)
   */
  constructor(
    public content: string,
    public contentType: string = "md",
  ) {
    super();
  }

  /**
   * Returns a debug-friendly representation of this raw block.
   * @returns An object containing debug information
   */
  debugValue(): any {
    return { ...super.debugValue(), content: this.content, contentType: this.contentType };
  }
}

/**
 * Union type for items that can appear in a block.
 */
export type BlockItem = Block | Line | RawBlock;

/**
 * Type guard to check if an entity is a Block.
 */
export function isBlock(item: BlockItem): item is Block {
  return item.TYPE === "Block";
}

/**
 * Type guard to check if an entity is a Line.
 */
export function isLine(item: BlockItem): item is Line {
  return item.TYPE === "Line";
}

/**
 * Type guard to check if an entity is a RawBlock.
 */
export function isRawBlock(item: BlockItem): item is RawBlock {
  return item.TYPE === "RawBlock";
}

/**
 * Represents a scoped block created by a command with braces.
 * For example: \section("Pallavi") { ... }
 *
 * Blocks inherit properties from their parent Block and can override them locally.
 * Properties are resolved lazily by walking up the tree.
 *
 * Block = Command + Children (unified model)
 */
export class Block extends Entity {
  readonly TYPE: string = "Block";

  /** The type of block (e.g., "section", "repeat", "cycle") */
  readonly blockType: string;

  /** Optional name for the block (e.g., section name) */
  readonly name: TSU.Nullable<string>;

  /** Child items (before expansion by subclasses) */
  readonly blockItems: BlockItem[] = [];

  // Local properties
  localCycle: TSU.Nullable<Cycle> = null;
  localAtomsPerBeat: TSU.Nullable<number> = null;
  localBreaks: TSU.Nullable<number[]> = null;
  readonly localRoles = new Map<string, RoleDef>();

  // Store parent reference (Block or null for root)
  private _parentBlock: TSU.Nullable<Block> = null;

  // State tracking for command application (protected for Notation override)
  protected _currRoleDef: TSU.Nullable<RoleDef> = null;
  protected _currentLine: TSU.Nullable<Line> = null;

  /**
   * Creates a new Block.
   * @param blockType The type of block (e.g., "section", "group")
   * @param parent The parent block (null for root)
   * @param name Optional name for the block
   */
  constructor(blockType: string, parent: TSU.Nullable<Block> = null, name: TSU.Nullable<string> = null) {
    super();
    this.blockType = blockType;
    this.name = name;
    this._parentBlock = parent;
    // Also set Entity's parent for tree traversal
    if (parent) {
      this.setParent(parent);
    }
  }

  /**
   * Returns the expanded children for layout iteration.
   * Subclasses can override this to transform children (e.g., Repeat, Section).
   */
  children(): BlockItem[] {
    return this.blockItems;
  }

  /**
   * Gets the parent block.
   */
  get parentBlock(): TSU.Nullable<Block> {
    return this._parentBlock;
  }

  // ============================================
  // Property inheritance via tree walking
  // ============================================

  /**
   * Gets the effective cycle by walking up the tree.
   */
  get cycle(): TSU.Nullable<Cycle> {
    if (this.localCycle !== null) {
      return this.localCycle;
    }
    return this.parentBlock?.cycle ?? null;
  }

  /**
   * Gets the effective atoms per beat by walking up the tree.
   * Defaults to 1 if not set anywhere in the tree.
   */
  get atomsPerBeat(): number {
    if (this.localAtomsPerBeat !== null) {
      return this.localAtomsPerBeat;
    }
    return this.parentBlock?.atomsPerBeat ?? 1;
  }

  /**
   * Gets the effective line breaks by walking up the tree.
   * Defaults to empty array if not set anywhere.
   */
  get breaks(): number[] {
    if (this.localBreaks !== null) {
      return this.localBreaks;
    }
    return this.parentBlock?.breaks ?? [];
  }

  // ============================================
  // Layout parameters management
  // ============================================

  /** Layout parameters caching for this block scope */
  private _unnamedLayoutParams: LayoutParams[] = [];
  private _namedLayoutParams = new Map<string, LayoutParams>();
  private _layoutParams: LayoutParams | null = null;

  /**
   * Gets the unnamed layout parameters for this block.
   */
  get unnamedLayoutParams(): ReadonlyArray<LayoutParams> {
    return this._unnamedLayoutParams;
  }

  /**
   * Gets the named layout parameters for this block.
   */
  get namedLayoutParams(): ReadonlyMap<string, LayoutParams> {
    return this._namedLayoutParams;
  }

  /**
   * Gets the current layout parameters for this block scope.
   * Uses the effective cycle, atomsPerBeat, and breaks from tree walking.
   * Creates or finds a matching LayoutParams if needed.
   */
  get layoutParams(): LayoutParams {
    if (this._layoutParams == null) {
      // Find or create layout params matching current effective values
      this._layoutParams = this.findUnnamedLayoutParams();
      if (this._layoutParams == null) {
        this._layoutParams = this.snapshotLayoutParams();
        this._unnamedLayoutParams.push(this._layoutParams);
      }
    }
    return this._layoutParams;
  }

  /**
   * Resets the current layout parameters to null.
   * Called when layout-affecting properties change.
   */
  resetLayoutParams(): void {
    this._layoutParams = null;
    this.resetLine();
  }

  /**
   * Creates a snapshot of the current layout parameters.
   * @returns A new LayoutParams object with the current effective settings
   */
  protected snapshotLayoutParams(): LayoutParams {
    const effectiveCycle = this.cycle;
    if (effectiveCycle == null) {
      throw new Error("Cannot create layout params: no cycle defined");
    }
    return new LayoutParams({
      cycle: effectiveCycle,
      beatDuration: this.atomsPerBeat,
      layout: this.breaks,
    });
  }

  /**
   * Finds an unnamed layout parameters object that matches the current effective settings.
   * @returns Matching layout parameters, or null if none found
   */
  protected findUnnamedLayoutParams(): LayoutParams | null {
    const effectiveCycle = this.cycle;
    if (effectiveCycle == null) return null;

    return (
      this._unnamedLayoutParams.find((lp) => {
        return (
          lp.beatDuration == this.atomsPerBeat && effectiveCycle.equals(lp.cycle) && lp.lineBreaksEqual(this.breaks)
        );
      }) || null
    );
  }

  /**
   * Ensures that named layout parameters with the given name exist.
   * @param name The name of the layout parameters
   * @returns The layout parameters
   */
  ensureNamedLayoutParams(name: string): LayoutParams {
    let lp = this._namedLayoutParams.get(name) || null;
    if (lp == null || this._layoutParams != lp) {
      if (lp == null) {
        // Create new named layout params
        lp = this.snapshotLayoutParams();
        this._namedLayoutParams.set(name, lp);
      } else {
        // Copy named LPs attributes into our locals
        this.localCycle = lp.cycle;
        this.localAtomsPerBeat = lp.beatDuration;
        this.localBreaks = lp.lineBreaks;
      }
      this._layoutParams = lp;
      this.resetLine();
    }
    return this._layoutParams!;
  }

  /**
   * Gets a role definition by name, walking up the tree if not found locally.
   * @param name The name of the role
   */
  getRole(name: string): TSU.Nullable<RoleDef> {
    const local = this.localRoles.get(name.toLowerCase());
    if (local) {
      return local;
    }
    return this.parentBlock?.getRole(name) ?? null;
  }

  // ============================================
  // State tracking for command application
  // ============================================

  /**
   * Gets the current role definition.
   * Falls back to parent's current role or the last defined role.
   */
  get currRoleDef(): TSU.Nullable<RoleDef> {
    if (this._currRoleDef !== null) {
      return this._currRoleDef;
    }
    // Fall back to parent's current role
    if (this.parentBlock) {
      return this.parentBlock.currRoleDef;
    }
    // Or use the last locally defined role
    const roles = Array.from(this.localRoles.values());
    return roles.length > 0 ? roles[roles.length - 1] : null;
  }

  /**
   * Sets the current role by name.
   * If the role doesn't exist, tries to create it via the root container's onMissingRole.
   * @param name The name of the role to activate
   * @throws Error if the role is not found and cannot be created
   */
  setCurrRole(name: string): void {
    name = name.trim().toLowerCase();
    if (name === "") {
      throw new Error("Role name cannot be empty");
    }
    let roleDef = this.getRole(name);
    // If role not found, try auto-creation
    if (roleDef == null) {
      // Create the role locally in this block
      // Default: "sw" is notes-only, others are not
      roleDef = this.newRoleDef(name, name === "sw");
    }
    this._currRoleDef = roleDef;
  }

  /**
   * Gets the current line, creating one if needed.
   */
  get currentLine(): Line {
    if (this._currentLine === null) {
      return this.newLine();
    }
    return this._currentLine;
  }

  /**
   * Creates a new line in this block.
   */
  newLine(): Line {
    if (this._currentLine !== null && this._currentLine.isEmpty) {
      // Remove empty line before creating new one
      this.removeBlockItem(this._currentLine);
    }
    this._currentLine = new Line();
    this.addBlockItem(this._currentLine);
    return this._currentLine;
  }

  /**
   * Resets the current line pointer to null.
   * Called when layout parameters change to force a new line.
   */
  resetLine(): void {
    this._currentLine = null;
  }

  /**
   * Creates a new role definition local to this block.
   * @param name The name of the role
   * @param notesOnly Whether this role contains only notes
   */
  newRoleDef(name: string, notesOnly = false): RoleDef {
    name = name.trim().toLowerCase();
    if (name === "") {
      throw new Error("Role name cannot be empty");
    }
    if (this.localRoles.has(name)) {
      throw new Error(`Role '${name}' already exists in this block`);
    }
    const rd = new RoleDef();
    rd.name = name;
    rd.notesOnly = notesOnly;
    rd.index = this.localRoles.size;
    this.localRoles.set(name, rd);
    return rd;
  }

  // ============================================
  // Child management
  // ============================================

  /**
   * Adds a child item to this block.
   * @param item The item to add
   */
  addBlockItem(item: BlockItem): void {
    item.setParent(this);
    this.blockItems.push(item);
  }

  /**
   * Removes a child item from this block.
   * @param item The item to remove
   * @returns The index of the removed item, or -1 if not found
   */
  removeBlockItem(item: BlockItem): number {
    const index = this.blockItems.indexOf(item);
    if (index >= 0) {
      this.blockItems.splice(index, 1);
      item.setParent(null);
    }
    return index;
  }

  /**
   * Returns a debug-friendly representation of this block.
   */
  debugValue(): any {
    const out: any = {
      ...super.debugValue(),
      blockType: this.blockType,
      blockItems: this.blockItems.map((c) => c.debugValue()),
    };
    if (this.name) {
      out.name = this.name;
    }
    if (this.localCycle) {
      out.localCycle = this.localCycle.uuid;
    }
    if (this.localAtomsPerBeat !== null) {
      out.localAtomsPerBeat = this.localAtomsPerBeat;
    }
    if (this.localBreaks !== null) {
      out.localBreaks = this.localBreaks;
    }
    if (this.localRoles.size > 0) {
      out.localRoles = Array.from(this.localRoles.keys());
    }
    return out;
  }
}

/**
 * Helper function to find the containing block of an entity by walking up the tree.
 * @param entity The entity to start from
 * @returns The containing Block, or null if not found
 */
export function findContainingBlock(entity: Entity): TSU.Nullable<Block> {
  let current: TSU.Nullable<Entity> = entity.parent;
  while (current !== null) {
    if (current instanceof Block) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

// ============================================
// Block Subclasses
// ============================================

/**
 * A section block with a heading.
 * Expands children to include a heading RawBlock followed by the content.
 *
 * Usage: \section("Pallavi") { ... }
 */
export class SectionBlock extends Block {
  constructor(sectionName: string, parent: TSU.Nullable<Block> = null) {
    super("section", parent, sectionName);
  }

  /**
   * Expands children to include a heading RawBlock.
   */
  children(): BlockItem[] {
    const heading = new RawBlock(`# ${this.name}`, "md");
    return [heading, ...this.blockItems];
  }
}

/**
 * A repeat block that expands its children N times.
 *
 * Usage: \repeat(2) { ... }
 */
export class RepeatBlock extends Block {
  /** Number of times to repeat (0 = visual markers only) */
  readonly repeatCount: number;

  constructor(repeatCount: number, parent: TSU.Nullable<Block> = null) {
    super("repeat", parent);
    this.repeatCount = repeatCount;
  }

  /**
   * Expands children by repeating them N times.
   * If count is 0, returns children as-is (visual repeat markers only).
   */
  children(): BlockItem[] {
    if (this.repeatCount <= 0) {
      return this.blockItems;
    }
    const expanded: BlockItem[] = [];
    for (let i = 0; i < this.repeatCount; i++) {
      expanded.push(...this.blockItems);
    }
    return expanded;
  }
}

/**
 * A cycle block that sets localCycle for scoped notation.
 *
 * Usage: \cycle("|4|4|") { ... }
 */
export class CycleBlock extends Block {
  constructor(cycle: Cycle, parent: TSU.Nullable<Block> = null) {
    super("cycle", parent);
    this.localCycle = cycle;
  }
}

/**
 * A beat duration block that sets localAtomsPerBeat for scoped notation.
 *
 * Usage: \beatDuration(2) { ... }
 */
export class BeatDurationBlock extends Block {
  constructor(atomsPerBeat: number, parent: TSU.Nullable<Block> = null) {
    super("beatduration", parent);
    this.localAtomsPerBeat = atomsPerBeat;
  }
}

/**
 * A breaks block that sets localBreaks for scoped notation.
 *
 * Usage: \breaks(4, 2, 2) { ... }
 */
export class BreaksBlock extends Block {
  constructor(breaks: number[], parent: TSU.Nullable<Block> = null) {
    super("breaks", parent);
    this.localBreaks = breaks;
  }
}

/**
 * A role block that creates a local role definition.
 *
 * Usage: \role("Vocals", notes=false) { ... }
 */
export class RoleBlock extends Block {
  constructor(roleName: string, notesOnly: boolean, parent: TSU.Nullable<Block> = null) {
    super("role", parent);
    // Create the role locally
    this.newRoleDef(roleName, notesOnly);
  }
}

/**
 * A group block for organizing notation without special semantics.
 *
 * Usage: \group("optional-name") { ... }
 */
export class GroupBlock extends Block {
  constructor(groupName: string | null, parent: TSU.Nullable<Block> = null) {
    super("group", parent, groupName);
  }
}
