import * as TSU from "@panyam/tsutils";
import * as G from "galore";
import { Line } from "./core";
import { GlobalBeatLayout } from "./beats";
import { Parser } from "./parser";
import { Notation } from "./notation";

export function parse(input: string): [Notation, G.ParseError[]] {
  const notation = new Notation();
  const parser = new Parser();
  const errors: G.ParseError[] = [];
  parser.parse(input);
  errors.push(...parser.errors);
  for (const cmd of parser.commands) cmd.applyToNotation(notation);
  return [notation, errors];
}

export function load(
  codeText: string,
  config: any = {},
): [Notation, GlobalBeatLayout, G.ParseError[], TSU.StringMap<number>] {
  const beatLayout = new GlobalBeatLayout();
  const startTime = performance.now();
  const [notation, errors] = parse(codeText);
  const parseTime = performance.now();

  // Create Line Beats
  for (const block of notation.blocks) {
    if (block.type == "Line" && !(block as Line).isEmpty) {
      const line = block as Line;
      // LP should exist by now
      // Probably because this is an empty line and AddAtoms was not called
      TSU.assert(line.layoutParams != null, "Layout params for a non empty line *SHOULD* exist");
      beatLayout.addLine(line);
    }
  }
  const buildTime = performance.now();
  if (config.log) {
    console.log(`V4 Document, Parse Time: ${parseTime - startTime}ms, Build Time: ${buildTime - parseTime}ms`);
  }
  return [
    notation,
    beatLayout,
    errors,
    {
      parseTime: parseTime - startTime,
      buildTime: buildTime - parseTime,
    },
  ];
}
