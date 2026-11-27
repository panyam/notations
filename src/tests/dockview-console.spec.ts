/**
 * @jest-environment jsdom
 */
import DockViewPlayground from "../web/components/DockViewPlayground";

describe("DockViewPlayground console", () => {
  test("the console output is a focusable, labelled log", () => {
    const out: HTMLElement = (DockViewPlayground.prototype as any).buildConsoleOutput.call({});
    expect(out.getAttribute("tabindex")).toBe("0");
    expect(out.getAttribute("role")).toBe("log");
    expect(out.getAttribute("aria-label")).toBe("Console");
  });
});
