import * as TSU from "@panyam/tsutils";
import { GlobalBeatLayout } from "../beats";
import { parse } from "../loader";
import { Cycle, Bar } from "../cycle";
import { Line, Group, Note } from "../core";
import { LayoutParams } from "../layouts";
import { BeatsBuilder, Beat } from "../beats";
import { ensureUniformSpaces } from "../beatutils";

const ONE = TSU.Num.Fraction.ONE;
const TWO = ONE.timesNum(2);
const THREE = ONE.timesNum(3);
const FIVE = ONE.timesNum(5);
const TEN = ONE.timesNum(10);
const HALF = ONE.divbyNum(2);

function parseToBeats(input: string): GlobalBeatLayout {
  const [notation, errors] = parse(input);
  if (errors.length > 0) {
    console.log("Errors: ", errors);
    TSU.assert(false, "Parse error");
  }
  const beatLayout = new GlobalBeatLayout();
  for (const block of notation.blocks) {
    if (block.type == "Line" && !(block as Line).isEmpty) {
      const line = block as Line;
      // LP should exist by now
      // Probably because this is an empty line and AddAtoms was not called
      TSU.assert(line.layoutParams != null, "Layout params for a non empty line *SHOULD* exist");
      beatLayout.addLine(line);
    }
  }
  return beatLayout;
}

describe("GlobalBeatLayout", () => {
  test("Create beats from BeatsBuilder", () => {
    const beatLayout = parseToBeats(`
      \\cycle("1")
      \\breaks(1,1)
      Sw:
      a b c d e f g h i
    `);
    expect(beatLayout.roleBeatsForLine.size).toBe(1)
    expect(beatLayout.gridModelsForLine.size).toBe(1)
    expect(beatLayout.beatColDAGsByLP.size).toBe(1)
    const gm = beatLayout.gridLayoutGroup.gridModels[0];
    expect(gm.rows.length).toBe(9)
    const a0 = (gm.getRow(0).cellAt(1)?.value as Beat).atom as Note
    expect(a0.value).toBe("a")
    const a1 = (gm.getRow(1).cellAt(1)?.value as Beat).atom as Note
    expect(a1.value).toBe("b")
    const a2 = (gm.getRow(2).cellAt(1)?.value as Beat).atom as Note
    expect(a2.value).toBe("c")
    const a3 = (gm.getRow(3).cellAt(1)?.value as Beat).atom as Note
    expect(a3.value).toBe("d")
    const a4 = (gm.getRow(4).cellAt(1)?.value as Beat).atom as Note
    expect(a4.value).toBe("e")
    const a5 = (gm.getRow(5).cellAt(1)?.value as Beat).atom as Note
    expect(a5.value).toBe("f")
    const a6 = (gm.getRow(6).cellAt(1)?.value as Beat).atom as Note
    expect(a6.value).toBe("g")
    const a7 = (gm.getRow(7).cellAt(1)?.value as Beat).atom as Note
    expect(a7.value).toBe("h")
    const a8 = (gm.getRow(8).cellAt(1)?.value as Beat).atom as Note
    expect(a8.value).toBe("i")
  });
});
