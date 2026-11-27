import * as TSU from "@panyam/tsutils";
import { parseBar, parseCycle } from "../utils";
import { parse } from "../loader";
import { serializeBlockItem } from "../web/utils/sourceSerializer";

const F = TSU.Num.Frac;
const lengths = (s: string) => parseBar(s).beatLengths;
const beatsPerBar = (s: string) => parseCycle(s).bars.map((b) => b.beatLengths.length);

describe("Cycle strings", () => {
  test("a bar without spaces reads whole numbers as beat counts", () => {
    expect(lengths("10")).toHaveLength(10);
    expect(lengths("15")).toHaveLength(15);
    expect(beatsPerBar("10|4")).toEqual([10, 4]);
    expect(parseCycle("10|4").duration).toEqual(F(14));
  });

  test("commas still add one beat each, after a count or alone", () => {
    expect(lengths("4,,")).toHaveLength(6);
    expect(lengths(",,,")).toHaveLength(3);
  });

  test("a single length:count token is a beat spec, as it is in a spaced bar", () => {
    const bar = parseBar("4:2");
    expect(bar.beatLengths).toEqual([F(4)]);
    expect(bar.beatCounts).toEqual([2]);
    expect(lengths("3/2")).toEqual([F(3, 2)]);
  });

  test("anything else in a bar is an error", () => {
    expect(() => parseBar("4x")).toThrow(/4x/);
  });

  test("spaces inside a bar give beat lengths, and | separates bars", () => {
    expect(lengths("6 4 4")).toEqual([F(6), F(4), F(4)]);
    expect(beatsPerBar("6 4 4")).toEqual([3]);
    expect(beatsPerBar("|6|4|4|")).toEqual([6, 4, 4]);
  });

  test.each(["|4|2|2|", "|10|4|", "|6 4 4|", "|1:2 2:3|", "|3/2|", "|4:2|2|"])("Cycle.toString round-trips %s", (s) => {
    const cycle = parseCycle(s);
    expect(parseCycle(cycle.toString()).equals(cycle)).toBe(true);
  });

  test("the source serializer writes a \\cycle block's cycle back out", () => {
    const [notation, errors] = parse('\\cycle("|4|2|2|") {\n s r g m p d n s.\n}');
    expect(errors).toEqual([]);
    const block = notation.blockItems.find((b: any) => b.blockType == "cycle")!;
    expect(serializeBlockItem(block, 0, { indent: "  " })).toContain('\\cycle("|4|2|2|")');
  });
});
