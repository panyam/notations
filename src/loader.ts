import * as TSU from "@panyam/tsutils";
import * as G from "galore";
import { GlobalBeatLayout } from "./beats";
import { Parser } from "./parser";
import { carnaticGamakas } from "./carnatic/gamakas";
import { Notation, Block, isBlock, isLine } from "./notation";
import { Line } from "./core";
import { LayoutParams } from "./layouts";

/**
 * Parses a notation string into a Notation object, reading `~` gamakas as Carnatic ones.
 *
 * This is where the parser and the Carnatic gamakas meet. Neither knows the other.
 *
 * @param input The notation string to parse
 * @returns A tuple containing the parsed Notation and any parsing errors
 */
export function parse(input: string): [Notation, G.ParseError[]] {
  return new Parser({ embellishments: carnaticGamakas }).parseAndBuild(input);
}

/**
 * Loads a notation from a string and builds the beat layout.
 *
 * `config.breaks` replaces the `\breaks` of each layout, given in the order `layoutParamsIn`
 * returns them. A missing or null entry keeps that layout's own. `NotationView.reflow` uses it to
 * lay a song out again for a narrower screen (#80).
 *
 * @param codeText The notation string to load
 * @param config Optional configuration: `log` prints timings, `breaks` as above
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
  const breaks: (number[] | null | undefined)[] = config.breaks ?? [];
  if (breaks.length > 0) {
    layoutParamsIn(notation).forEach((lp, i) => {
      if (breaks[i]) lp.lineBreaks = breaks[i]!;
    });
  }

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

/**
 * Every LayoutParams the notation's lines use, each once, in the order the lines first use them.
 * Parsing the same source twice gives the same order, so a position here names the same layout
 * in both.
 */
export function layoutParamsIn(notation: Notation): LayoutParams[] {
  const out: LayoutParams[] = [];
  const seen = new Set<LayoutParams>();
  const walk = (block: Block) => {
    for (const item of block.children()) {
      if (isLine(item)) {
        const lp = (item as Line).layoutParams;
        if (lp && !seen.has(lp)) {
          seen.add(lp);
          out.push(lp);
        }
      } else if (isBlock(item)) walk(item as Block);
    }
  };
  walk(notation);
  return out;
}
