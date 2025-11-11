import * as N from "notations";
const MarkdownIt = require("markdown-it");

export function createViewer(rootElement: HTMLElement): N.Carnatic.NotationView {
  const notationView = new N.Carnatic.NotationView(rootElement);
  notationView.markdownParser = (contents: string) => {
    const md = new MarkdownIt({
      html: true,
    });
    const tokens = md.parse(contents.trim(), {});
    return md.renderer.render(tokens, { langPrefix: "v4_" });
  };
  return notationView;
}

export function initViewerDiv(elemSelector: string, codeSelector: string): N.Carnatic.NotationView | null {
  const elem = document.querySelector(elemSelector) as HTMLDivElement;
  const codeElem = document.querySelector(codeSelector) || null;
  if (codeElem != null && codeElem.textContent != null && codeElem.textContent.trim() != "") {
    // const contents = JSON.parse(codeElem.textContent);
    let contents = codeElem.textContent;
    try {
      contents = JSON.parse(codeElem.textContent).main || "";
    } catch (e) {
      console.log("Content is plain string: ", e);
    }
    const [notation, beatLayout, errors] = N.load(contents, { log: true });
    if (errors.length > 0) {
      console.log("Errors: ", errors);
    } else {
      const notationView = createViewer(elem);
      console.log("Rendering notation...");
      notationView.renderNotation(notation, beatLayout);
      return notationView;
    }
  }
  return null;
}

