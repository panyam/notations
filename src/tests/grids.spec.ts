import * as TSU from "@panyam/tsutils";
import { GridModel, GridCell, ColAlign } from "../grids";

function testGrid(debug: boolean, found: any, expected: any): void {
  if (debug) {
    console.log("Expected Grid: \n", JSON.stringify(expected, TSU.Misc.getCircularReplacer(), 2));
    console.log("Found Grid: \n", JSON.stringify(found.debugValue(), TSU.Misc.getCircularReplacer(), 2));
  }
  expect(found.debugValue()).toEqual(expected);
}

describe("Basic GridModel Tests", () => {
  test("Creation", () => {
    const g = new GridModel();
    testGrid(false, g, {
      rows: [],
      lastUpdatedAt: 0,
      lastSyncedAt: -1,
    });
  });

  test("Ensure X Rows", () => {
    const g = new GridModel();
    g.getRow(4);
    testGrid(false, g, {
      rows: [
        { r: 0, cells: [] },
        { r: 1, cells: [] },
        { r: 2, cells: [] },
        { r: 3, cells: [] },
        { r: 4, cells: [] },
      ],
      lastUpdatedAt: 0,
      lastSyncedAt: -1,
    });

    g.getRow(3);
    testGrid(false, g, {
      rows: [
        { r: 0, cells: [] },
        { r: 1, cells: [] },
        { r: 2, cells: [] },
        { r: 3, cells: [] },
        { r: 4, cells: [] },
      ],
      lastUpdatedAt: 0,
      lastSyncedAt: -1,
    });

    g.getRow(6);
    testGrid(false, g, {
      rows: [
        { r: 0, cells: [] },
        { r: 1, cells: [] },
        { r: 2, cells: [] },
        { r: 3, cells: [] },
        { r: 4, cells: [] },
        { r: 5, cells: [] },
        { r: 6, cells: [] },
      ],
      lastUpdatedAt: 0,
      lastSyncedAt: -1,
    });
  });

  test("Set and clear a Value", () => {
    const g = new GridModel();
    g.setValue(5, 5, 10);
    expect(g.getRow(5).cellAt(5)?.grid).toBe(g);
    testGrid(false, g, {
      rows: [
        { r: 0, cells: [] },
        { r: 1, cells: [] },
        { r: 2, cells: [] },
        { r: 3, cells: [] },
        { r: 4, cells: [] },
        {
          r: 5,
          cells: [
            {
              r: 5,
              c: 5,
              value: 10,
              y: 0,
              h: 30,
            },
          ],
        },
      ],
      lastUpdatedAt: 0,
      lastSyncedAt: -1,
    });
    g.setValue(5, 5, null);
    g.setValue(1, 5, "hello");
    g.setValue(3, 3, "world");
    testGrid(false, g, {
      rows: [
        { r: 0, cells: [] },
        { r: 1, cells: [{ r: 1, c: 5, value: "hello", y: 0, h: 30 }] },
        { r: 2, cells: [] },
        { r: 3, cells: [{ r: 3, c: 3, value: "world", y: 0, h: 30 }] },
        { r: 4, cells: [] },
        { r: 5, cells: [] },
      ],
      lastUpdatedAt: 0,
      lastSyncedAt: -1,
    });
  });

  test("Test Layouts", () => {
    const g = new GridModel();
    g.setValue(1, 1, 10.5);
    g.setValue(2, 2, "Hello");
    g.setValue(3, 3, "World");
    g.setValue(4, 4, "testing");
    g.setValue(5, 5, "30");
    testGrid(false, g, {
      rows: [
        { r: 0, cells: [] },
        { r: 1, cells: [{ r: 1, c: 1, value: 10.5, y: 0, h: 30 }] },
        { r: 2, cells: [{ r: 2, c: 2, value: "Hello", y: 0, h: 30 }] },
        { r: 3, cells: [{ r: 3, c: 3, value: "World", y: 0, h: 30 }] },
        { r: 4, cells: [{ r: 4, c: 4, value: "testing", y: 0, h: 30 }] },
        { r: 5, cells: [{ r: 5, c: 5, value: "30", y: 0, h: 30 }] },
      ],
      lastUpdatedAt: 0,
      lastSyncedAt: -1,
    });
    const alcols = [] as ColAlign[];
    for (let i = 1; i <= 5; i++) {
      const cell = g.getRow(i).cellAt(i) as GridCell;
      cell.colAlign = alcols[i] = new ColAlign();
    }

    testGrid(false, g, {
      rows: [
        { r: 0, cells: [] },
        { r: 1, cells: [{ r: 1, c: 1, value: 10.5, y: 0, h: 30, x: 0, w: 30 }] },
        { r: 2, cells: [{ r: 2, c: 2, value: "Hello", y: 0, h: 30, x: 0, w: 30 }] },
        { r: 3, cells: [{ r: 3, c: 3, value: "World", y: 0, h: 30, x: 0, w: 30 }] },
        { r: 4, cells: [{ r: 4, c: 4, value: "testing", y: 0, h: 30, x: 0, w: 30 }] },
        { r: 5, cells: [{ r: 5, c: 5, value: "30", y: 0, h: 30, x: 0, w: 30 }] },
      ],
      lastUpdatedAt: 0,
      lastSyncedAt: -1,
    });
  });
});
