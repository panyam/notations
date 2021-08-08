import * as TSU from "@panyam/tsutils";
import { V4Parser } from "./";
import * as G from "galore";
import { Line } from "../models";
import { NotationView } from "./views";
import { Notation, Command, LineBeats } from "./models";

function loadV4Notation(codeText: string): [Notation, Map<number, LineBeats>, G.ParseError[]] {
  const notation = new Notation();
  const lineBeats = new Map<number, LineBeats>();
  const errors: G.ParseError[] = [];
  const startTime = performance.now();
  const parser = new V4Parser();
  parser.parse(codeText);
  const parseTime = performance.now();
  for (const cmd of parser.commands) cmd.applyToNotation(notation);

  // Create Line Beats
  for (const block of notation.blocks) {
    if (block.type == "Line") {
      const line = block as Line;
      lineBeats.set(line.uuid, new LineBeats(line));
    }
  }
  const buildTime = performance.now();
  console.log(`V4 Document, Parse Time: ${parseTime - startTime}ms, Build Time: ${buildTime - parseTime}ms`);
  return [notation, lineBeats, errors];
}

export function renderV4Notation(
  notationView: NotationView,
  codeText: string,
  rootElement: HTMLElement,
): G.ParseError[] {
  const [notation, lineBeats, errors] = loadV4Notation(codeText);
  rootElement.innerHTML = "";
  notationView.entity = notation;
  notationView.lineBeats = lineBeats;
  const startTime = performance.now();
  notationView.refreshLayout();
  // notationView.lineViews.forEach((lv) => { lv.layoutChildViews(); });
  const layoutTime = performance.now();
  console.log(`V4 Document, Layout Time: ${layoutTime - startTime}ms`);
  return errors;
}
