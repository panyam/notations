/**
 * siteHeader.ts - The header's menu drawer (narrow screens) and the search overlay, on every page.
 *
 * Search is Pagefind. `make site` indexes the built pages into dist/docs/pagefind/, and this module
 * loads Pagefind's UI from there the first time the overlay opens, so a visit that never searches
 * fetches none of it. `make run` has no dist/, so the load fails and the overlay says the index is
 * not built.
 *
 * Markup lives in templates/Header.html (#nav-toggle, #main-nav, #search-trigger) and
 * templates/BasePage.html (#search-overlay, with the Pagefind bundle path in data-bundle).
 */

/** Loads a stylesheet or script by URL; rejects when it cannot be fetched. */
export type AssetLoader = (kind: "css" | "js", href: string) => Promise<void>;

export interface SiteHeaderOptions {
  /** Replaces the default loader, which adds a <link> or <script> to <head>. Tests pass their own. */
  loadAsset?: AssetLoader;
}

const injectAsset: AssetLoader = (kind, href) =>
  new Promise((resolve, reject) => {
    const el =
      kind === "css"
        ? Object.assign(document.createElement("link"), { rel: "stylesheet", href })
        : Object.assign(document.createElement("script"), { src: href });
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`could not load ${href}`));
    document.head.appendChild(el);
  });

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

/**
 * Wires the drawer and the search overlay. Either part is skipped when its markup is missing.
 * Returns a function that removes every listener this added.
 */
export function initSiteHeader(doc: Document = document, options: SiteHeaderOptions = {}): () => void {
  const loadAsset = options.loadAsset ?? injectAsset;
  const undo: Array<() => void> = [];
  const listen = (target: EventTarget, type: string, fn: (e: any) => void, capture = false) => {
    target.addEventListener(type, fn, capture);
    undo.push(() => target.removeEventListener(type, fn, capture));
  };

  // ---- Drawer -----------------------------------------------------------------------------
  const toggle = doc.getElementById("nav-toggle");
  const nav = toggle && doc.getElementById(toggle.getAttribute("aria-controls") || "");
  const header = toggle?.closest(".site-header");
  const drawerOpen = () => toggle?.getAttribute("aria-expanded") === "true";
  const setDrawer = (open: boolean, returnFocus: boolean) => {
    if (!toggle || !nav || !header) return;
    toggle.setAttribute("aria-expanded", String(open));
    header.classList.toggle("nav-open", open);
    if (open) (nav.querySelector("a, button") as HTMLElement | null)?.focus();
    else if (returnFocus) toggle.focus();
  };
  if (toggle && nav && header) {
    listen(toggle, "click", () => setDrawer(!drawerOpen(), true));
    // A tap outside closes the drawer and goes no further, so it can't follow a link under it.
    listen(
      doc,
      "click",
      (e: MouseEvent) => {
        if (!drawerOpen()) return;
        const target = e.target as Node;
        if (toggle.contains(target)) return;
        if (nav.contains(target)) {
          if ((target as Element).closest?.("a")) setDrawer(false, false);
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        setDrawer(false, true);
      },
      true,
    );
  }

  // ---- Search -----------------------------------------------------------------------------
  const overlay = doc.getElementById("search-overlay");
  const trigger = doc.getElementById("search-trigger");
  let loaded: Promise<void> | null = null;
  const loadSearch = (): Promise<void> => {
    if (!overlay) return Promise.resolve();
    if (!loaded) {
      const base = overlay.dataset.bundle || "/pagefind/";
      loaded = loadAsset("css", base + "pagefind-ui.css")
        .then(() => loadAsset("js", base + "pagefind-ui.js"))
        .then(() => {
          const PagefindUI = (doc.defaultView as any)?.PagefindUI;
          new PagefindUI({
            element: "#pagefind-search",
            bundlePath: base,
            showSubResults: true,
            showImages: false,
            pageSize: 8,
          });
        })
        .catch(() => {
          const note = doc.getElementById("search-unavailable");
          if (note) note.hidden = false;
          loaded = null; // let a later open try again, e.g. after `make site`
        });
    }
    return loaded;
  };
  const focusInput = () => (overlay?.querySelector("input") as HTMLInputElement | null)?.focus();
  const openSearch = () => {
    if (!overlay) return;
    if (drawerOpen()) setDrawer(false, false);
    overlay.hidden = false;
    doc.body.classList.add("search-open");
    loadSearch().then(focusInput);
    focusInput();
  };
  const closeSearch = () => {
    if (!overlay) return;
    overlay.hidden = true;
    doc.body.classList.remove("search-open");
    trigger?.focus();
  };
  if (overlay) {
    if (trigger) listen(trigger, "click", openSearch);
    listen(overlay, "click", (e: MouseEvent) => {
      if ((e.target as Element).hasAttribute?.("data-search-close")) closeSearch();
    });
  }

  // ---- Keys -------------------------------------------------------------------------------
  listen(doc, "keydown", (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      if (overlay && !overlay.hidden) closeSearch();
      else if (drawerOpen()) setDrawer(false, true);
      return;
    }
    if (!overlay || !overlay.hidden || isTyping(e.target)) return;
    if (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
      e.preventDefault();
      openSearch();
    }
  });

  return () => undo.forEach((fn) => fn());
}
