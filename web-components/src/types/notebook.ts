/**
 * Types and interfaces for the notebook-style cell editing UI.
 *
 * The notebook UI represents a Notation as a collection of editable cells,
 * where each Block becomes a cell with preview/edit modes.
 */

import type { BlockItem, Block, Notation } from "notations";
import type { GridLayoutGroup, LayoutChangeEvent } from "notations";

// Re-export for convenience
export type { LayoutChangeEvent };

/**
 * State of a single cell in the notebook.
 */
export interface CellState {
  /** Unique identifier for this cell */
  id: string;

  /** Block type from block.blockType (e.g., "section", "repeat", "notation") */
  type: string;

  /** Nesting depth in the block hierarchy (0 = top level) */
  depth: number;

  /** Whether nested children are expanded (for collapsible blocks) */
  isExpanded: boolean;

  /** Whether the cell is currently in edit mode */
  isEditing: boolean;

  /** Whether parsing the cell's source resulted in an error */
  hasError: boolean;

  /** Error message if hasError is true */
  errorMessage?: string;
}

/**
 * Model representing a cell in the notebook.
 * Wraps a BlockItem with UI state and source tracking.
 */
export interface CellModel {
  /** The underlying block item from the notation */
  blockItem: BlockItem;

  /** UI state for this cell */
  state: CellState;

  /** Source text for this cell (extracted from original notation source) */
  source: string;

  /** Source range in original notation (for serialization back to source) */
  sourceRange?: {
    start: number;
    end: number;
  };

  /** Child cells (for nested blocks) */
  children: CellModel[];

  /** Parent cell (null for top-level cells) */
  parent: CellModel | null;
}

/**
 * Configuration options for the NotebookView component.
 */
export interface NotebookConfig {
  /**
   * Maximum depth of block nesting to expose as cells.
   * 0 = only show top-level blocks
   * 1 = show one level of nesting
   * Infinity = show all nesting levels
   * @default 1
   */
  maxDepth: number;

  /**
   * Optional shared GridLayoutGroup for column alignment across cells.
   * When provided, all NotationViews in the notebook share this layout group.
   * If not provided, a new one is created internally.
   */
  sharedGridLayoutGroup?: GridLayoutGroup;

  /**
   * Whether to allow reordering cells via drag-and-drop.
   * @default false
   */
  enableReordering?: boolean;

  /**
   * Whether to allow adding new cells.
   * @default true
   */
  enableAddCell?: boolean;

  /**
   * Whether to allow deleting cells.
   * @default true
   */
  enableDeleteCell?: boolean;

  /**
   * Callback when notation source changes (after cell edit is applied).
   * @param source The new full notation source
   * @param notation The parsed Notation object (if parsing succeeded)
   */
  onNotationChange?: (source: string, notation: Notation | null) => void;

  /**
   * Callback when a cell encounters a parse error.
   * @param cellId The ID of the cell with the error
   * @param error The error that occurred
   */
  onCellError?: (cellId: string, error: Error) => void;

  /**
   * Callback when layout changes (column widths/row heights changed).
   * Useful for external components that need to react to layout changes.
   */
  onLayoutChange?: (event: LayoutChangeEvent) => void;

  /**
   * Optional markdown parser for RawBlock content.
   * If not provided, markdown is rendered as plain text.
   */
  markdownParser?: (content: string) => string;

  /**
   * CSS classes to apply to various elements.
   */
  cssClasses?: NotebookCssClasses;
}

/**
 * CSS class overrides for notebook elements.
 */
export interface NotebookCssClasses {
  /** Root container class */
  root?: string;

  /** Individual cell container */
  cell?: string;

  /** Cell header (type badge, name, controls) */
  cellHeader?: string;

  /** Cell content area (preview or edit mode) */
  cellContent?: string;

  /** Cell controls (edit/delete/move buttons) */
  cellControls?: string;

  /** Add cell button */
  addCellButton?: string;

  /** Edit mode textarea */
  editTextarea?: string;

  /** Error message display */
  errorMessage?: string;
}

/**
 * Operations that can be performed on cells.
 */
export interface CellOperations {
  /** Enter edit mode for a cell */
  startEdit(cellId: string): void;

  /** Apply changes and exit edit mode */
  applyEdit(cellId: string, newSource: string): void;

  /** Cancel edit mode without applying changes */
  cancelEdit(cellId: string): void;

  /** Delete a cell */
  deleteCell(cellId: string): void;

  /** Move a cell to a new position */
  moveCell(cellId: string, targetIndex: number): void;

  /** Insert a new cell at the given index */
  insertCell(index: number, source: string): CellModel;

  /** Toggle expanded state for a cell with children */
  toggleExpanded(cellId: string): void;
}

/**
 * Badge info for displaying cell type.
 */
export interface CellTypeBadge {
  /** Display label for the badge */
  label: string;

  /** CSS class for styling (e.g., "badge-section", "badge-repeat") */
  cssClass: string;

  /** Optional icon (SVG string or class name) */
  icon?: string;
}

/**
 * Maps block types to badge display info.
 */
export const CELL_TYPE_BADGES: Record<string, CellTypeBadge> = {
  notation: { label: "Root", cssClass: "badge-notation" },
  section: { label: "Section", cssClass: "badge-section" },
  repeat: { label: "Repeat", cssClass: "badge-repeat" },
  cycle: { label: "Cycle", cssClass: "badge-cycle" },
  beatduration: { label: "Beat", cssClass: "badge-beatduration" },
  breaks: { label: "Breaks", cssClass: "badge-breaks" },
  role: { label: "Role", cssClass: "badge-role" },
  group: { label: "Group", cssClass: "badge-group" },
  // For Line and RawBlock (not blocks, but can be cells)
  line: { label: "Line", cssClass: "badge-line" },
  rawblock: { label: "Text", cssClass: "badge-rawblock" },
};

/**
 * Gets badge info for a block type.
 * @param blockType The block type string
 * @returns Badge info, or a default badge for unknown types
 */
export function getCellTypeBadge(blockType: string): CellTypeBadge {
  const badge = CELL_TYPE_BADGES[blockType.toLowerCase()];
  if (badge) {
    return badge;
  }
  // Default badge for unknown types
  return {
    label: blockType,
    cssClass: "badge-unknown",
  };
}

/**
 * Generates a unique cell ID.
 */
let cellIdCounter = 0;
export function generateCellId(): string {
  return `cell-${++cellIdCounter}`;
}

/**
 * Creates default cell state for a block item.
 * @param blockItem The block item to create state for
 * @param depth The nesting depth
 */
export function createDefaultCellState(blockItem: BlockItem, depth: number): CellState {
  // Determine the type string
  let type: string;
  if (blockItem.TYPE === "Block") {
    type = (blockItem as Block).blockType;
  } else if (blockItem.TYPE === "Line") {
    type = "line";
  } else if (blockItem.TYPE === "RawBlock") {
    type = "rawblock";
  } else {
    type = "unknown";
  }

  return {
    id: generateCellId(),
    type,
    depth,
    isExpanded: true,
    isEditing: false,
    hasError: false,
  };
}
