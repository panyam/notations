/**
 * docsPageLoader.ts - Loads the notation code only on pages that need it.
 *
 * The parser and renderer are most of the docs bundle (about 130 KB gzipped). A third of the pages
 * have no <notation> at all (the API pages, Contributing), so they skip it. A page whose own
 * script uses window.N without any <notation> marks an element with data-notations instead.
 */

type NotationsModule = { initDocsPage: () => unknown };

/** True when the page has a <notation>, or an element marked data-notations. */
export function needsNotations(doc: Document): boolean {
  return doc.querySelector("notation, [data-notations]") !== null;
}

const loadNotations = (): Promise<NotationsModule> => import(/* webpackChunkName: "DocsNotations" */ "./DocsNotations");

/**
 * Loads the notation code if the page needs it, then sets up its blocks and exposes the page as
 * window.docsPage. Does nothing on a page without notation.
 */
export async function startDocsPage(
  doc: Document = document,
  load: () => Promise<NotationsModule> = loadNotations,
): Promise<void> {
  if (!needsNotations(doc)) return;
  const { initDocsPage } = await load();
  (doc.defaultView as any).docsPage = initDocsPage();
}
