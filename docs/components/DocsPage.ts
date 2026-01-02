import { NotationBlock, NotationBlockConfig } from "notations-web";
import * as N from "notations";
import * as NV from "./NotationViewer";

// Import core notation styles (CSS variables for theming)
import "../../styles/NotationView.scss";

// Expose notations library globally for integration demos
(window as any).N = N;

class DocsPage {
  notations: NotationBlock[] = [];

  constructor() {
    // Configure for docs site styling
    const config: NotationBlockConfig = {
      createViewer: NV.createViewer,
      cssClasses: {
        // Docs site uses these CSS classes (defined in main.css)
        sourceContainer: "",
        sourceCaption: "",
        sourceCode: "",
        outputContainer: "",
      }
    };

    // Find and process all <notation> tags
    const genIds = {} as any;
    let genCounter = 1;
    const notations = document.querySelectorAll("notation");

    for (const container of notations) {
      let id = (container.getAttribute("id") || "").trim();
      if (id.length == 0) {
        while (true) {
          id = "notation_" + genCounter++;
          if (!genIds[id] || null) {
            break;
          }
        }
      }
      container.setAttribute("id", id);
      const block = new NotationBlock(container as HTMLElement, config);
      this.notations.push(block);
      console.log("Source: ", id, container.textContent);
    }
  }
}

document.addEventListener("DOMContentLoaded", function() {
  (window as any).docsPage = new DocsPage();
});
