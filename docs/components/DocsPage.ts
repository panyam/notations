import NotationBlock from "./NotationBlock"

class DocsPage {
  notations: NotationBlock[] = [];
  constructor() {
    // populate all drawings
    const genIds = {} as any;
    let genCounter = 1;
    const notations = document.querySelectorAll("notation")
    for (const container of notations) {
      let id = (container.getAttribute("id") || "").trim()
      if (id.length == 0) {
        while (true) {
          id = "notation_" + genCounter++;
          if (!genIds[id] || null) {
            break
          }
        }
      }
      container.setAttribute("id", id)
      const block = new NotationBlock(container as HTMLElement);
      this.notations.push(block)
      console.log("Source: ", id, container.textContent)
    }
  }
}

document.addEventListener("DOMContentLoaded", function() {
  (window as any).docsPage = new DocsPage()
})
