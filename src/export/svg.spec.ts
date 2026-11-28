/**
 * @jest-environment jsdom
 */
import { downloadSVG, exportSVG } from "./svg";

// The renderer measures SVG text, and jsdom has no layout. Ten pixels per text element gives a
// line with more notes a wider box.
(SVGElement.prototype as any).getBBox = function (this: SVGElement) {
  return { x: 0, y: 0, width: 10 * this.querySelectorAll("text").length, height: 40 };
};

const SOURCE = `---
Composer: Thyagaraja
---
\\cycle("|4|2|2|")
\\beatDuration(4)

> #### Pallavi

\\line(marginText = "1")
Sw: S R G M P D N S.

\\line(marginText = "10")
Sw: S R G M`;

// Enough markdown for the heading in SOURCE.
const md = (c: string) => c.replace(/^####\s+(.*)$/m, "<h4>$1</h4>");
const svgOf = (opts: Parameters<typeof exportSVG>[1] = {}) => exportSVG(SOURCE, { markdownParser: md, ...opts });

const parse = (svg: string) => new DOMParser().parseFromString(svg, "image/svg+xml").documentElement;
const texts = (root: Element) => [...root.querySelectorAll("text")];
const textOf = (root: Element, s: string) => texts(root).find((t) => t.textContent?.trim() === s);

afterEach(() => {
  document.body.innerHTML = "";
  jest.restoreAllMocks();
});

describe("exportSVG", () => {
  test("returns one standalone SVG document with a size and a viewBox", () => {
    const root = parse(svgOf());
    expect(root.tagName).toBe("svg");
    expect(root.getAttribute("xmlns")).toBe("http://www.w3.org/2000/svg");
    const [w, h] = [Number(root.getAttribute("width")), Number(root.getAttribute("height"))];
    expect(w).toBeGreaterThan(0);
    expect(h).toBeGreaterThan(0);
    expect(root.getAttribute("viewBox")).toBe(`0 0 ${w} ${h}`);
  });

  test("stacks each notation line as a nested svg, top to bottom", () => {
    const lines = [...parse(svgOf()).querySelectorAll("svg.lineRootSVG")];
    expect(lines.length).toBe(2);
    const ys = lines.map((l) => Number(l.getAttribute("y")));
    expect(ys[1]).toBeGreaterThan(ys[0]);
  });

  test("writes headings and front matter as SVG text, with no foreignObject", () => {
    const root = parse(svgOf());
    expect(root.querySelector("foreignObject")).toBeNull();
    expect(textOf(root, "Pallavi")).toBeDefined();
    const composer = texts(root).find((t) => t.textContent?.includes("Thyagaraja"))!;
    expect(composer).toBeDefined();
    const bold = composer.querySelector("tspan[font-weight='bold']");
    expect(bold?.textContent).toBe("Composer");
  });

  test("puts the heading above the lines it introduces", () => {
    const root = parse(svgOf());
    const headingY = Number(textOf(root, "Pallavi")!.getAttribute("y"));
    const firstLineY = Number(root.querySelector("svg.lineRootSVG")!.getAttribute("y"));
    expect(headingY).toBeLessThan(firstLineY);
  });

  test("right-aligns margin labels by default, so they end at the same x", () => {
    const root = parse(svgOf());
    const [one, ten] = [textOf(root, "1")!, textOf(root, "10")!];
    expect(one.getAttribute("text-anchor")).toBe("end");
    expect(one.getAttribute("x")).toBe(ten.getAttribute("x"));
  });

  test("follows marginAlign for the labels", () => {
    const root = parse(svgOf({ marginAlign: "center" }));
    expect(textOf(root, "10")!.getAttribute("text-anchor")).toBe("middle");
  });

  test("gives every text element its own fill, so it doesn't need the page's CSS", () => {
    const hasFill = (t: Element) => !!t.getAttribute("fill") || /(^|;)\s*fill:/.test(t.getAttribute("style") ?? "");
    const all = texts(parse(svgOf()));
    expect(all.length).toBeGreaterThan(0);
    expect(all.filter((t) => !hasFill(t))).toEqual([]);
  });

  test("paints a white background by default, and none when background is null", () => {
    const bg = (svg: string) => parse(svg).querySelector(":scope > rect");
    expect(bg(svgOf())?.getAttribute("fill")).toBe("white");
    expect(bg(svgOf({ background: null }))).toBeNull();
  });

  test("exports in the light theme and gives a dark page its theme back", () => {
    document.documentElement.className = "dark";
    document.documentElement.setAttribute("data-theme", "dark");
    let during = "";
    const spy = jest.spyOn(SVGElement.prototype as any, "getBBox");
    spy.mockImplementation(function (this: SVGElement) {
      during ||= `${document.documentElement.className}|${document.documentElement.getAttribute("data-theme")}`;
      return { x: 0, y: 0, width: 10 * this.querySelectorAll("text").length, height: 40 };
    });
    svgOf();
    expect(during).toBe("light|light");
    expect(document.documentElement.className).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-theme");
  });

  test("leaves out the renderer's bookkeeping attributes", () => {
    expect(svgOf()).not.toMatch(/\b(sourceatomid|atomid|beatid|gridrow)=/i);
  });

  test("leaves nothing behind in the page", () => {
    svgOf();
    expect(document.body.children.length).toBe(0);
  });
});

describe("downloadSVG", () => {
  test("saves the SVG under the given file name", () => {
    let saved: Blob | null = null;
    (URL as any).createObjectURL = jest.fn((b: Blob) => {
      saved = b;
      return "blob:x";
    });
    (URL as any).revokeObjectURL = jest.fn();
    const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    downloadSVG(SOURCE, "song.svg");
    expect(click).toHaveBeenCalledTimes(1);
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe("song.svg");
    expect(saved!.type).toBe("image/svg+xml");
  });
});
