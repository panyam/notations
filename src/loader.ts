import * as TSU from "@panyam/tsutils";
import * as G from "galore";
import { GlobalBeatLayout } from "./beats";
import { Parser } from "./parser";
import { Notation } from "./notation";

/**
 * Parses a notation string into a Notation object.
 *
 * @param input The notation string to parse
 * @returns A tuple containing the parsed Notation and any parsing errors
 */
export function parse(input: string): [Notation, G.ParseError[]] {
  return new Parser().parseAndBuild(input);
}

/**
 * Loads a notation from a string and builds the beat layout.
 *
 * @param codeText The notation string to load
 * @param config Optional configuration object
 * @returns A tuple containing the Notation, GlobalBeatLayout, parsing errors, and timing information
 */
export function load(
  codeText: string,
  config: any = {},
): [Notation, GlobalBeatLayout, G.ParseError[], TSU.StringMap<number>] {
  codeText = codeText || "";
  const beatLayout = new GlobalBeatLayout();
  const startTime = performance.now();
  const [notation, errors] = parse(codeText);
  const parseTime = performance.now();

  // Process all blocks recursively using block.children()
  // This handles nested blocks like \repeat { }, \section { }, etc.
  beatLayout.processBlock(notation);

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
