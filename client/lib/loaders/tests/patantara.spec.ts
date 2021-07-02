import * as TSU from "@panyam/tsutils";
import { isSwaramLine, parseNote } from "../patantara";
import { AtomBase, Space, Note, Group, Syllable } from "../../models/index";

const ONE = TSU.Num.Fraction.ONE;

describe("Patantara Tests", () => {
  test("isSwaramLine Tests", () => {
    let [values, allSwarams] = isSwaramLine("SNDP");
    expect(values).toEqual(["SNDP"]);
    expect(allSwarams).toEqual(true);

    [values, allSwarams] = isSwaramLine("S N D P");
    expect(values).toEqual(["S", "N", "D", "P"]);
    expect(allSwarams).toEqual(true);

    [values, allSwarams] = isSwaramLine("Sa N D P");
    expect(values).toEqual(["Sa", "N", "D", "P"]);
    expect(allSwarams).toEqual(false);

    [values, allSwarams] = isSwaramLine("S N+---+ ,, ___ D P");
    expect(values).toEqual(["S", "N+---+", ",,", "___", "D", "P"]);
    expect(allSwarams).toEqual(true);

    [values, allSwarams] = isSwaramLine("S N +---+ ,, ___ D P");
    expect(values).toEqual(["S", "N", "+---+", ",,", "___", "D", "P"]);
    expect(allSwarams).toEqual(false);

    [values, allSwarams] = isSwaramLine("SNDP");
  });

  test("Note Parsing Tests", () => {
    let atom: AtomBase = parseNote("SNDP");
    expect(atom.equals(new Group(ONE, new Note("S"), new Note("N"), new Note("D"), new Note("P")))).toBe(true);

    atom = parseNote("S_N,D,P");
    expect(
      atom.equals(
        new Group(
          ONE,
          new Note("S"),
          new Space(ONE, true),
          new Note("N"),
          new Space(ONE, false),
          new Note("D"),
          new Space(ONE, false),
          new Note("P"),
        ),
      ),
    ).toBe(true);

    atom = parseNote("S+");
    expect(atom.equals(new Note("S", ONE, 1))).toBe(true);

    atom = parseNote("S+-");
    expect(atom.equals(new Note("S", ONE, 0))).toBe(true);

    // atom = parseNote("S+N---D++--P+---+");
    atom = parseNote("S+N---D++--_,P+---+");
    // console.log( "Children:", atom.allChildren().map((x) => x.toString()));
    expect(
      atom.equals(
        new Group(
          ONE,
          new Note("S", ONE, 1),
          new Note("N", ONE, -3),
          new Note("D"),
          new Space(ONE, true),
          new Space(ONE, false),
          new Note("P", ONE, -1),
        ),
      ),
    ).toBe(true);
  });
});

/*
describe("Patantara Parser Tests", () => {
  test("Parser processPropertyLines", () => {
    let parser = new PatantaraParser();
    parser.processLine("a = b", 0);

    parser = new PatantaraParser();
    parser.processLine("tala pattern = ||,, ,,|,,|,,||", 0);
    expect(parser.currCycle!.duration).toEqual(TSU.Num.Frac(8));

    parser = new PatantaraParser();
    parser.processLine("aksharas = 200", 0);
    expect(parser.aksharasForLastLine).toBe(200);

    parser = new PatantaraParser();
    parser.processLine("     aksharas    per   line = 200", 0);
    expect(parser.aksharasPerLine).toBe(200);
  });

  test("Parser processTextLines", () => {
    const parser = new PatantaraParser();
    parser.processLine("   >   blah blah");
  });

  test("Parser processLine without cycle", () => {
    const parser = new PatantaraParser();
    expect(() => {
      parser.processLine(" S N D P M G R S");
    }).toThrowError();
  });

  test("Parser processLine 1 line", () => {
    const parser = new PatantaraParser({ debugLines: false });
    parser.parseSnippet(`
    tala pattern = |,,,,|,,|,,|
    S R G M P D N S+
    S+ N D P M G R S


    `);

    expect(parser.snippet.entities.length).toBe(1);
    const line = parser.snippet.entities[0] as Line;
    expect(line.roles.length).toBe(2);
    const atoms0 = line.roles[0].atoms;
    const atoms1 = line.roles[1].atoms;
    expect(atoms0.length).toBe(8);
    expect(atoms1.length).toBe(8);
  });
});

describe("Patantara Parser - Dhruva Thalam", () => {
  test("Dhruva Thalam", () => {
    const input = `
        tala pattern = ||,,,,|,,|,,,,|,,,,||
        aksharas per line = 7

        S r G m G r S r G r S r G m

        r G m P m G r G m G r G m P

        G m P d P m G m P m G m P d

        m P d N d P m P d P m P d N

        P d N S+ N d P d N d P d N S+

        S+ N d P d N S+ N d N S+ N d P

        N d P m P d N d P d N d P m

        d P m G m P d P m P d P m G

        P m G r G m P m G m P m G r

        m G r S r G m G r G m G r S
        `;
    const parser = new PatantaraParser({ debugLines: false });
    const snippet = parser.parseSnippet(input);
  });

  test("Eka Thalam", () => {
    const parser = new PatantaraParser({ debugLines: false });
    parser.processLine("tala pattern = ||,,,,||");
    parser.processLine("aksharas per line = 4");
    parser.processLine("");
    parser.processLine("S r G m");
    parser.processLine("");
    parser.processLine("r G m P");
    parser.processLine("");
    parser.processLine("G m P d");
    parser.processLine("");
    parser.processLine("m P d N");
    parser.processLine("");
    parser.processLine("P d N S+");
    parser.processLine("");
    parser.processLine("S+ N d P");
    parser.processLine("");
    parser.processLine("N d P m");
    parser.processLine("");
    parser.processLine("d P m G");
    parser.processLine("");
    parser.processLine("P m G r");
    parser.processLine("");
    parser.processLine("m G r S");
    parser.processLine("");
    // const snippet = parser.parseSnippet(input);
  });

  test("Arohana Avarohana", () => {
    const parser = new PatantaraParser({ debugLines: true });
    const input = `
    tala pattern = ,

    > Ārōhaṇam
    S R m P D S+ _ _

    > Avarōhaṇam
    S+ N D P m G R S
    `;
    const snippet = parser.parseSnippet(input);
    expect(snippet.entities.length).toBe(1);
  });
});
*/
