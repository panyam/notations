/**
 * Factory for converting Block hierarchy to CellModel tree.
 *
 * The cell factory walks the notation's block structure and creates
 * a parallel tree of CellModel objects suitable for the notebook UI.
 */

import type { BlockItem, Block, RawBlock } from "../../block";
import type { Line } from "../../core";
import type { Notation } from "../../notation";
import { isBlock, isLine, isRawBlock } from "../../block";
import { CellModel, CellState, createDefaultCellState, generateCellId } from "../types/notebook";

/**
 * Options for cell factory.
 */
export interface CellFactoryOptions {
  /**
   * Maximum depth of block nesting to expose as cells.
   * 0 = only show top-level blocks
   * 1 = show one level of nesting
   * Infinity = show all nesting levels
   * @default 1
   */
  maxDepth: number;

  /**
   * The full notation source text (for extracting cell source ranges).
   * If not provided, cell.source will be empty.
   */
  notationSource?: string;

  /**
   * Whether to include Line items as cells.
   * @default true
   */
  includeLines?: boolean;

  /**
   * Whether to include RawBlock items as cells.
   * @default true
   */
  includeRawBlocks?: boolean;
}

const DEFAULT_OPTIONS: CellFactoryOptions = {
  maxDepth: 1,
  includeLines: true,
  includeRawBlocks: true,
};

/**
 * Creates a CellModel tree from a Notation.
 *
 * @param notation The notation to convert
 * @param options Factory options
 * @returns Array of top-level CellModel objects
 */
export function createCellModels(notation: Notation, options: Partial<CellFactoryOptions> = {}): CellModel[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Create the root cell for the notation itself
  const rootCell = createCellForBlock(notation, 0, opts, null);

  // Return the children of the root (top-level items)
  // The root itself represents the whole notation
  return rootCell.children;
}

/**
 * Creates a CellModel tree from a Notation, including the root cell.
 *
 * @param notation The notation to convert
 * @param options Factory options
 * @returns The root CellModel representing the entire notation
 */
export function createCellModelWithRoot(notation: Notation, options: Partial<CellFactoryOptions> = {}): CellModel {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  return createCellForBlock(notation, 0, opts, null);
}

/**
 * Creates a CellModel for a Block and recursively processes its children.
 */
function createCellForBlock(
  block: Block,
  depth: number,
  options: CellFactoryOptions,
  parent: CellModel | null,
): CellModel {
  const state = createDefaultCellState(block, depth);
  const source = extractBlockSource(block, options.notationSource);

  const cell: CellModel = {
    blockItem: block,
    state,
    source,
    children: [],
    parent,
  };

  // Process children if within depth limit
  if (depth < options.maxDepth) {
    for (const child of block.blockItems) {
      const childCell = createCellForBlockItem(child, depth + 1, options, cell);
      if (childCell) {
        cell.children.push(childCell);
      }
    }
  }

  return cell;
}

/**
 * Creates a CellModel for a BlockItem (Block, Line, or RawBlock).
 * Returns null if the item type is excluded by options.
 */
function createCellForBlockItem(
  item: BlockItem,
  depth: number,
  options: CellFactoryOptions,
  parent: CellModel | null,
): CellModel | null {
  if (isBlock(item)) {
    return createCellForBlock(item as Block, depth, options, parent);
  }

  if (isLine(item)) {
    if (!options.includeLines) {
      return null;
    }
    return createCellForLine(item as Line, depth, options, parent);
  }

  if (isRawBlock(item)) {
    if (!options.includeRawBlocks) {
      return null;
    }
    return createCellForRawBlock(item as RawBlock, depth, options, parent);
  }

  return null;
}

/**
 * Creates a CellModel for a Line.
 */
function createCellForLine(
  line: Line,
  depth: number,
  options: CellFactoryOptions,
  parent: CellModel | null,
): CellModel {
  const state = createDefaultCellState(line, depth);
  const source = extractLineSource(line, options.notationSource);

  return {
    blockItem: line,
    state,
    source,
    children: [], // Lines don't have children
    parent,
  };
}

/**
 * Creates a CellModel for a RawBlock.
 */
function createCellForRawBlock(
  rawBlock: RawBlock,
  depth: number,
  options: CellFactoryOptions,
  parent: CellModel | null,
): CellModel {
  const state = createDefaultCellState(rawBlock, depth);

  return {
    blockItem: rawBlock,
    state,
    source: rawBlock.content, // RawBlock has its content directly
    children: [], // RawBlocks don't have children
    parent,
  };
}

/**
 * Extracts the source text for a Block from the notation source.
 * Currently returns empty string - source range tracking would need
 * parser support to track positions.
 */
function extractBlockSource(block: Block, notationSource?: string): string {
  // TODO: Implement source range tracking in parser
  // For now, we don't have position info in the AST
  // This would require the parser to track source positions
  if (block.name) {
    return `\\${block.blockType}("${block.name}") { ... }`;
  }
  return `\\${block.blockType} { ... }`;
}

/**
 * Extracts the source text for a Line from the notation source.
 * Currently returns a placeholder - would need parser source tracking.
 */
function extractLineSource(line: Line, notationSource?: string): string {
  // TODO: Implement source range tracking in parser
  // For now, generate a placeholder representation
  return "[Line content]";
}

/**
 * Finds a cell by ID in a cell tree.
 *
 * @param cells Array of cells to search
 * @param cellId The ID to find
 * @returns The cell with the given ID, or null if not found
 */
export function findCellById(cells: CellModel[], cellId: string): CellModel | null {
  for (const cell of cells) {
    if (cell.state.id === cellId) {
      return cell;
    }
    const found = findCellById(cell.children, cellId);
    if (found) {
      return found;
    }
  }
  return null;
}

/**
 * Finds a cell's index within its parent's children array.
 *
 * @param cell The cell to find
 * @returns The index, or -1 if the cell has no parent or is not found
 */
export function findCellIndex(cell: CellModel): number {
  if (!cell.parent) {
    return -1;
  }
  return cell.parent.children.indexOf(cell);
}

/**
 * Gets all cells in a flat array (pre-order traversal).
 *
 * @param cells The root cells
 * @returns Flat array of all cells
 */
export function flattenCells(cells: CellModel[]): CellModel[] {
  const result: CellModel[] = [];
  for (const cell of cells) {
    result.push(cell);
    result.push(...flattenCells(cell.children));
  }
  return result;
}

/**
 * Gets all visible cells (respecting isExpanded state).
 *
 * @param cells The root cells
 * @returns Flat array of visible cells
 */
export function getVisibleCells(cells: CellModel[]): CellModel[] {
  const result: CellModel[] = [];
  for (const cell of cells) {
    result.push(cell);
    if (cell.state.isExpanded) {
      result.push(...getVisibleCells(cell.children));
    }
  }
  return result;
}

/**
 * Updates a cell's state immutably.
 *
 * @param cell The cell to update
 * @param updates Partial state updates
 * @returns A new CellModel with updated state
 */
export function updateCellState(cell: CellModel, updates: Partial<CellState>): CellModel {
  return {
    ...cell,
    state: {
      ...cell.state,
      ...updates,
    },
  };
}

/**
 * Recreates cell IDs for a cell tree (useful after cloning).
 *
 * @param cells The cells to update
 * @returns New cells with fresh IDs
 */
export function regenerateCellIds(cells: CellModel[]): CellModel[] {
  return cells.map((cell) => ({
    ...cell,
    state: {
      ...cell.state,
      id: generateCellId(),
    },
    children: regenerateCellIds(cell.children),
  }));
}
