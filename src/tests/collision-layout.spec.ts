import * as TSU from "@panyam/tsutils";
import { computeCollisionLayout, CollisionLayoutItem } from "../shapes";

const ONE = TSU.Num.Fraction.ONE;
const TWO = ONE.timesNum(2);
const FOUR = ONE.timesNum(4);

/**
 * Helper to create a CollisionLayoutItem with default values.
 */
function item(duration: TSU.Num.Fraction, minWidth: number, glyphOffset = 0): CollisionLayoutItem {
  return {
    timeOffset: TSU.Num.Fraction.ZERO, // Not used directly, computed from cumulative duration
    duration,
    glyphOffset,
    minWidth,
  };
}

describe("computeCollisionLayout", () => {
  describe("Basic positioning without collisions", () => {
    test("should position single note at x=0", () => {
      const items = [item(ONE, 15)];
      const results = computeCollisionLayout(items, ONE, 60);

      expect(results).toHaveLength(1);
      expect(results[0].x).toBe(0);
      expect(results[0].wasCollision).toBe(false);
    });

    test("should position notes by time when no collisions", () => {
      // 4 notes, each duration 1, total duration 4, container width 60
      // Expected positions: 0, 15, 30, 45
      const items = [item(ONE, 10), item(ONE, 10), item(ONE, 10), item(ONE, 10)];
      const results = computeCollisionLayout(items, FOUR, 60);

      expect(results).toHaveLength(4);
      expect(results[0].x).toBe(0); // time 0/4 * 60 = 0
      expect(results[1].x).toBe(15); // time 1/4 * 60 = 15
      expect(results[2].x).toBe(30); // time 2/4 * 60 = 30
      expect(results[3].x).toBe(45); // time 3/4 * 60 = 45

      // No collisions expected
      expect(results.every((r) => !r.wasCollision)).toBe(true);
    });

    test("should handle notes with varying durations", () => {
      // S (dur 1), R (dur 2), G (dur 1), total = 4
      // Positions: S at 0, R at 15 (1/4 * 60), G at 45 (3/4 * 60)
      const items = [item(ONE, 10), item(TWO, 10), item(ONE, 10)];
      const results = computeCollisionLayout(items, FOUR, 60);

      expect(results).toHaveLength(3);
      expect(results[0].x).toBe(0);
      expect(results[1].x).toBe(15);
      expect(results[2].x).toBe(45);
    });
  });

  describe("Collision avoidance", () => {
    test("should push note right when pre-embellishment would overlap", () => {
      // First note: width 15, no embellishment
      // Second note: width 15, has 10px pre-embellishment
      // Total duration 2, width 60 -> second note ideal glyphX = 30
      // Second note realX = 30 - 10 = 20
      // But first note ends at 15, so 20 >= 15, no collision
      const items = [item(ONE, 15, 0), item(ONE, 15, 10)];
      const results = computeCollisionLayout(items, TWO, 60);

      expect(results[0].x).toBe(0);
      expect(results[0].wasCollision).toBe(false);
      expect(results[1].x).toBe(20); // 30 - 10 = 20, no collision with 15
      expect(results[1].wasCollision).toBe(false);
    });

    test("should push note right when realX would be negative", () => {
      // First note: width 20, no embellishment
      // Second note: width 15, has 20px pre-embellishment
      // Total duration 2, width 60 -> second note ideal glyphX = 30
      // Second note realX = 30 - 20 = 10
      // First note ends at 20, so 10 < 20, collision!
      const items = [item(ONE, 20, 0), item(ONE, 15, 20)];
      const results = computeCollisionLayout(items, TWO, 60);

      expect(results[0].x).toBe(0);
      expect(results[0].wasCollision).toBe(false);
      expect(results[1].x).toBe(20); // Pushed right to avoid collision
      expect(results[1].wasCollision).toBe(true);
    });

    test("should handle cascading collisions", () => {
      // Three notes, each with large pre-embellishments
      // Each causes a collision, pushing subsequent notes right
      const items = [
        item(ONE, 20, 0), // No embellishment, ends at 20
        item(ONE, 20, 15), // realX = 20 - 15 = 5, collision with 20 -> pushed to 20
        item(ONE, 20, 15), // realX = 40 - 15 = 25, collision with 40 -> pushed to 40
      ];
      const results = computeCollisionLayout(items, ONE.timesNum(3), 60);

      expect(results[0].x).toBe(0);
      expect(results[0].wasCollision).toBe(false);

      expect(results[1].x).toBe(20); // Pushed right
      expect(results[1].wasCollision).toBe(true);

      expect(results[2].x).toBe(40); // Pushed right
      expect(results[2].wasCollision).toBe(true);
    });

    test("should handle first note with pre-embellishment", () => {
      // First note has pre-embellishment, so realX = 0 - glyphOffset
      // But since realX < 0 and prevNoteEndX = 0, it gets pushed to 0
      const items = [item(ONE, 15, 10)];
      const results = computeCollisionLayout(items, ONE, 60);

      // glyphX = 0, realX = 0 - 10 = -10
      // -10 < 0 (prevNoteEndX), so realX = 0
      expect(results[0].x).toBe(0);
      expect(results[0].wasCollision).toBe(true);
    });
  });

  describe("Edge cases", () => {
    test("should handle empty items array", () => {
      const results = computeCollisionLayout([], ONE, 60);
      expect(results).toHaveLength(0);
    });

    test("should handle zero total duration", () => {
      const items = [item(ONE, 15)];
      const results = computeCollisionLayout(items, TSU.Num.Fraction.ZERO, 60);

      // When total duration is zero, all items go to x=0
      expect(results[0].x).toBe(0);
    });

    test("should handle zero container width", () => {
      const items = [item(ONE, 15), item(ONE, 15)];
      const results = computeCollisionLayout(items, TWO, 0);

      // All items at x=0 when width is 0
      expect(results[0].x).toBe(0);
      expect(results[1].x).toBe(15); // Pushed right due to collision
    });

    test("should handle items with zero minWidth", () => {
      // Items with zero width shouldn't cause collisions
      const items = [item(ONE, 0), item(ONE, 10)];
      const results = computeCollisionLayout(items, TWO, 60);

      expect(results[0].x).toBe(0);
      expect(results[1].x).toBe(30); // time 1/2 * 60 = 30
      expect(results[1].wasCollision).toBe(false);
    });

    test("should handle very large pre-embellishments", () => {
      // Pre-embellishment larger than time position
      // Should get pushed to start from previous item's end
      const items = [item(ONE, 20), item(ONE, 20, 50)];
      const results = computeCollisionLayout(items, TWO, 60);

      expect(results[0].x).toBe(0);
      // glyphX = 30, realX = 30 - 50 = -20
      // -20 < 20 (prevNoteEndX), pushed to 20
      expect(results[1].x).toBe(20);
      expect(results[1].wasCollision).toBe(true);
    });
  });

  describe("Real-world scenarios", () => {
    test("should handle Jaaru embellishment scenario", () => {
      // Typical Carnatic scenario: note with Jaaru slide before it
      // Jaaru adds ~10px before the note glyph
      const items = [
        item(ONE, 15, 10), // S with Jaaru
        item(ONE, 10, 0), // R
        item(ONE, 10, 0), // G
        item(ONE, 10, 0), // M
      ];
      const results = computeCollisionLayout(items, FOUR, 60);

      // First note pushed to 0 (glyphX = 0, realX = -10 -> 0)
      expect(results[0].x).toBe(0);
      expect(results[0].wasCollision).toBe(true);

      // Second note: glyphX = 15, realX = 15 - 0 = 15
      // prevNoteEndX = 15, so 15 >= 15, just fits!
      expect(results[1].x).toBe(15);
      expect(results[1].wasCollision).toBe(false);
    });

    test("should handle multiple embellished notes in sequence", () => {
      // Multiple notes with embellishments
      const items = [
        item(ONE, 20, 5), // S with small embellishment
        item(ONE, 20, 10), // R with medium embellishment
        item(ONE, 20, 15), // G with large embellishment
      ];
      const results = computeCollisionLayout(items, ONE.timesNum(3), 90);

      // S: glyphX = 0, realX = -5 -> 0
      expect(results[0].x).toBe(0);
      expect(results[0].wasCollision).toBe(true);

      // R: glyphX = 30, realX = 30 - 10 = 20
      // prevNoteEndX = 20, so 20 >= 20, fits exactly
      expect(results[1].x).toBe(20);
      expect(results[1].wasCollision).toBe(false);

      // G: glyphX = 60, realX = 60 - 15 = 45
      // prevNoteEndX = 40, so 45 >= 40, no collision
      expect(results[2].x).toBe(45);
      expect(results[2].wasCollision).toBe(false);
    });
  });
});
