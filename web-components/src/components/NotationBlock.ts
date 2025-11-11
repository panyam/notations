import * as N from "notations";

export interface NotationBlockConfig {
  /** Function to create a notation viewer - allows different implementations */
  createViewer: (container: HTMLDivElement) => N.Carnatic.NotationView;

  /** CSS classes to apply to various elements */
  cssClasses?: {
    root?: string;
    sourceContainer?: string;
    sourceCaption?: string;
    sourceCode?: string;
    outputLabel?: string;
    outputContainer?: string;
  };
}

export default class NotationBlock {
  id: string;
  source: string;
  caption = "";
  height: string;
  newRoot: HTMLDivElement;
  notationView: N.Carnatic.NotationView;
  showSource: boolean;

  constructor(
    public readonly container: HTMLElement,
    public readonly config: NotationBlockConfig
  ) {
    this.id = (container.getAttribute("id") || "").trim();
    this.caption = (container.getAttribute("caption") || "").trim();
    const sourceFrom = (container.getAttribute("sourceFrom") || "").trim();
    this.source = container.textContent || "";

    if (sourceFrom.length > 0) {
      const sourceElem = document.getElementById(sourceFrom);
      if (sourceElem) {
        this.source = sourceElem.textContent || "";
      }
    }

    this.height = container.getAttribute("height") || "";
    this.showSource = (container.getAttribute("showSource") || "false") == "true";

    const parent = container.parentNode as HTMLDivElement;
    const newRoot = document.createElement("div");
    newRoot.classList.add("notationBlockRoot");
    if (config.cssClasses?.root) {
      newRoot.className += " " + config.cssClasses.root;
    }
    this.newRoot = newRoot;

    // Build HTML structure
    let html = "";

    // Add source code section if showSource is true
    if (this.showSource) {
      const sourceLines = this.source.split("\n");
      const sourceClass = config.cssClasses?.sourceContainer || "";
      const captionClass = config.cssClasses?.sourceCaption || "";
      const codeClass = config.cssClasses?.sourceCode || "";

      html += `
        <figure class="notation-source-block ${sourceClass}">
          <figcaption class="notation-caption ${captionClass}">${this.caption}</figcaption>
          <div class="notation-source" id="notationSource_${this.id}">
            <pre class="notation-source-pre">
              <code class="${codeClass}">${sourceLines.map(x => `<span>${x}</span>`).join("\n")}</code>
            </pre>
          </div>
        </figure>`;
    }

    // Add output section
    const outputLabelClass = config.cssClasses?.outputLabel || "";
    const outputClass = config.cssClasses?.outputContainer || "";

    html += `
      <div class="notation-output">
        <span class="notation-output-label ${outputLabelClass}"><strong>Output:</strong></span>
        <div id="notationViewer_${this.id}" class="notation-view ${outputClass}">
        </div>
      </div>`;

    newRoot.innerHTML = html;
    parent.insertBefore(newRoot, container);
    parent.removeChild(container);

    const notationViewerBlock = newRoot.querySelector(".notation-view") as HTMLDivElement;
    this.notationView = config.createViewer(notationViewerBlock);

    this.updatePreview();
    console.log("Done Rendering... Adjusting height");
  }

  updatePreview(): void {
    const fullContents = this.source;
    // Clear previous render to avoid appending multiple times
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
    return "notationCaption_" + this.id;
  }
}
