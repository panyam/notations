/** Webpack entry for every page: the header's drawer and search. See siteHeader.ts. */
import { initSiteHeader } from "./siteHeader";

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initSiteHeader());
} else {
  initSiteHeader();
}
