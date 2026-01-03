import * as TSU from "@panyam/tsutils";
import { Entity } from "./entity";
import { Cycle } from "./cycle";
import { Line } from "./core";

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
 * Interface for entities that can contain blocks and have scoped properties.
 * Both Notation and Block implement this interface.
 *
 * Note: We use `blockItems` instead of `children` and `parentBlock` instead of `parent`
 * to avoid conflicts with Entity's existing members.
 *
 * Properties are resolved lazily by walking up the tree when not set locally.
 */
export interface BlockContainer {
  /** Parent container in the block hierarchy */
  readonly parentBlock: TSU.Nullable<BlockContainer>;

  /** Child items (blocks, lines, raw blocks) */
  readonly blockItems: BlockItem[];

  // ============================================
  // Local properties (only what's set directly on this container)
  // ============================================

  /** Cycle set directly on this container, if any */
  localCycle: TSU.Nullable<Cycle>;

  /** Atoms per beat set directly on this container, if any */
  localAtomsPerBeat: TSU.Nullable<number>;

  /** Line breaks set directly on this container, if any */
  localBreaks: TSU.Nullable<number[]>;

  /** Roles defined directly on this container */
  readonly localRoles: Map<string, RoleDef>;

  // ============================================
  // Resolved properties (walk up tree if not set locally)
  // ============================================

  /** Gets the effective cycle (local or inherited from parent) */
  get cycle(): TSU.Nullable<Cycle>;

  /** Gets the effective atoms per beat (local or inherited, default 1) */
  get atomsPerBeat(): number;

  /** Gets the effective line breaks (local or inherited) */
  get breaks(): number[];

  /**
   * Gets a role definition by name, walking up the tree if not found locally.
   * @param name The name of the role
   */
  getRole(name: string): TSU.Nullable<RoleDef>;

  // ============================================
  // Child management
  // ============================================

  /**
   * Adds a child item to this container.
   * @param item The item to add
   */
  addBlockItem(item: BlockItem): void;
}

/**
 * Represents a scoped block created by a command with braces.
 * For example: \section("Pallavi") { ... }
 *
 * Blocks inherit properties from their parent container and can override them locally.
 * Properties are resolved lazily by walking up the tree.
 */
export class Block extends Entity implements BlockContainer {
  readonly TYPE = "Block";

  /** The type of block (e.g., "section", "group", "repeat") */
  readonly blockType: string;

  /** Optional name for the block (e.g., section name) */
  readonly name: TSU.Nullable<string>;

  /** Child items in this block */
  readonly blockItems: BlockItem[] = [];

  // Local properties
  localCycle: TSU.Nullable<Cycle> = null;
  localAtomsPerBeat: TSU.Nullable<number> = null;
  localBreaks: TSU.Nullable<number[]> = null;
  readonly localRoles = new Map<string, RoleDef>();

  // Store parent reference
  private _parentBlock: TSU.Nullable<BlockContainer> = null;

  /**
   * Creates a new Block.
   * @param blockType The type of block (e.g., "section", "group")
   * @param parent The parent container
   * @param name Optional name for the block
   */
  constructor(blockType: string, parent: BlockContainer, name: TSU.Nullable<string> = null) {
    super();
    this.blockType = blockType;
    this.name = name;
    this._parentBlock = parent;
    // Also set Entity's parent for tree traversal
    if (parent && "setParent" in parent) {
      this.setParent(parent as unknown as Entity);
    }
  }

  /**
   * Gets the parent container.
   */
  get parentBlock(): TSU.Nullable<BlockContainer> {
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
 * Type guard to check if an entity is a BlockContainer.
 */
export function isBlockContainer(entity: Entity): entity is Entity & BlockContainer {
  return "blockItems" in entity && "cycle" in entity;
}

/**
 * Helper function to find the containing block of an entity by walking up the tree.
 * @param entity The entity to start from
 * @returns The containing BlockContainer, or null if not found
 */
export function findContainingBlock(entity: Entity): TSU.Nullable<BlockContainer> {
  let current: TSU.Nullable<Entity> = entity.parent;
  while (current !== null) {
    if (isBlockContainer(current)) {
      return current;
    }
    current = current.parent;
  }
  return null;
}
