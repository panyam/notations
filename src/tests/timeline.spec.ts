import { load } from "../loader";
import { buildTimeline, Timeline, TimelineEvent } from "../timeline";

const ADI = '\\cycle("|4|2|2|")\n';

const timelineOf = (src: string): Timeline => {
  const [notation, , errors] = load(src);
  expect(errors).toEqual([]);
  return buildTimeline(notation);
};

/** kind, value, offset and duration in beats, for compact assertions. */
const brief = (e: TimelineEvent) => [e.kind, e.value, e.offset.toString(), e.duration.toString()];
const tala = (e: TimelineEvent) => [e.tala.cycle, e.tala.bar, e.tala.beat, e.tala.beatInCycle];

describe("timeline (#101)", () => {
  test("one note per beat gives each note one beat, from samam", () => {
    const t = timelineOf(ADI + "Sw: S R G M");
    expect(t.events.map(brief)).toEqual([
      ["note", "S", "0/1", "1/1"],
      ["note", "R", "1/1", "1/1"],
      ["note", "G", "2/1", "1/1"],
      ["note", "M", "3/1", "1/1"],
    ]);
    expect(t.events.map(tala)).toEqual([
      [0, 0, 0, 0],
      [0, 0, 1, 1],
      [0, 0, 2, 2],
      [0, 0, 3, 3],
    ]);
  });

  test("\\beatDuration and groups give exact fractions of a beat", () => {
    const t = timelineOf(ADI + "\\beatDuration(4)\nSw: S R [G M P] D");
    expect(t.events.map(brief)).toEqual([
      ["note", "S", "0/1", "1/4"],
      ["note", "R", "1/4", "1/4"],
      ["note", "G", "1/2", "1/8"],
      ["note", "M", "5/8", "1/8"],
      ["note", "P", "3/4", "1/8"],
      ["note", "D", "7/8", "1/8"],
    ]);
    expect(t.events[4].tala.offsetInBeat.toString()).toBe("3/4");
  });

  test("commas hold the note, and a - inside the hold doesn't break it", () => {
    const t = timelineOf(ADI + "Sw: S , - , , R");
    expect(t.events.map(brief)).toEqual([
      ["note", "S", "0/1", "4/1"],
      ["note", "R", "4/1", "1/1"],
    ]);
    expect(t.events[0].breakAfter).toBe(false);
  });

  test("a - at the end of a hold marks a break, and silent spaces become one rest", () => {
    const t = timelineOf(ADI + "Sw: S , - R _ _ G");
    expect(t.events.map(brief)).toEqual([
      ["note", "S", "0/1", "2/1"],
      ["note", "R", "2/1", "1/1"],
      ["rest", "", "3/1", "2/1"],
      ["note", "G", "5/1", "1/1"],
    ]);
    expect(t.events.map((e) => e.breakAfter)).toEqual([true, false, false, false]);
  });

  test("roles in one line run in parallel, swaras as notes and sahitya as syllables", () => {
    const t = timelineOf(ADI + 'Sw: S R\nSh: "sa" ri');
    expect(t.events.map((e) => [e.role.name, ...brief(e)])).toEqual([
      ["sw", "note", "S", "0/1", "1/1"],
      ["sh", "syllable", "sa", "0/1", "1/1"],
      ["sw", "note", "R", "1/1", "1/1"],
      ["sh", "syllable", "ri", "1/1", "1/1"],
    ]);
  });

  test("octave dots and gamakas come through as data", () => {
    const t = timelineOf('\\cycle("|4|")\nSw: .S S. ~/ g');
    expect(t.events.map((e) => [e.value, e.octave, e.gamakas.length])).toEqual([
      ["S", -1, 0],
      ["S", 1, 0],
      ["g", 0, 1],
    ]);
  });

  describe("each line starts on a samam, after whole cycles", () => {
    test("a short line is padded to its cycle, so the next line starts on samam", () => {
      const t = timelineOf(ADI + "\\line\nSw: S R G M P D\n\\line\nSw: N S. R. S. N D P M");
      expect(t.lines.map((l) => [l.offset.toString(), l.cycles])).toEqual([
        ["0/1", 1],
        ["8/1", 1],
      ]);
      const n = t.events[6];
      expect([n.value, n.offset.toString(), n.lineOffset.toString()]).toEqual(["N", "8/1", "0/1"]);
      expect(tala(n)).toEqual([1, 0, 0, 0]);
      expect(t.duration.toString()).toBe("16/1");
    });

    test("a line longer than a cycle takes two, and the next line starts at beat 16", () => {
      const t = timelineOf(ADI + "\\line\nSw: S R G M P D N S. R. S. N D\n\\line\nSw: S");
      expect(t.lines.map((l) => [l.offset.toString(), l.cycles])).toEqual([
        ["0/1", 2],
        ["16/1", 1],
      ]);
    });

    test("a positive offset starts the line's first note after samam", () => {
      const t = timelineOf(ADI + '\\line\nSw: S\n\\line("", offset=3)\nSw: S R');
      const s = t.events[1];
      expect([s.offset.toString(), s.lineOffset.toString()]).toEqual(["11/1", "3/1"]);
      expect(tala(s)).toEqual([1, 0, 3, 3]);
    });

    test("a pickup fills the blank end of the previous line", () => {
      const t = timelineOf(ADI + '\\line\nSw: S R G M P D\n\\line("", offset=-2)\nSw: N S. R. S.');
      expect(t.events.slice(6).map((e) => [e.offset.toString(), e.lineOffset.toString(), ...tala(e)])).toEqual([
        ["6/1", "-2/1", 0, 2, 0, 6],
        ["7/1", "-1/1", 0, 2, 1, 7],
        ["8/1", "0/1", 1, 0, 0, 0],
        ["9/1", "1/1", 1, 0, 1, 1],
      ]);
      expect(t.warnings).toEqual([]);
    });

    test("a pickup over notes still sounding keeps both and warns", () => {
      const t = timelineOf(ADI + '\\line\nSw: S R G M P D N S.\n\\line("", offset=-2)\nSw: N S. R. S.');
      expect(t.events.filter((e) => e.offset.equalsNum(6)).map((e) => e.lineOffset.toString())).toEqual([
        "6/1",
        "-2/1",
      ]);
      expect(t.warnings).toEqual([
        "Line 2 starts at beat 6 of the piece, but the line before it is still sounding until beat 8.",
      ]);
    });

    test("a \\repeat plays its lines once per pass", () => {
      const t = timelineOf(ADI + "\\repeat(2) { Sw: S R }");
      expect(t.events.map((e) => [e.value, e.offset.toString()])).toEqual([
        ["S", "0/1"],
        ["R", "1/1"],
        ["S", "8/1"],
        ["R", "9/1"],
      ]);
      expect(t.events[0].atom).toBe(t.events[2].atom);
    });

    test("a tala change starts a new line with its own cycle length", () => {
      const t = timelineOf(ADI + 'Sw: S R G M P D N S. R. S. N D\n\\cycle("|2|4|")\nSw: S R G');
      expect(t.lines.map((l) => [l.offset.toString(), l.cycles, l.cycleDuration.toString()])).toEqual([
        ["0/1", 2, "8/1"],
        ["16/1", 1, "6/1"],
      ]);
      expect(t.events.slice(-3).map(tala)).toEqual([
        [2, 0, 0, 0],
        [2, 0, 1, 1],
        [2, 1, 0, 2],
      ]);
      expect(t.duration.toString()).toBe("22/1");
    });

    test("a commas-only start of a line holds the note that ended the line before", () => {
      const t = timelineOf(ADI + "\\line\nSw: S R G M P D N S.\n\\line\nSw: , , R");
      expect(t.events.slice(-2).map(brief)).toEqual([
        ["note", "S", "7/1", "3/1"],
        ["note", "R", "10/1", "1/1"],
      ]);
    });
  });
});
