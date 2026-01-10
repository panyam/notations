/**
 * Model change events for incremental updates.
 *
 * This module defines the event types and interfaces for change notifications
 * on model entities (Group, Role, Line, Block). These events enable incremental
 * updates to the rendering pipeline without full re-renders.
 *
 * Note: This module uses generic types to avoid circular dependencies with
 * core.ts and block.ts. The actual types are enforced at the call sites.
 */

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

/**
 * Model event names as constants.
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
 */
export type ModelEventName = (typeof ModelEvents)[keyof typeof ModelEvents];
