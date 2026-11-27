/** Webpack entry for every page: the header's drawer and search, and code-block focus. */
import { initCodeBlocks } from "./codeBlocks";
import { initSiteHeader } from "./siteHeader";

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initSiteHeader();
    initCodeBlocks();
  });
} else {
  initSiteHeader();
  initCodeBlocks();
}
