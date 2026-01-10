/**
 * Model change events for incremental updates.
 *
 * This module defines the event types, interfaces, and observer patterns for
 * change notifications on model entities (Group, Role, Line, Block). These
 * events enable incremental updates to the rendering pipeline without full
 * re-renders.
 *
 * Uses the Observer pattern instead of pub/sub EventHub for:
 * - Type safety: Observers have strongly-typed method signatures
 * - Traceability: Easy to see who is observing what
 * - Explicit contracts: Clear interface between observable and observers
 *
 * Note: This module uses generic types to avoid circular dependencies with
 * core.ts and block.ts. The actual types are enforced at the call sites.
 */

// ============================================
// Event Types and Payloads
// ============================================

/**
 * Event types for Atom-related changes.
 */
export enum AtomChangeType {
  /** Atoms were added to the end */
  ADD = "add",
  /** Atoms were inserted at a specific position */
  INSERT = "insert",
  /** Atoms were removed */
  REMOVE = "remove",
  /** An atom's properties changed (duration, value, etc.) */
  UPDATE = "update",
}

/**
 * Event payload for atom changes in a Group or Role.
 * Generic T is typically Atom from core.ts.
 */
export interface AtomChangeEvent<T = any> {
  /** The type of change */
  type: AtomChangeType;
  /** The atoms that were added, inserted, or removed */
  atoms: T[];
  /** For INSERT: the index where atoms were inserted */
  index?: number;
  /** For UPDATE: the specific property that changed */
  property?: string;
  /** For UPDATE: the old value of the property */
  oldValue?: any;
  /** For UPDATE: the new value of the property */
  newValue?: any;
}

/**
 * Event types for Role-related changes on a Line.
 */
export enum RoleChangeType {
  /** A role was added to the line */
  ADD = "add",
  /** A role was removed from the line */
  REMOVE = "remove",
}

/**
 * Event payload for role changes on a Line.
 */
export interface RoleChangeEvent {
  /** The type of change */
  type: RoleChangeType;
  /** The role that was added or removed */
  roleName: string;
}

/**
 * Event types for BlockItem changes on a Block.
 */
export enum BlockItemChangeType {
  /** An item was added to the block */
  ADD = "add",
  /** An item was removed from the block */
  REMOVE = "remove",
}

/**
 * Event payload for block item changes.
 * Generic T is typically BlockItem (Block | Line | RawBlock) from block.ts.
 */
export interface BlockItemChangeEvent<T = any> {
  /** The type of change */
  type: BlockItemChangeType;
  /** The item that was added or removed */
  item: T;
  /** For ADD: the index where the item was added */
  index?: number;
}

// ============================================
// Observer Interfaces
// ============================================

/**
 * Observer interface for Group atom changes.
 * Implement this interface to receive notifications when atoms are
 * added, inserted, or removed from a Group.
 *
 * @template TAtom The atom type (defaults to any to avoid circular deps)
 * @template TGroup The group type (defaults to any to avoid circular deps)
 */
export interface GroupObserver<TAtom = any, TGroup = any> {
  /**
   * Called when atoms are added to the end of the group.
   * @param group The group that changed
   * @param atoms The atoms that were added
   * @param index The index where atoms were added
   */
  onAtomsAdded?(group: TGroup, atoms: TAtom[], index: number): void;

  /**
   * Called when atoms are inserted at a specific position.
   * @param group The group that changed
   * @param atoms The atoms that were inserted
   * @param index The index where atoms were inserted
   */
  onAtomsInserted?(group: TGroup, atoms: TAtom[], index: number): void;

  /**
   * Called when atoms are removed from the group.
   * @param group The group that changed
   * @param atoms The atoms that were removed
   */
  onAtomsRemoved?(group: TGroup, atoms: TAtom[]): void;
}

/**
 * Observer interface for Role atom changes.
 * Implement this interface to receive notifications when atoms are
 * added, inserted, or removed from a Role.
 *
 * @template TAtom The atom type (defaults to any to avoid circular deps)
 * @template TRole The role type (defaults to any to avoid circular deps)
 */
export interface RoleObserver<TAtom = any, TRole = any> {
  /**
   * Called when atoms are added to the end of the role.
   * @param role The role that changed
   * @param atoms The atoms that were added
   * @param index The index where atoms were added
   */
  onAtomsAdded?(role: TRole, atoms: TAtom[], index: number): void;

  /**
   * Called when atoms are inserted at a specific position.
   * @param role The role that changed
   * @param atoms The atoms that were inserted
   * @param index The index where atoms were inserted
   */
  onAtomsInserted?(role: TRole, atoms: TAtom[], index: number): void;

  /**
   * Called when atoms are removed from the role.
   * @param role The role that changed
   * @param atoms The atoms that were removed
   */
  onAtomsRemoved?(role: TRole, atoms: TAtom[]): void;
}

/**
 * Observer interface for Line role changes.
 * Implement this interface to receive notifications when roles are
 * added or removed from a Line.
 *
 * @template TRole The role type (defaults to any to avoid circular deps)
 * @template TLine The line type (defaults to any to avoid circular deps)
 */
export interface LineObserver<TRole = any, TLine = any> {
  /**
   * Called when a role is added to the line.
   * @param line The line that changed
   * @param roleName The name of the added role
   * @param role The role that was added
   */
  onRoleAdded?(line: TLine, roleName: string, role: TRole): void;

  /**
   * Called when a role is removed from the line.
   * @param line The line that changed
   * @param roleName The name of the removed role
   */
  onRoleRemoved?(line: TLine, roleName: string): void;
}

/**
 * Observer interface for Block item changes.
 * Implement this interface to receive notifications when items are
 * added or removed from a Block.
 *
 * @template TItem The block item type (defaults to any to avoid circular deps)
 * @template TBlock The block type (defaults to any to avoid circular deps)
 */
export interface BlockObserver<TItem = any, TBlock = any> {
  /**
   * Called when an item is added to the block.
   * @param block The block that changed
   * @param item The item that was added
   * @param index The index where the item was added
   */
  onItemAdded?(block: TBlock, item: TItem, index: number): void;

  /**
   * Called when an item is removed from the block.
   * @param block The block that changed
   * @param item The item that was removed
   * @param index The index where the item was located
   */
  onItemRemoved?(block: TBlock, item: TItem, index: number): void;
}

// ============================================
// Legacy Event Names (kept for compatibility)
// ============================================

/**
 * Model event names as constants.
 * @deprecated Use observer interfaces instead
 */
export const ModelEvents = {
  /** Emitted when atoms change in a Group or Role */
  ATOMS_CHANGED: "atomsChanged",
  /** Emitted when roles change on a Line */
  ROLES_CHANGED: "rolesChanged",
  /** Emitted when block items change on a Block */
  ITEMS_CHANGED: "itemsChanged",
  /** Emitted when an atom's duration changes */
  DURATION_CHANGED: "durationChanged",
} as const;

/**
 * Type for model event names.
 * @deprecated Use observer interfaces instead
 */
export type ModelEventName = (typeof ModelEvents)[keyof typeof ModelEvents];
