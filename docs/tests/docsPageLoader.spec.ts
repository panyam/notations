/**
 * @jest-environment jsdom
 */
import { needsNotations, startDocsPage } from "../components/docsPageLoader";

describe("docs page loader", () => {
  test("a page without notation skips the notation code", async () => {
    document.body.innerHTML = "<main><p>API reference</p><pre><code>N.load(source)</code></pre></main>";
    const load = jest.fn();
    expect(needsNotations(document)).toBe(false);
    await startDocsPage(document, load);
    expect(load).not.toHaveBeenCalled();
  });

  test("a page with a <notation> loads it and starts the page", async () => {
    document.body.innerHTML = "<notation>S R G M</notation>";
    const init = jest.fn(() => "page");
    const load = jest.fn(async () => ({ initDocsPage: init }));
    await startDocsPage(document, load);
    expect(load).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenCalledTimes(1);
    expect((window as any).docsPage).toBe("page");
  });

  test("an element marked data-notations loads it too, for demo scripts that use window.N", () => {
    document.body.innerHTML = '<div id="model-events-demo" data-notations></div>';
    expect(needsNotations(document)).toBe(true);
  });
});
