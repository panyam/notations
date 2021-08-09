import { V4Parser } from "./";
import * as G from "galore";
import { Line } from "../models";
import { BeatLayout, Beat, BeatsBuilder } from "../models/layouts";
import { NotationView } from "./views";
import { Notation } from "./models";

function loadV4Notation(codeText: string): [Notation, Map<number, Beat[][]>, Map<number, BeatLayout>, G.ParseError[]] {
  const notation = new Notation();
  const beatsByLineRole = new Map<number, Beat[][]>();
  const beatLayouts = new Map<number, BeatLayout>();
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
      // LP should exist by now
      const layoutParams = notation.layoutParamsForLine(line)!;
      let beatLayout = beatLayouts.get(layoutParams.uuid) || null;
      if (beatLayout == null) {
        beatLayout = new BeatLayout(layoutParams);
        beatLayouts.set(layoutParams.uuid, beatLayout);
      }
      const roleBeats = [] as Beat[][];
      beatsByLineRole.set(line.uuid, roleBeats);

      for (const role of line.roles) {
        const bb = new BeatsBuilder(role, layoutParams);
        bb.addAtoms(...role.atoms);
        roleBeats.push(bb.beats);

        // Add these to the beat layout too
        for (const beat of bb.beats) {
          beatLayout.addBeat(beat);
        }
      }
    }
  }
  const buildTime = performance.now();
  console.log(`V4 Document, Parse Time: ${parseTime - startTime}ms, Build Time: ${buildTime - parseTime}ms`);
  return [notation, beatsByLineRole, beatLayouts, errors];
}

export function renderV4Notation(
  notationView: NotationView,
  codeText: string,
  rootElement: HTMLElement,
): G.ParseError[] {
  const [notation, beatsByLineRole, beatLayouts, errors] = loadV4Notation(codeText);
  rootElement.innerHTML = "";
  notationView.entity = notation;
  notationView.beatsByLineRole = beatsByLineRole;
  notationView.beatLayouts = beatLayouts;
  const startTime = performance.now();
  notationView.refreshLayout();
  const layoutTime = performance.now();
  console.log(`V4 Document, Layout Time: ${layoutTime - startTime}ms`);
  return errors;
}
