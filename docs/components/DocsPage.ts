/** Webpack entry for docs pages. See docsPageLoader.ts for when the notation code loads. */
import { startDocsPage } from "./docsPageLoader";

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => startDocsPage());
} else {
  startDocsPage();
}
