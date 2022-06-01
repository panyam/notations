import * as TSU from "@panyam/tsutils";
import { GridLayoutGroup, GridRow, GridModel, GridCellView, GridCell, ColAlign } from "../grids";

function testGrid(debug: boolean, found: GridModel, expected: any, getCellView?: any): void {
  if (debug) {
    console.log("Expected Grid: \n", JSON.stringify(expected, TSU.Misc.getCircularReplacer(), 2));
    console.log("Found Grid: \n", JSON.stringify(found.debugValue(), TSU.Misc.getCircularReplacer(), 2));
  }
  expect(found.debugValue()).toEqual(expected);

  // Now ensure that a cell's bounds match that of its view
  if (getCellView) {
    for (const row of found.rows) {
      for (const cell of row.cells) {
        if (cell != null) {
          const view = getCellView(cell);
          expect(view.x).toEqual(cell.colAlign.coordOffset);
          expect(view.width).toEqual(cell.colAlign.maxLength);
          expect(view.y).toEqual(cell.rowAlign.coordOffset);
          expect(view.height).toEqual(cell.rowAlign.maxLength);
        }
      }
    }
  }
}

class TestCellView {
  x = 0;
  y = 0;
  width = 0;
  height = 0;
  needsLayout = false;

  constructor(public readonly cell: GridCell) {
    //
  }

  get minSize() {
    const l = ("" + this.cell.value).length;
    return {
      width: 10 * l,
      height: 20 + l,
    };
  }

  setBounds(x: number | null, y: number | null, w: number | null, h: number | null, applyBounds = false) {
    if (x != null) this.x = x;
    if (y != null) this.y = y;
    if (w != null) this.width = w;
    if (h != null) this.height = h;
  }
}

function createTestLG(): GridLayoutGroup {
  const cellViews = {} as any;
  const layoutGroup = new GridLayoutGroup();
  layoutGroup.getCellView = (cell: GridCell): GridCellView => {
    const key = cell.grid.uuid + ":" + cell.location;
    if (!(key in cellViews)) {
      cellViews[key] = new TestCellView(cell);
    }
    return cellViews[key];
  };
  return layoutGroup;
}

function createTestGridModel(values: any[][], lg?: GridLayoutGroup, alcols?: ColAlign[]) {
  const g = new GridModel();
  if (lg) lg.addGridModel(g);
  if (!alcols) {
    alcols = [] as ColAlign[];
  }
  function getColAl(col: number): ColAlign {
    alcols = alcols as ColAlign[];
    while (col >= alcols.length) {
      const ind: number = alcols.length;
      alcols.push(new ColAlign());
      alcols[ind].setPadding(5, 5);
      if (ind > 0) {
        alcols[ind - 1].addSuccessor(alcols[ind]);
      }
    }
    return alcols[col];
  }

  const cellCreator = (gridRow: GridRow, col: number) => {
    const cell = new GridCell(gridRow, col);
    cell.colAlign = getColAl(col);
    return cell;
  };
  g.eventHub?.startBatchMode();
  for (let row = 0; row < values.length; row++) {
    for (let col = 0; col < values[row].length; col++) {
      if (values[row][col] != null) {
        g.setValue(row, col, values[row][col], cellCreator);
      }
    }
  }
  g.eventHub?.commitBatch();
  return g;
}

describe("Basic GridModel Tests", () => {
  test("Creation", () => {
    const g = new GridModel();
    testGrid(false, g, { rows: [], lastUpdatedAt: 0 });
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
    });
  });
});

describe("Basic GridView Tests", () => {
  test("Test Layouts", () => {
    const lg = createTestLG();
    const g = createTestGridModel(
      [
        [null],
        [null, 10.5],
        [null, null, "Hello"],
        [null, null, null, "World"],
        [null, null, null, null, "testing"],
        [null, null, null, null, null, "30"],
      ],
      lg,
    );

    testGrid(false, g, {
      rows: [
        { r: 0, cells: [] },
        { r: 1, cells: [{ r: 1, c: 1, value: 10.5, y: 0, h: 54, x: 0, w: 50 }] },
        { r: 2, cells: [{ r: 2, c: 2, value: "Hello", y: 54, h: 55, x: 50, w: 60 }] },
        { r: 3, cells: [{ r: 3, c: 3, value: "World", y: 109, h: 55, x: 110, w: 60 }] },
        { r: 4, cells: [{ r: 4, c: 4, value: "testing", y: 164, h: 57, x: 170, w: 80 }] },
        { r: 5, cells: [{ r: 5, c: 5, value: "30", y: 221, h: 52, x: 250, w: 30 }] },
      ],
      lastUpdatedAt: 0,
    });
  });

  test("Test Layouts with Full Grid and ensure refreshLayout is idempotent", () => {
    const lg = createTestLG();
    const g = createTestGridModel(
      [
        [1, 2, 3, 4, 5],
        ["APPLE", "Orange", "WaterMelon", "Grape", null],
        ["India", null, "NZ", "Australia", "Sri Lanka"],
        [null, null, "Antartica"],
      ],
      lg,
    );

    testGrid(false, g, {
      rows: [
        {
          r: 0,
          cells: [
            { r: 0, c: 0, value: 1, y: 0, h: 51, x: 0, w: 60 },
            { r: 0, c: 1, value: 2, y: 0, h: 51, x: 60, w: 70 },
            { r: 0, c: 2, value: 3, y: 0, h: 51, x: 130, w: 110 },
            { r: 0, c: 3, value: 4, y: 0, h: 51, x: 240, w: 100 },
            { r: 0, c: 4, value: 5, y: 0, h: 51, x: 340, w: 100 },
          ],
        },
        {
          r: 1,
          cells: [
            { r: 1, c: 0, value: "APPLE", y: 51, h: 60, x: 0, w: 60 },
            { r: 1, c: 1, value: "Orange", y: 51, h: 60, x: 60, w: 70 },
            { r: 1, c: 2, value: "WaterMelon", y: 51, h: 60, x: 130, w: 110 },
            { r: 1, c: 3, value: "Grape", y: 51, h: 60, x: 240, w: 100 },
          ],
        },
        {
          r: 2,
          cells: [
            { r: 2, c: 0, value: "India", y: 111, h: 59, x: 0, w: 60 },
            { r: 2, c: 2, value: "NZ", y: 111, h: 59, x: 130, w: 110 },
            { r: 2, c: 3, value: "Australia", y: 111, h: 59, x: 240, w: 100 },
            { r: 2, c: 4, value: "Sri Lanka", y: 111, h: 59, x: 340, w: 100 },
          ],
        },
        {
          r: 3,
          cells: [{ r: 3, c: 2, value: "Antartica", y: 170, h: 59, x: 130, w: 110 }],
        },
      ],
      lastUpdatedAt: 0,
    });

    lg.refreshLayout();
    lg.refreshLayout();
    lg.refreshLayout();

    testGrid(false, g, {
      rows: [
        {
          r: 0,
          cells: [
            { r: 0, c: 0, value: 1, y: 0, h: 51, x: 0, w: 60 },
            { r: 0, c: 1, value: 2, y: 0, h: 51, x: 60, w: 70 },
            { r: 0, c: 2, value: 3, y: 0, h: 51, x: 130, w: 110 },
            { r: 0, c: 3, value: 4, y: 0, h: 51, x: 240, w: 100 },
            { r: 0, c: 4, value: 5, y: 0, h: 51, x: 340, w: 100 },
          ],
        },
        {
          r: 1,
          cells: [
            { r: 1, c: 0, value: "APPLE", y: 51, h: 60, x: 0, w: 60 },
            { r: 1, c: 1, value: "Orange", y: 51, h: 60, x: 60, w: 70 },
            { r: 1, c: 2, value: "WaterMelon", y: 51, h: 60, x: 130, w: 110 },
            { r: 1, c: 3, value: "Grape", y: 51, h: 60, x: 240, w: 100 },
          ],
        },
        {
          r: 2,
          cells: [
            { r: 2, c: 0, value: "India", y: 111, h: 59, x: 0, w: 60 },
            { r: 2, c: 2, value: "NZ", y: 111, h: 59, x: 130, w: 110 },
            { r: 2, c: 3, value: "Australia", y: 111, h: 59, x: 240, w: 100 },
            { r: 2, c: 4, value: "Sri Lanka", y: 111, h: 59, x: 340, w: 100 },
          ],
        },
        {
          r: 3,
          cells: [{ r: 3, c: 2, value: "Antartica", y: 170, h: 59, x: 130, w: 110 }],
        },
      ],
      lastUpdatedAt: 0,
    });
  });

  test("Test Layouts across grids with same align", () => {
    const lg = createTestLG();
    const alcols = [] as ColAlign[];

    // Render the smaller grid first and then
    // doing the larger grid should resize both
    const g2 = createTestGridModel(
      [
        [100, 200, 300, 40, 500],
        ["A", "B", "C", "DDD", null],
      ],
      lg,
      alcols,
    );

    testGrid(false, g2, {
      rows: [
        {
          r: 0,
          cells: [
            { r: 0, c: 0, value: 100, y: 0, h: 53, x: 0, w: 40 },
            { r: 0, c: 1, value: 200, y: 0, h: 53, x: 40, w: 40 },
            { r: 0, c: 2, value: 300, y: 0, h: 53, x: 80, w: 40 },
            { r: 0, c: 3, value: 40, y: 0, h: 53, x: 120, w: 40 },
            { r: 0, c: 4, value: 500, y: 0, h: 53, x: 160, w: 40 },
          ],
        },
        {
          r: 1,
          cells: [
            { r: 1, c: 0, value: "A", y: 53, h: 53, x: 0, w: 40 },
            { r: 1, c: 1, value: "B", y: 53, h: 53, x: 40, w: 40 },
            { r: 1, c: 2, value: "C", y: 53, h: 53, x: 80, w: 40 },
            { r: 1, c: 3, value: "DDD", y: 53, h: 53, x: 120, w: 40 },
          ],
        },
      ],
      lastUpdatedAt: 0,
    });

    const g = createTestGridModel(
      [
        [1, 2, 3, 4, 5],
        ["APPLE", "Orange", "WaterMelon", "Grape", null],
        ["India", null, "NZ", "Australia", "Sri Lanka"],
        [null, null, "Antartica"],
      ],
      lg,
      alcols,
    );

    testGrid(false, g2, {
      rows: [
        {
          r: 0,
          cells: [
            { r: 0, c: 0, value: 100, y: 0, h: 53, x: 0, w: 60 },
            { r: 0, c: 1, value: 200, y: 0, h: 53, x: 60, w: 70 },
            { r: 0, c: 2, value: 300, y: 0, h: 53, x: 130, w: 110 },
            { r: 0, c: 3, value: 40, y: 0, h: 53, x: 240, w: 100 },
            { r: 0, c: 4, value: 500, y: 0, h: 53, x: 340, w: 100 },
          ],
        },
        {
          r: 1,
          cells: [
            { r: 1, c: 0, value: "A", y: 53, h: 53, x: 0, w: 60 },
            { r: 1, c: 1, value: "B", y: 53, h: 53, x: 60, w: 70 },
            { r: 1, c: 2, value: "C", y: 53, h: 53, x: 130, w: 110 },
            { r: 1, c: 3, value: "DDD", y: 53, h: 53, x: 240, w: 100 },
          ],
        },
      ],
      lastUpdatedAt: 0,
    });

    testGrid(
      false,
      g,
      {
        rows: [
          {
            r: 0,
            cells: [
              { r: 0, c: 0, value: 1, y: 0, h: 51, x: 0, w: 60 },
              { r: 0, c: 1, value: 2, y: 0, h: 51, x: 60, w: 70 },
              { r: 0, c: 2, value: 3, y: 0, h: 51, x: 130, w: 110 },
              { r: 0, c: 3, value: 4, y: 0, h: 51, x: 240, w: 100 },
              { r: 0, c: 4, value: 5, y: 0, h: 51, x: 340, w: 100 },
            ],
          },
          {
            r: 1,
            cells: [
              { r: 1, c: 0, value: "APPLE", y: 51, h: 60, x: 0, w: 60 },
              { r: 1, c: 1, value: "Orange", y: 51, h: 60, x: 60, w: 70 },
              { r: 1, c: 2, value: "WaterMelon", y: 51, h: 60, x: 130, w: 110 },
              { r: 1, c: 3, value: "Grape", y: 51, h: 60, x: 240, w: 100 },
            ],
          },
          {
            r: 2,
            cells: [
              { r: 2, c: 0, value: "India", y: 111, h: 59, x: 0, w: 60 },
              { r: 2, c: 2, value: "NZ", y: 111, h: 59, x: 130, w: 110 },
              { r: 2, c: 3, value: "Australia", y: 111, h: 59, x: 240, w: 100 },
              { r: 2, c: 4, value: "Sri Lanka", y: 111, h: 59, x: 340, w: 100 },
            ],
          },
          {
            r: 3,
            cells: [{ r: 3, c: 2, value: "Antartica", y: 170, h: 59, x: 130, w: 110 }],
          },
        ],
        lastUpdatedAt: 0,
      },
      lg.getCellView,
    );

    /*
    lg.refreshLayout();
    lg.refreshLayout();
    lg.refreshLayout();

    testGrid(false, g, {
      rows: [
        {
          r: 0,
          cells: [
            { r: 0, c: 0, value: 1, y: 0, h: 51, x: 0, w: 70 },
            { r: 0, c: 1, value: 2, y: 0, h: 51, x: 70, w: 70 },
            { r: 0, c: 2, value: 3, y: 0, h: 51, x: 140, w: 130 },
            { r: 0, c: 3, value: 4, y: 0, h: 51, x: 270, w: 100 },
            { r: 0, c: 4, value: 5, y: 0, h: 51, x: 370, w: 100 },
          ],
        },
        {
          r: 1,
          cells: [
            { r: 1, c: 0, value: "APPLE", y: 51, h: 60, x: 0, w: 70 },
            { r: 1, c: 1, value: "Orange", y: 51, h: 60, x: 70, w: 70 },
            { r: 1, c: 2, value: "WaterMelon", y: 51, h: 60, x: 140, w: 130 },
            { r: 1, c: 3, value: "Grape", y: 51, h: 60, x: 270, w: 100 },
          ],
        },
        {
          r: 2,
          cells: [
            { r: 2, c: 0, value: "India", y: 111, h: 59, x: 0, w: 70 },
            { r: 2, c: 2, value: "NZ", y: 111, h: 59, x: 140, w: 130 },
            { r: 2, c: 3, value: "Australia", y: 111, h: 59, x: 270, w: 100 },
            { r: 2, c: 4, value: "Sri Lanka", y: 111, h: 59, x: 370, w: 100 },
          ],
        },
        {
          r: 3,
          cells: [{ r: 3, c: 2, value: "Antartica", y: 170, h: 59, x: 140, w: 130 }],
        },
      ],
      lastUpdatedAt: 0,
    });
   */
  });
});
