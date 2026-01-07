/**
 * Source serializer for converting CellModel trees back to notation source.
 *
 * This module handles serializing edited cells back into notation source text,
 * preserving formatting and structure where possible.
 */

import type { BlockItem, Block, RawBlock } from "../../block";
import type { Line } from "../../core";
import { isBlock, isLine, isRawBlock } from "../../block";
import { CellModel } from "../types/notebook";

/**
 * Options for source serialization.
 */
export interface SerializerOptions {
  /**
   * Indentation string to use for nested blocks.
   * @default "  " (two spaces)
   */
  indent?: string;

  /**
   * Line separator.
   * @default "\n"
   */
  lineSeparator?: string;

  /**
   * Whether to preserve original source for unmodified cells.
   * @default true
   */
  preserveUnmodified?: boolean;
}

const DEFAULT_OPTIONS: SerializerOptions = {
  indent: "  ",
  lineSeparator: "\n",
  preserveUnmodified: true,
};

/**
 * Serializes a cell tree back to notation source.
 *
 * @param cells The cell models to serialize
 * @param options Serialization options
 * @returns The serialized notation source
 */
export function serializeCells(cells: CellModel[], options: SerializerOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const parts: string[] = [];

  for (const cell of cells) {
    const serialized = serializeCell(cell, 0, opts);
    if (serialized) {
      parts.push(serialized);
    }
  }

  return parts.join(opts.lineSeparator! + opts.lineSeparator!);
}

/**
 * Serializes a single cell to source.
 *
 * @param cell The cell to serialize
 * @param depth The current nesting depth
 * @param options Serialization options
 * @returns The serialized source
 */
export function serializeCell(cell: CellModel, depth: number, options: SerializerOptions): string {
  const indent = options.indent!.repeat(depth);

  // If preserving unmodified and cell has source, use it directly
  if (options.preserveUnmodified && cell.source && !cell.state.hasError) {
    // For top-level cells, return source as-is
    if (depth === 0) {
      return cell.source;
    }
    // For nested cells, indent each line
    return cell.source
      .split("\n")
      .map((line) => indent + line)
      .join(options.lineSeparator!);
  }

  // Otherwise, serialize from the block item
  return serializeBlockItem(cell.blockItem, depth, options);
}

/**
 * Serializes a BlockItem to source.
 *
 * @param item The block item to serialize
 * @param depth The current nesting depth
 * @param options Serialization options
 * @returns The serialized source
 */
export function serializeBlockItem(item: BlockItem, depth: number, options: SerializerOptions): string {
  if (isRawBlock(item)) {
    return serializeRawBlock(item as RawBlock, depth, options);
  }

  if (isLine(item)) {
    return serializeLine(item as Line, depth, options);
  }

  if (isBlock(item)) {
    return serializeBlock(item as Block, depth, options);
  }

  return "";
}

/**
 * Serializes a RawBlock to source.
 */
function serializeRawBlock(rawBlock: RawBlock, depth: number, options: SerializerOptions): string {
  const indent = options.indent!.repeat(depth);
  const content = rawBlock.content;

  // Determine wrapper based on content type
  if (rawBlock.contentType === "md") {
    // Markdown content uses triple backtick or raw syntax
    return `${indent}---${options.lineSeparator}${content}${options.lineSeparator}${indent}---`;
  }

  if (rawBlock.contentType === "metadata") {
    // Metadata reference
    return `${indent}@@${content}`;
  }

  // Default: plain text or other content
  return content
    .split("\n")
    .map((line) => indent + line)
    .join(options.lineSeparator!);
}

/**
 * Serializes a Line to source.
 *
 * Note: This is a simplified serialization. Full Line serialization
 * would need to reconstruct atoms, spaces, embellishments, etc.
 */
function serializeLine(line: Line, depth: number, options: SerializerOptions): string {
  const indent = options.indent!.repeat(depth);

  // For now, return a placeholder
  // Full implementation would iterate through line.atoms and serialize each
  // This would require significant work to reconstruct the DSL syntax
  return `${indent}; [Line serialization not fully implemented]`;
}

/**
 * Serializes a Block to source.
 */
function serializeBlock(block: Block, depth: number, options: SerializerOptions): string {
  const indent = options.indent!.repeat(depth);
  const childIndent = options.indent!.repeat(depth + 1);
  const parts: string[] = [];

  // Block header
  const header = serializeBlockHeader(block);
  parts.push(`${indent}${header} {`);

  // Children
  for (const child of block.blockItems) {
    const childSource = serializeBlockItem(child, depth + 1, options);
    if (childSource) {
      parts.push(childSource);
    }
  }

  // Closing brace
  parts.push(`${indent}}`);

  return parts.join(options.lineSeparator!);
}

/**
 * Serializes a block header (command with parameters).
 */
function serializeBlockHeader(block: Block): string {
  const type = block.blockType;

  switch (type) {
    case "section":
      return `\\section("${block.name || ""}")`;

    case "repeat": {
      // RepeatBlock has repeatCount property
      const repeatCount = (block as any).repeatCount ?? 1;
      return `\\repeat(${repeatCount})`;
    }

    case "cycle":
      // CycleBlock has localCycle
      if (block.localCycle) {
        return `\\cycle("${block.localCycle.toString()}")`;
      }
      return "\\cycle()";

    case "beatduration":
      if (block.localAtomsPerBeat !== null) {
        return `\\beatDuration(${block.localAtomsPerBeat})`;
      }
      return "\\beatDuration(1)";

    case "breaks":
      if (block.localBreaks) {
        return `\\breaks(${block.localBreaks.join(", ")})`;
      }
      return "\\breaks()";

    case "role": {
      // Get first role name from localRoles
      const roleName = Array.from(block.localRoles.keys())[0] || "";
      return `\\role("${roleName}")`;
    }

    case "group":
      if (block.name) {
        return `\\group("${block.name}")`;
      }
      return "\\group()";

    case "notation":
      // Root notation block has no header
      return "";

    default:
      return `\\${type}()`;
  }
}

/**
 * Updates a cell's source and marks it as modified.
 *
 * @param cell The cell to update
 * @param newSource The new source text
 * @returns A new CellModel with updated source
 */
export function updateCellSource(cell: CellModel, newSource: string): CellModel {
  return {
    ...cell,
    source: newSource,
  };
}

/**
 * Validates cell source by attempting to parse it.
 *
 * @param source The source to validate
 * @returns Object with isValid flag and optional error message
 */
export function validateCellSource(source: string): {
  isValid: boolean;
  error?: string;
} {
  // For now, just check for basic syntax issues
  // Full validation would require the notation parser

  // Check for balanced braces
  let braceCount = 0;
  for (const char of source) {
    if (char === "{") braceCount++;
    if (char === "}") braceCount--;
    if (braceCount < 0) {
      return {
        isValid: false,
        error: "Unmatched closing brace",
      };
    }
  }

  if (braceCount !== 0) {
    return {
      isValid: false,
      error: "Unmatched opening brace",
    };
  }

  return { isValid: true };
}

/**
 * Extracts the source range for a cell from full notation source.
 * This is a best-effort function that tries to find the cell's content
 * in the original source.
 *
 * @param cell The cell to find
 * @param fullSource The full notation source
 * @returns Source range or null if not found
 */
export function findCellSourceRange(cell: CellModel, fullSource: string): { start: number; end: number } | null {
  // This is a simplified implementation
  // Full implementation would need source position tracking in the parser

  if (isRawBlock(cell.blockItem)) {
    const rawBlock = cell.blockItem as RawBlock;
    const start = fullSource.indexOf(rawBlock.content);
    if (start >= 0) {
      return {
        start,
        end: start + rawBlock.content.length,
      };
    }
  }

  return null;
}
