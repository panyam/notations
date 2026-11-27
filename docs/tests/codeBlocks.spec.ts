/**
 * @jest-environment jsdom
 */
import { focusableWhenScrolling } from "../components/codeBlocks";

function pre(scrollWidth: number, clientWidth: number): HTMLElement {
  const el = document.createElement("pre");
  Object.defineProperty(el, "scrollWidth", { configurable: true, get: () => scrollWidth });
  Object.defineProperty(el, "clientWidth", { configurable: true, get: () => clientWidth });
  return el;
}

describe("code blocks that scroll", () => {
  test("a block wider than its box can take focus; one that fits stays out of the tab order", () => {
    const wide = pre(600, 300);
    const narrow = pre(300, 300);
    focusableWhenScrolling([wide, narrow]);
    expect(wide.getAttribute("tabindex")).toBe("0");
    expect(wide.getAttribute("role")).toBe("region");
    expect(wide.getAttribute("aria-label")).toBe("Code");
    expect(narrow.hasAttribute("tabindex")).toBe(false);
  });

  test("a block that stops scrolling, after a resize, loses the tab stop again", () => {
    let width = 600;
    const el = document.createElement("pre");
    Object.defineProperty(el, "scrollWidth", { get: () => width });
    Object.defineProperty(el, "clientWidth", { get: () => 300 });
    focusableWhenScrolling([el]);
    width = 300;
    focusableWhenScrolling([el]);
    expect(el.hasAttribute("tabindex")).toBe(false);
    expect(el.hasAttribute("role")).toBe(false);
  });
});
