import { isPdf, pdfPageName, pdfRenderScale, PDF_PAGE_EDGE } from "../../components/photo/pdfPages";

describe("pdfPages helpers", () => {
  test("isPdf goes by MIME type or extension", () => {
    expect(isPdf(new File([], "a.pdf", { type: "application/pdf" }))).toBe(true);
    // Some drag sources give an empty type.
    expect(isPdf(new File([], "Notebook.PDF", { type: "" }))).toBe(true);
    expect(isPdf(new File([], "page.png", { type: "image/png" }))).toBe(false);
  });

  test("pdfRenderScale puts the long edge at the target size", () => {
    // US Letter portrait, 612 x 792 pt.
    expect(pdfRenderScale(612, 792) * 792).toBeCloseTo(PDF_PAGE_EDGE);
    // Landscape: width is the long edge.
    expect(pdfRenderScale(792, 612, 1000) * 792).toBeCloseTo(1000);
    expect(pdfRenderScale(0, 0)).toBe(1);
  });

  test("pdfPageName numbers pages so they sort in order", () => {
    expect(pdfPageName("varnam.pdf", 2, 2)).toBe("varnam-p2.png");
    expect(pdfPageName("varnam.PDF", 3, 12)).toBe("varnam-p03.png");
  });
});
