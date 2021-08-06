import * as TSU from "@panyam/tsutils";
import { V4Parser } from "./";
import * as G from "galore";
import { NotationView } from "./views";
import { Notation, Command } from "./models";

export function renderV4Notation(
  notationView: NotationView,
  codeText: string,
  rootElement: HTMLElement,
): [number, [HTMLElement, G.ParseError][]] {
  rootElement.innerHTML = "";
  const errors: [HTMLElement, G.ParseError][] = [];
  const startTime = performance.now();
  const parser = new V4Parser();
  parser.parse(codeText);
  const parseTime = performance.now();
  notationView.renderCommands(parser.commands);
  const renderTime = performance.now();
  notationView.lineViews.forEach((lv) => {
    lv.layoutChildViews();
  });
  const layoutTime = performance.now();
  console.log(
    `V4 Document, Parse Time: ${parseTime - startTime}ms, Rendering Time: ${renderTime - parseTime}ms, Layout Time: ${
      layoutTime - renderTime
    }ms`,
  );
  return [0, errors];
}
