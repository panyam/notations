/**
 * @jest-environment jsdom
 */
import { preparePrint, printNotation } from "./printNotation";

// The notation renderer measures SVG text, and jsdom has no layout. Ten pixels per text element
// gives a line with more notes a wider box.
(SVGElement.prototype as any).getBBox = function (this: SVGElement) {
  return { x: 0, y: 0, width: 10 * this.querySelectorAll("text").length, height: 40 };
};

const SOURCE = `\\cycle("|4|2|2|")
\\beatDuration(4)
Sw: S R G M P D N S. S. N D P M G R S
\\line
Sw: S R G M`;

const root = () => document.querySelector(".notations-print-root");

afterEach(() => {
  document.body.innerHTML = "";
  document.body.className = "";
  jest.restoreAllMocks();
});

describe("preparePrint", () => {
  test("renders each notation line into a print-only copy and marks the body", () => {
    const cleanup = preparePrint(SOURCE);
    expect(root()).not.toBeNull();
    expect(root()!.querySelectorAll("svg.lineRootSVG").length).toBe(2);
    expect(document.body.classList.contains("notations-printing")).toBe(true);
    cleanup();
  });

  test("scales each line by its viewBox instead of a fixed pixel size", () => {
    const cleanup = preparePrint(SOURCE);
    for (const svg of root()!.querySelectorAll("svg.lineRootSVG")) {
      expect(svg.getAttribute("viewBox")).toMatch(/^0 0 \d+ 55$/);
      expect(svg.hasAttribute("width")).toBe(false);
      expect(svg.hasAttribute("height")).toBe(false);
    }
    cleanup();
  });

  // The widest line fills the page and the rest keep their proportion, so a short line prints
  // with notes the same size as a full one. No line grows past its own width.
  test("scales every line by the same factor", () => {
    const cleanup = preparePrint(SOURCE);
    const [long, short] = [...root()!.querySelectorAll<SVGSVGElement>("svg.lineRootSVG")];
    const widthOf = (svg: SVGSVGElement) => Number(svg.getAttribute("viewBox")!.split(" ")[2]);
    const pct = (w: number) => +((w / widthOf(long)) * 100).toFixed(3);
    expect(widthOf(short)).toBeLessThan(widthOf(long));
    expect(long.style.width).toBe(`min(${widthOf(long)}px, 100%)`);
    expect(short.style.width).toBe(`min(${widthOf(short)}px, ${pct(widthOf(short))}%)`);
    cleanup();
  });

  test("cleanup removes the copy and the body class", () => {
    preparePrint(SOURCE)();
    expect(root()).toBeNull();
    expect(document.body.classList.contains("notations-printing")).toBe(false);
  });

  test("adds the print stylesheet once", () => {
    preparePrint(SOURCE)();
    preparePrint(SOURCE)();
    expect(document.querySelectorAll("style[data-notations-print]").length).toBe(1);
    expect(document.querySelector("style[data-notations-print]")!.textContent).toContain("@media print");
  });
});

describe("printNotation", () => {
  test("opens the print dialog with the copy in place, and removes it after", () => {
    let seen = 0;
    jest.spyOn(window, "print").mockImplementation(() => {
      seen = root()!.querySelectorAll("svg.lineRootSVG").length;
    });
    printNotation(SOURCE);
    expect(window.print).toHaveBeenCalledTimes(1);
    expect(seen).toBe(2);
    window.dispatchEvent(new Event("afterprint"));
    expect(root()).toBeNull();
  });
});
