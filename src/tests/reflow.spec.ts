import { Cycle, Bar } from "../cycle";
import { breaksToFit } from "../layouts";
import { load, layoutParamsIn } from "../loader";

const ADI = Cycle.DEFAULT;
const MISRA_CHAAPU = new Cycle({
  name: "Misra Chaapu",
  bars: [new Bar({ beatLengths: [1, 1, 1] }), new Bar({ beatLengths: [1, 1] }), new Bar({ beatLengths: [1, 1] })],
});
const even = (n: number, w = 50) => Array.from({ length: n }, () => w);

describe("breaksToFit", () => {
  test("keeps the whole cycle on one row when it fits", () => {
    expect(breaksToFit(ADI, even(8), 400)).toEqual([8]);
  });

  test("splits Adi after the laghu before anywhere else", () => {
    expect(breaksToFit(ADI, even(8), 399)).toEqual([4, 4]);
  });

  test("splits Misra Chaapu at its bar line into 3 and 4", () => {
    expect(breaksToFit(MISRA_CHAAPU, even(7), 300)).toEqual([3, 4]);
  });

  test("uses every bar line before splitting inside a bar", () => {
    const widths = [40, 40, 40, 40, 60, 60, 60, 60];
    expect(breaksToFit(ADI, widths, 170)).toEqual([4, 2, 2]);
  });

  test("splits inside a bar only when one bar is wider than the row", () => {
    expect(breaksToFit(ADI, even(8), 199)).toEqual([2, 2, 2, 2]);
  });

  test("weighs beats by their measured widths", () => {
    // At 399 the laghu alone is too wide. It splits in two, and the dhrutams share the last row.
    const widths = [100, 100, 100, 100, 10, 10, 10, 10];
    expect(breaksToFit(ADI, widths, 400)).toEqual([4, 4]);
    expect(breaksToFit(ADI, widths, 399)).toEqual([2, 2, 4]);
  });

  test("keeps the author's breaks while every row fits", () => {
    expect(breaksToFit(MISRA_CHAAPU, even(7), 700, [14])).toEqual([14]);
    expect(breaksToFit(ADI, even(8), 400, [5, 3])).toEqual([5, 3]);
  });

  test("replaces the author's breaks when a row is too wide", () => {
    expect(breaksToFit(MISRA_CHAAPU, even(7), 699, [14])).toEqual([7]);
    expect(breaksToFit(MISRA_CHAAPU, even(7), 300, [14])).toEqual([3, 4]);
  });

  test("falls back to one beat per row when even one beat is too wide", () => {
    expect(breaksToFit(MISRA_CHAAPU, even(7), 10)).toEqual([1, 1, 1, 1, 1, 1, 1]);
  });
});

describe("load with breaks", () => {
  const SRC = `\\cycle("|3|2|2|")
\\breaks(14)
\\line
Sw: s r g m p d n S n d p m g r

\\cycle("|4|2|2|")
\\breaks(8)
\\line
Sw: s r g m p d n S`;

  test("layoutParamsIn lists each layout once, in the order lines use them", () => {
    const [notation] = load(SRC);
    const layouts = layoutParamsIn(notation);
    expect(layouts.map((lp) => lp.cycle.beatCount)).toEqual([7, 8]);
    expect(layouts.map((lp) => lp.lineBreaks)).toEqual([[14], [8]]);
  });

  test("replaces each layout's breaks by position, and a null entry keeps the author's", () => {
    const [notation, beatLayout] = load(SRC, { breaks: [[3, 4], null] });
    expect(layoutParamsIn(notation).map((lp) => lp.lineBreaks)).toEqual([[3, 4], [8]]);
    // Two cycles of Misra Chaapu in rows of 3 and 4 beats make four rows of one role.
    const misraLine = [...beatLayout.gridModelsForLine.values()][0];
    expect(misraLine.rows.length).toEqual(4);
  });
});
