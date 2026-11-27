import { parseCrop, pdfPageSize, pdftoppmArgs } from "../../scripts/pdfRegion";

describe("parseCrop", () => {
  test("reads x,y,w,h as fractions of the page", () => {
    expect(parseCrop("0,0.05,1,0.2")).toEqual({ x: 0, y: 0.05, w: 1, h: 0.2 });
  });

  test("rejects anything that is not four fractions inside the page", () => {
    expect(() => parseCrop("0,0,1")).toThrow(/x,y,w,h/);
    expect(() => parseCrop("0,0,1,abc")).toThrow(/x,y,w,h/);
    expect(() => parseCrop("0.5,0,0.6,1")).toThrow(/inside the page/);
    expect(() => parseCrop("0,0,0,0.5")).toThrow(/inside the page/);
  });
});

describe("pdfPageSize", () => {
  const info = "Pages:           2\nPage    1 size:  578 x 748 pts\nPage    2 size:  612 x 792 pts (letter)\n";

  test("finds the size of the page asked for", () => {
    expect(pdfPageSize(info, 1)).toEqual({ width: 578, height: 748 });
    expect(pdfPageSize(info, 2)).toEqual({ width: 612, height: 792 });
  });

  test("throws for a page pdfinfo did not list", () => {
    expect(() => pdfPageSize(info, 3)).toThrow(/page 3/);
  });
});

describe("pdftoppmArgs", () => {
  test("renders just the page asked for", () => {
    expect(pdftoppmArgs("in.pdf", "/tmp/out", { page: 2 })).toEqual([
      "-r",
      "200",
      "-f",
      "2",
      "-l",
      "2",
      "-jpeg",
      "in.pdf",
      "/tmp/out",
    ]);
  });

  test("cuts the region at 300 dpi before anything is downscaled", () => {
    // 578 x 748 pts at 300 dpi is 2408 x 3117 px.
    const args = pdftoppmArgs("in.pdf", "/tmp/out", {
      page: 1,
      crop: { x: 0, y: 0.05, w: 1, h: 0.2 },
      pageSize: { width: 578, height: 748 },
    });
    expect(args).toEqual([
      "-r",
      "300",
      "-f",
      "1",
      "-l",
      "1",
      "-x",
      "0",
      "-y",
      "156",
      "-W",
      "2408",
      "-H",
      "623",
      "-jpeg",
      "in.pdf",
      "/tmp/out",
    ]);
  });

  test("renders every page when no page is given", () => {
    expect(pdftoppmArgs("in.pdf", "/tmp/out", {})).toEqual(["-r", "200", "-jpeg", "in.pdf", "/tmp/out"]);
  });

  test("a crop needs the page size", () => {
    expect(() => pdftoppmArgs("in.pdf", "/tmp/out", { page: 1, crop: { x: 0, y: 0, w: 1, h: 0.5 } })).toThrow(
      /page size/,
    );
  });
});
