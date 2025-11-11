import { NotationBlock, NotationBlockConfig } from "@notations/web-components";
import * as NV from "./NotationViewer";

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
