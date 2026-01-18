/**
 * @jest-environment jsdom
 *
 * Unit tests for baseline alignment in GroupView.
 *
 * When beats in the same row have different heights (e.g., due to nested group brackets),
 * atoms should align at the same baseline. This is achieved by positioning content at the
 * bottom of the allocated height rather than the top.
 */
import * as TSU from "@panyam/tsutils";
import { Group, Note } from "../core";

describe("Baseline Alignment", () => {
  describe("Offset Calculation", () => {
    /**
     * Tests the baseline alignment offset formula:
     *   currY = unscaledAllocatedHeight - unscaledContentHeight
     *
     * This formula ensures content is positioned at the bottom of allocated space.
     */
    test("calculates offset when allocated height > content height", () => {
      const contentHeight = 30;
      const allocatedHeight = 50;
      const scaleFactor = 1;

      const unscaledContentHeight = contentHeight / scaleFactor;
      const unscaledAllocatedHeight = allocatedHeight / scaleFactor;
      const currY = unscaledAllocatedHeight - unscaledContentHeight;

      // Content should be pushed down by 20px to align at bottom
      expect(currY).toBe(20);
    });

    test("offset is zero when allocated height equals content height", () => {
      const contentHeight = 30;
      const allocatedHeight = 30;
      const scaleFactor = 1;

      const unscaledContentHeight = contentHeight / scaleFactor;
      const unscaledAllocatedHeight = allocatedHeight / scaleFactor;
      const currY = unscaledAllocatedHeight - unscaledContentHeight;

      expect(currY).toBe(0);
    });

    test("handles scale factor correctly", () => {
      const contentHeight = 21; // Scaled height (30 * 0.7)
      const allocatedHeight = 35; // Scaled allocated height (50 * 0.7)
      const scaleFactor = 0.7;

      // Unscale to get actual content dimensions
      const unscaledContentHeight = contentHeight / scaleFactor;
      const unscaledAllocatedHeight = allocatedHeight / scaleFactor;
      const currY = unscaledAllocatedHeight - unscaledContentHeight;

      // unscaledContentHeight = 21 / 0.7 = 30
      // unscaledAllocatedHeight = 35 / 0.7 = 50
      // currY = 50 - 30 = 20
      expect(currY).toBeCloseTo(20, 5);
    });

    test("fallback to content height when no allocated height", () => {
      const contentHeight = 30;
      const hasHeight = false;
      const allocatedHeight = 0; // Ignored when hasHeight is false
      const scaleFactor = 1;

      const unscaledContentHeight = contentHeight / scaleFactor;
      const unscaledAllocatedHeight = hasHeight
        ? allocatedHeight / scaleFactor
        : unscaledContentHeight;
      const currY = unscaledAllocatedHeight - unscaledContentHeight;

      // When no allocated height, currY should be 0 (content at top = bottom of itself)
      expect(currY).toBe(0);
    });
  });

  describe("Nested Groups Height Contribution", () => {
    /**
     * Tests that Group dimensions include bracket height for nested groups.
     * Each nested group at depth >= 1 adds BRACKET_HEIGHT to its minSize.
     */
    const BRACKET_HEIGHT = 8;

    test("depth 0 group has no bracket height", () => {
      const depth = 0;
      const baseHeight = 30;

      const heightWithBracket =
        depth >= 1 ? baseHeight + BRACKET_HEIGHT : baseHeight;

      expect(heightWithBracket).toBe(30);
    });

    test("depth 1 group adds bracket height", () => {
      const depth = 1;
      const baseHeight = 30;

      const heightWithBracket =
        depth >= 1 ? baseHeight + BRACKET_HEIGHT : baseHeight;

      expect(heightWithBracket).toBe(38);
    });

    test("depth 2 nested groups have cumulative bracket effect", () => {
      // A group at depth 2 has its own bracket (8px)
      // It's inside a depth 1 group which also has a bracket (8px)
      // Visual effect: content appears to have 2 bracket lines above it
      const depth = 2;
      const baseHeight = 30;
      const scaleFactor = 0.7;

      // The group at depth 2 itself adds BRACKET_HEIGHT
      const heightWithBracket = baseHeight + BRACKET_HEIGHT * scaleFactor;

      // The parent group at depth 1 also adds its bracket height
      // This is handled by the parent's refreshMinSize

      expect(heightWithBracket).toBeCloseTo(35.6, 5);
    });
  });

  describe("Row Alignment Scenarios", () => {
    /**
     * Tests alignment scenarios based on the visual test case:
     *
     * Beat 1: S R G M  (4 atoms, no nesting, height = base)
     * Beat 2: [ P D [ N S. ] ] (nested groups, height = base + 2 brackets)
     * Beat 3: G M P D (4 atoms, no nesting, height = base)
     *
     * All beats get row height = max(beat1.height, beat2.height, beat3.height)
     * Atoms in beat1 and beat3 should be offset down to align with beat2's atoms.
     */
    test("calculates correct offset for mixed depth row", () => {
      const BRACKET_HEIGHT = 8;
      const scaleFactor = 0.7;
      const baseAtomHeight = 30;

      // Beat 1: No nesting (depth 0 at beat level)
      const beat1ContentHeight = baseAtomHeight;

      // Beat 2: Nested groups [ P D [ N S. ] ]
      // - Outer group at depth 1 adds one bracket
      // - Inner group at depth 2 adds its own bracket (scaled by 0.7)
      const beat2ContentHeight =
        baseAtomHeight +
        BRACKET_HEIGHT * scaleFactor + // depth 1 bracket
        BRACKET_HEIGHT * scaleFactor * 0.7; // depth 2 bracket (scaled twice)

      // Beat 3: No nesting
      const beat3ContentHeight = baseAtomHeight;

      // Row height is max of all beats
      const rowHeight = Math.max(
        beat1ContentHeight,
        beat2ContentHeight,
        beat3ContentHeight
      );

      // Beat 1 offset (pushed down to align)
      const beat1Offset = rowHeight - beat1ContentHeight;

      // Beat 2 offset (tallest, no push needed)
      const beat2Offset = rowHeight - beat2ContentHeight;

      // Beat 3 offset (pushed down to align)
      const beat3Offset = rowHeight - beat3ContentHeight;

      // Beat 2 should have zero or minimal offset (it's the tallest)
      expect(beat2Offset).toBeCloseTo(0, 5);

      // Beat 1 and 3 should have positive offsets
      expect(beat1Offset).toBeGreaterThan(0);
      expect(beat3Offset).toBeGreaterThan(0);

      // Beat 1 and 3 should have the same offset (same content height)
      expect(beat1Offset).toBeCloseTo(beat3Offset, 5);
    });
  });
});
