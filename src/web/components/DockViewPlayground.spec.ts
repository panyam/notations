/**
 * @jest-environment jsdom
 */
import DockViewPlayground, { DockViewPlaygroundConfig } from "./DockViewPlayground";

// jsdom has no ResizeObserver, and dockview watches its container with one.
class NoResize {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as any).ResizeObserver = NoResize;
// The notation renderer measures SVG text, and jsdom has no layout.
(SVGElement.prototype as any).getBBox = () => ({ x: 0, y: 0, width: 10, height: 10 });

const KEY = "spec-playground";
let container: HTMLElement;
const made: DockViewPlayground[] = [];

function make(config: DockViewPlaygroundConfig = {}): DockViewPlayground {
  const p = new DockViewPlayground(container, { storageKey: KEY, initialSource: "Sw: S R G M", ...config });
  made.push(p);
  return p;
}

// dockview reports layout changes a microtask late, and the dock saves when it hears one.
const settle = () => new Promise((r) => setTimeout(r, 0));
const open = (p: DockViewPlayground) => p.dock.api.panels.map((x) => x.id).sort();
const darkDock = () =>
  container.querySelector(".dockview-theme-dark") !== null || container.classList.contains("dockview-theme-dark");

beforeEach(() => {
  container = document.createElement("div");
  Object.defineProperty(container, "clientWidth", { value: 1000, configurable: true });
  Object.defineProperty(container, "clientHeight", { value: 800, configurable: true });
  document.body.appendChild(container);
  localStorage.clear();
});

afterEach(() => {
  for (const p of made.splice(0)) p.destroy();
  container.remove();
  document.documentElement.classList.remove("dark");
});

describe("DockViewPlayground", () => {
  test("opens the editor, output and console by default", () => {
    const p = make();
    expect(open(p)).toEqual(["console", "editor", "output"]);
    expect(p.isConsoleVisible()).toBe(true);
    expect(p.source).toBe("Sw: S R G M");
  });

  test("shows the editor's textarea and output in their panels", () => {
    const p = make();
    expect(container.contains(p.editor!.editorElement)).toBe(true);
    expect(container.contains(p.editor!.outputElement)).toBe(true);
  });

  test("leaves the console closed with showConsole false, and toggles it", () => {
    const p = make({ showConsole: false });
    expect(open(p)).toEqual(["editor", "output"]);
    expect(p.toggleConsole()).toBe(true);
    expect(open(p)).toContain("console");
    expect(p.toggleConsole()).toBe(false);
    expect(open(p)).not.toContain("console");
  });

  test("keeps console lines across a hide and show", () => {
    const p = make();
    p.clearConsole();
    p.log("kept", "info");
    p.hideConsole();
    p.showConsole();
    expect(container.querySelector(".dvp-console-output")?.textContent).toContain("kept");
  });

  test("restores a closed console from the saved layout, and says so", async () => {
    const first = make();
    first.hideConsole();
    await settle();
    first.destroy();
    made.splice(0);

    const again = make();
    expect(open(again)).toEqual(["editor", "output"]);
    expect(again.isConsoleVisible()).toBe(false);
  });

  test("resetLayout brings the console back", async () => {
    const p = make();
    p.hideConsole();
    await settle();
    p.resetLayout();
    expect(open(p)).toEqual(["console", "editor", "output"]);
    expect(p.isConsoleVisible()).toBe(true);
  });

  test("a new layoutVersion ignores the old save", async () => {
    const first = make();
    first.hideConsole();
    await settle();
    first.destroy();
    made.splice(0);

    const again = make({ layoutVersion: 2 });
    expect(open(again)).toEqual(["console", "editor", "output"]);
  });

  test("follows <html class=dark>", async () => {
    make();
    expect(darkDock()).toBe(false);
    document.documentElement.classList.add("dark");
    await settle();
    expect(darkDock()).toBe(true);
  });

  test("opens the console at consoleHeight of the container", () => {
    const consoleHeight = (p: DockViewPlayground) => p.dock.api.getPanel("console")!.group.api.height;
    const byDefault = consoleHeight(make());
    for (const p of made.splice(0)) p.destroy();
    localStorage.clear();
    expect(consoleHeight(make({ consoleHeight: 0.25 }))).toBe(200);
    expect(byDefault).toBeLessThan(200);
  });

  test("exposes the dock for a Panels menu", () => {
    const p = make();
    const host = document.createElement("div");
    p.dock.panelsMenu(host);
    expect(host.querySelector("[class*=dock-panels]")).not.toBeNull();
  });

  // axe flags a control nested in a role="tab" as nested-interactive (#89).
  test("puts no interactive control inside a panel tab", () => {
    make();
    const tabs = container.querySelectorAll(".dv-tab");
    expect(tabs.length).toBe(3);
    for (const tab of tabs) {
      expect(tab.querySelectorAll("[role], [tabindex], button, a, input").length).toBe(0);
    }
  });

  describe("printing (#74)", () => {
    const printRoot = () => document.querySelector(".notations-print-root");
    afterEach(() => jest.restoreAllMocks());

    test("print() opens the print dialog with only the notation, then cleans up", () => {
      const p = make({ initialSource: "Sw: S R G M" });
      let lines = 0;
      jest.spyOn(window, "print").mockImplementation(() => {
        lines = printRoot()!.querySelectorAll("svg.lineRootSVG").length;
      });
      p.print();
      expect(window.print).toHaveBeenCalledTimes(1);
      expect(lines).toBe(1);
      window.dispatchEvent(new Event("afterprint"));
      expect(printRoot()).toBeNull();
    });

    test("the browser's own Print prints the notation too", () => {
      make({ initialSource: "Sw: S R G M" });
      window.dispatchEvent(new Event("beforeprint"));
      expect(printRoot()!.querySelectorAll("svg.lineRootSVG").length).toBe(1);
      window.dispatchEvent(new Event("afterprint"));
      expect(printRoot()).toBeNull();
    });

    test("stops listening for the browser's Print once destroyed", () => {
      const p = make({ initialSource: "Sw: S R G M" });
      p.destroy();
      made.splice(made.indexOf(p), 1);
      window.dispatchEvent(new Event("beforeprint"));
      expect(printRoot()).toBeNull();
    });
  });
});
