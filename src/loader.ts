import * as TSU from "@panyam/tsutils";
import * as G from "galore";
import { Line } from "./core";
import { BeatLayout, Beat, BeatsBuilder } from "./beats";
import { Parser } from "./parser";
import { Notation } from "./notation";

export function load(
  codeText: string,
  config: any = {},
): [Notation, Map<number, Beat[][]>, Map<number, BeatLayout>, G.ParseError[], TSU.StringMap<number>] {
  const beatsByLineRole = new Map<number, Beat[][]>();
  const beatLayouts = new Map<number, BeatLayout>();
  const errors: G.ParseError[] = [];
  const startTime = performance.now();
  const notation = new Notation();
  const parser = new Parser();
  parser.parse(codeText);
  errors.push(...parser.errors);
  const parseTime = performance.now();
  for (const cmd of parser.commands) cmd.applyToNotation(notation);

  // Create Line Beats
  for (const block of notation.blocks) {
    if (block.type == "Line") {
      const line = block as Line;
      // LP should exist by now
      const layoutParams = notation.layoutParamsForLine(line) || null;
      if (!line.isEmpty) {
        // Probably because this is an empty line and AddAtoms was not called
        TSU.assert(layoutParams != null, "Layout params for a non empty line *should* exist");
        let beatLayout = beatLayouts.get(layoutParams.uuid) || null;
        if (beatLayout == null) {
          beatLayout = new BeatLayout(layoutParams);
          beatLayouts.set(layoutParams.uuid, beatLayout);
        }
        const roleBeats = [] as Beat[][];
        beatsByLineRole.set(line.uuid, roleBeats);

        const lineOffset = line.offset.divbyNum(layoutParams.beatDuration);
        for (const role of line.roles) {
          const bb = new BeatsBuilder(role, layoutParams, lineOffset);
          bb.addAtoms(...role.atoms);
          roleBeats.push(bb.beats);

          // Add these to the beat layout too
          for (const beat of bb.beats) {
            // beat.ensureUniformSpaces(layoutParams.beatDuration);
            beatLayout.addBeat(beat);
          }
        }
      }
    }
  }
  const buildTime = performance.now();
  if (config.log) {
    console.log(`V4 Document, Parse Time: ${parseTime - startTime}ms, Build Time: ${buildTime - parseTime}ms`);
  }
  return [
    notation,
    beatsByLineRole,
    beatLayouts,
    errors,
    {
      parseTime: parseTime - startTime,
      buildTime: buildTime - parseTime,
    },
  ];
}
