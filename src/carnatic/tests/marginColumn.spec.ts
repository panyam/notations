/**
 * @jest-environment jsdom
 */
import * as fs from "fs";
import * as path from "path";
import { NotationView } from "../NotationView";

const SCSS = fs.readFileSync(path.resolve(__dirname, "../../../styles/NotationView.scss"), "utf8");

/** The declarations inside the first `selector { ... }` block of the stylesheet. */
function rule(selector: string): string {
  const at = SCSS.indexOf(selector + " {");
  expect(at).toBeGreaterThanOrEqual(0);
  return SCSS.slice(at, SCSS.indexOf("}", at));
}

describe("margin column (#97)", () => {
  // jsdom has no table layout, so these check the stylesheet's contract rather than a measured width.
  test("shrinks to its content instead of taking a share of the table's spare width", () => {
    const cell = rule(".lineAnnotationCell");
    expect(cell).toMatch(/width:\s*1%;/);
    expect(cell).toMatch(/white-space:\s*nowrap;/);
  });

  test("aligns its labels by --notation-margin-align, which defaults to right", () => {
    expect(rule(".lineAnnotationCell")).toMatch(/text-align:\s*var\(--notation-margin-align\);/);
    expect(rule(":root")).toMatch(/--notation-margin-align:\s*right;/);
  });

  test("marginAlign sets the alignment for one view", () => {
    const view = new NotationView(document.createElement("div"), { marginAlign: "center" });
    expect(view.tableElement.style.getPropertyValue("--notation-margin-align")).toBe("center");
  });

  test("without marginAlign a view leaves the alignment to the stylesheet", () => {
    const view = new NotationView(document.createElement("div"));
    expect(view.tableElement.style.getPropertyValue("--notation-margin-align")).toBe("");
  });
});
