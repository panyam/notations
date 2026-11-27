/**
 * @jest-environment jsdom
 */
import { initSiteHeader } from "../components/siteHeader";

function page(): void {
  document.body.innerHTML = `
    <header class="site-header">
      <button id="nav-toggle" aria-controls="main-nav" aria-expanded="false">Menu</button>
      <nav class="main-nav" id="main-nav">
        <a class="nav-link" href="#a">A</a>
        <a class="nav-link" href="#b">B</a>
      </nav>
      <button id="search-trigger">Search</button>
    </header>
    <main><a id="outside" href="#elsewhere">Elsewhere</a><textarea id="editor"></textarea></main>
    <div id="search-overlay" data-bundle="/notations/pagefind/" hidden>
      <div class="search-backdrop" data-search-close></div>
      <div id="pagefind-search"></div>
      <p id="search-unavailable" hidden>Not built</p>
    </div>`;
}

const toggle = () => document.getElementById("nav-toggle") as HTMLButtonElement;
const header = () => document.querySelector(".site-header") as HTMLElement;
const overlay = () => document.getElementById("search-overlay") as HTMLElement;
const key = (target: EventTarget, k: string, extra: KeyboardEventInit = {}) =>
  target.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...extra }));
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("nav drawer", () => {
  let cleanup: () => void;
  beforeEach(() => {
    page();
    cleanup = initSiteHeader(document, { loadAsset: () => Promise.reject(new Error("no index")) });
  });
  afterEach(() => cleanup());

  test("the menu button opens the drawer and moves focus into it", () => {
    toggle().click();
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(header().classList.contains("nav-open")).toBe(true);
    expect(document.activeElement?.getAttribute("href")).toBe("#a");
  });

  test("Escape closes it and gives focus back to the button", () => {
    toggle().click();
    key(document.activeElement!, "Escape");
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(header().classList.contains("nav-open")).toBe(false);
    expect(document.activeElement).toBe(toggle());
  });

  test("a tap outside closes it without following what was tapped", () => {
    toggle().click();
    const outside = document.getElementById("outside")!;
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    outside.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(header().classList.contains("nav-open")).toBe(false);
  });

  test("following a link in the drawer closes it", () => {
    toggle().click();
    (document.querySelector('a[href="#b"]') as HTMLAnchorElement).click();
    expect(header().classList.contains("nav-open")).toBe(false);
  });
});

describe("search overlay", () => {
  let cleanup: () => void;
  afterEach(() => cleanup());

  test("/ opens search, but not while typing in a field", () => {
    page();
    cleanup = initSiteHeader(document, { loadAsset: () => Promise.reject(new Error("no index")) });
    key(document.getElementById("editor")!, "/");
    expect(overlay().hidden).toBe(true);
    key(document.body, "/");
    expect(overlay().hidden).toBe(false);
  });

  test("Cmd/Ctrl+K opens it and Escape closes it", () => {
    page();
    cleanup = initSiteHeader(document, { loadAsset: () => Promise.reject(new Error("no index")) });
    key(document.body, "k", { ctrlKey: true });
    expect(overlay().hidden).toBe(false);
    key(document.body, "Escape");
    expect(overlay().hidden).toBe(true);
    expect(document.activeElement?.id).toBe("search-trigger");
  });

  test("without an index it says so instead of hanging", async () => {
    page();
    const asked: string[] = [];
    cleanup = initSiteHeader(document, {
      loadAsset: (_kind, href) => {
        asked.push(href);
        return Promise.reject(new Error("404"));
      },
    });
    (document.getElementById("search-trigger") as HTMLButtonElement).click();
    await flush();
    expect(asked[0]).toBe("/notations/pagefind/pagefind-ui.css");
    expect(document.getElementById("search-unavailable")!.hidden).toBe(false);
  });

  test("the bundle loads once, on first open", async () => {
    page();
    let loads = 0;
    (window as any).PagefindUI = function () {};
    cleanup = initSiteHeader(document, {
      loadAsset: () => {
        loads++;
        return Promise.resolve();
      },
    });
    const trigger = document.getElementById("search-trigger") as HTMLButtonElement;
    expect(loads).toBe(0);
    trigger.click();
    await flush();
    key(document.body, "Escape");
    trigger.click();
    await flush();
    expect(loads).toBe(2); // the CSS and the JS, once each
    delete (window as any).PagefindUI;
  });
});
