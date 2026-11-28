/**
 * @jest-environment jsdom
 */
import { load } from "../../loader";
import { walkAtoms } from "../../positions";
import { Group, Literal } from "../../core";
import { NotationView } from "../NotationView";

(SVGElement.prototype as any).getBBox = () => ({ x: 0, y: 0, width: 10, height: 10 });

function render(src: string) {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const [notation, layout] = load(src);
  const view = new NotationView(root, {});
  view.renderNotation(notation, layout);
  const atoms = [...walkAtoms(notation)];
  const byValue = (v: string) => atoms.find((a) => (a as Literal).value == v)!;
  return { view, atoms, byValue };
}

afterEach(() => (document.body.innerHTML = ""));

describe("NotationView lookups and marks (#102)", () => {
  test("finds the rendered element for a parsed note, and the note for an element inside it", () => {
    const { view, byValue } = render("Sw: S R G M");
    const r = byValue("R");
    const els = view.elementsFor(r);
    expect(els.length).toBeGreaterThan(0);
    const text = els[0].querySelector("text") ?? els[0];
    expect(view.atomFor(text)).toBe(r);
  });

  test("finds a group's element", () => {
    const { view, atoms } = render("Sw: S [G M] P");
    const group = atoms.find((a) => a instanceof Group)!;
    expect(view.elementsFor(group).length).toBeGreaterThan(0);
  });

  test("atomFor gives null outside any note", () => {
    const { view } = render("Sw: S R");
    expect(view.atomFor(view.tableElement)).toBeNull();
  });

  test("mark adds a named class to a note's elements, and unmark takes it off", () => {
    const { view, byValue } = render("Sw: S R G M");
    const [r, g] = [byValue("R"), byValue("G")];
    view.mark(r, "playing");
    view.mark(g, "playing");
    expect(view.elementsFor(r).every((e) => e.classList.contains("mark-playing"))).toBe(true);
    view.unmark("playing", r);
    expect(view.elementsFor(r).some((e) => e.classList.contains("mark-playing"))).toBe(false);
    expect(view.elementsFor(g).every((e) => e.classList.contains("mark-playing"))).toBe(true);
    view.unmark("playing");
    expect(view.tableElement.querySelectorAll(".mark-playing").length).toBe(0);
  });
});
