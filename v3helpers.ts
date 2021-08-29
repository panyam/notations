import * as TSU from "@panyam/tsutils";
import * as G from "galore";
import { V3Parser } from "../v3/";
import { Notebook, Snippet } from "../v3/models";
import { SnippetView } from "./v3";
const MarkdownIt = require("markdown-it");

/**
 * Render MD to a DOM Element.
 */
export function mdToDOM(content: string, target: HTMLElement): void {
  const md = new MarkdownIt({
    html: true,
  });
  const tokens = md.parse(content, {});
  let snippetId = 0;
  for (const token of tokens) {
    token.attrs = token.attrs || [];
    if (token.type == "fence") {
      const info = token.info.trim().toLowerCase().split(" ");
      if (info.length > 0 && (info[0] == "v3" || info[0] == "v3h")) {
        token.attrs.push(["snippet", true]);
        token.attrs.push(["snippetIndex", snippetId++]);
        token.attrs.push(["snippetSyntax", info[0]]);
        token.attrs.push(["snippetHidden", info[0] === "v3h"]);
        token.attrs.push(["snippetStartLine", token.map[0]]);
        token.attrs.push(["snippetEndLine", token.map[1]]);
      }
    }
  }
  // Render it so we have a DOM to load from
  const html = md.renderer.render(tokens, { langPrefix: "Snippet_" });
  target.innerHTML = html;
}

/**
 * Parse all pre nodes to build up our sequenced Snippets into the notebook.
 */
export function processCodeNodeSnippets(
  rootElement: HTMLElement,
  notebook?: Notebook,
): [number, [HTMLElement, G.ParseError][]] {
  const errors: [HTMLElement, G.ParseError][] = [];
  const t1 = performance.now();
  const nodes = rootElement.querySelectorAll("pre code[Snippet=true]");
  notebook = notebook || new Notebook();
  notebook.clear();
  let i = 0;
  for (; i < nodes.length; i++) {
    const codeNode = nodes.item(i) as HTMLElement;
    try {
      loadSnippetFromCodeNode(rootElement, notebook, codeNode);
    } catch (error) {
      errors.push([codeNode, error as G.ParseError]);
      console.log("Error Parsing Snippet: \n", codeNode.innerHTML);
      throw error;
      break;
    }
  }
  const t2 = performance.now();
  console.log(`Parsed ${nodes.length} snippets in ${t2 - t1}ms`);
  return [i, errors];
}

export function loadSnippetFromCodeNode(
  rootElement: HTMLElement,
  notebook: Notebook,
  codeNode: HTMLElement,
): TSU.Nullable<Snippet> {
  // const codeNode = preNode.querySelector("code[class=Snippet_v3]") || null;
  let snippet: TSU.Nullable<Snippet> = null;
  const preNode = codeNode.parentElement as HTMLPreElement;
  const hidden = codeNode.getAttribute("snippetHidden") === "true";
  if (codeNode != null) {
    const codeText = codeNode.innerHTML;

    // parse this in different ways to see which one clicks
    try {
      snippet = notebook.newSnippet();
      ensureSnippetView(rootElement, snippet, preNode, hidden);
      const parser = new V3Parser(snippet);
      parser.parse(codeText);
    } catch (error) {
      // Invalid snippet - skip
      notebook.removeSnippet(snippet!);
      throw error;
    }

    // Layout all line views once and for all
    const view = snippet.locals.get("view") as SnippetView;
    view.lineViews.forEach((lv) => {
      lv.layoutChildViews();
    });

    if (snippet != null) {
      (snippet as any).preNode = preNode;
      TSU.DOM.setAttr(preNode, "snippet", true);
      TSU.DOM.setAttr(preNode, "snippetUUID", snippet.uuid);
      preNode.style.display = "none";
    }
  }
  return snippet;
}

export function ensureSnippetView(
  rootElement: HTMLElement,
  snippet: Snippet,
  prevNode: HTMLElement,
  hidden = false,
): HTMLDivElement {
  const snippetParentDivId = "SnippetParentDiv_" + snippet.uuid;
  let snippetDiv = rootElement.querySelector("#" + snippetParentDivId) as HTMLDivElement;
  if (!snippetDiv) {
    snippetDiv = TSU.DOM.createNode("div", {
      // doc: this.doc,
      id: snippetParentDivId,
    }) as HTMLDivElement;
    snippetDiv.classList.add("SnippetParentDiv");
    prevNode.parentElement?.insertBefore(snippetDiv, prevNode);
    // insertAfter(prevNode, snippetDiv);
  }
  snippetDiv.style.display = hidden ? "none" : "block";
  const view = new SnippetView(snippetDiv, snippet);
  snippet.locals.setone("view", view);
  return snippetDiv;
}
