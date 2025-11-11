import * as N from "notations";
import * as NV from "./NotationViewer";

export default class NotationBlock {
  id: string
  source: string
  caption = ""
  height: string
  newRoot: HTMLDivElement
  notationView: N.Carnatic.NotationView;
  showSource: boolean
  constructor(public readonly container: HTMLElement) {
    this.id = (container.getAttribute("id") || "").trim()
    this.caption = (container.getAttribute("caption") || "").trim()
    const sourceFrom = (container.getAttribute("sourceFrom") || "").trim()
    this.source = container.textContent || "";
    if (sourceFrom.length > 0) {
      const sourceElem = document.getElementById(sourceFrom)
      if (sourceElem) {
        this.source = sourceElem.textContent || ""
      }
    }
    this.height = container.getAttribute("height") ||  ""
    this.showSource = (container.getAttribute("showSource") || "false") == "true"
    const parent = (container.parentNode as HTMLDivElement)
    const newRoot = document.createElement("div")
    newRoot.classList.add("notationBlockRoot")
    this.newRoot = newRoot
    let html = `
      <span><strong>Output:</strong></span>
      <div  id = "notationViewer_${this.id}"
            class="notation-view">
      </div>
    `;
    if (this.showSource) {
      const sourceLines = this.source.split("\n")
      const prefix = `
        <figure class="notation-container">
          <figcaption class="notation-caption">${this.caption}</figcaption>
          <div class="notation-source" id = "notationSource_${this.id}">
            <pre class="notation-source-pre">
              <code>${sourceLines.map(x => `<span>${x}</span>`).join("\n")}</code>
            </pre></div></figure>`
      html = prefix + html
    }
    newRoot.innerHTML = html;
    parent.insertBefore(newRoot, container)
    parent.removeChild(container)
    const notationViewerBlock = newRoot.querySelector(".notation-view") as HTMLDivElement
    this.notationView = NV.createViewer(notationViewerBlock);

   this.updatePreview()
   console.log("Done Rendering... Adjusting height")
  }

  updatePreview(): void {
    const fullContents = this.source;
    // HACK - Find a way to set this table Element's contents instead of clearing it here
    // otherwise we end up appending the results of render again and again at the end of the table
    this.notationView.tableElement.innerHTML = "";
    const [notation, beatLayout, errors, timings] = N.load(fullContents, { log: true });
    if (errors.length > 0) {
      console.log("Errors: ", errors);
    } else {
      console.log("Rendering notation...");
      this.notationView.renderNotation(notation, beatLayout);
    }
    const msg = `Document parsed (${Math.trunc(timings.parseTime * 100) / 100} ms) and built (${
      Math.trunc(timings.buildTime * 100) / 100
    } ms)`;
    console.log(msg);
  }

  get captionId(): string {
    return "notationCaption_" + this.id
  }
}
