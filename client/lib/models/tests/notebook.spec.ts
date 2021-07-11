import * as TSU from "@panyam/tsutils";
import { Line } from "../../models";
import { CURSOR_START, Notebook } from "../notebook";
import "../../../common/jest/matchers";

const ONE = TSU.Num.Fraction.ONE;
/*
const ZERO = TSU.Num.Fraction.ZERO;
const TWO = ONE.timesNum(2);
const THREE = ONE.timesNum(3);
const FIVE = ONE.timesNum(5);
const TEN = ONE.timesNum(10);
*/

describe("Cursor Tests", () => {
  test("Creation", () => {
    const n1 = new Notebook();
    const cursor = n1.newCursor();
    expect(cursor.indexes).toEqual([CURSOR_START]);
    expect(n1.indexOfCursor(cursor)).toEqual(0);
    n1.removeCursor(cursor);
    expect(n1.cursors.length).toEqual(0);
  });
});

describe("Notebook Tests", () => {
  test("Creation", () => {
    const n1 = new Notebook();
    expect(n1.type).toBe("Notebook");
    expect(n1.children()).toBe(n1.lines);
    expect(n1.cursors.length).toBe(0);
  });

  test("Insert Line", () => {
    const n1 = new Notebook();
    expect(n1.type).toBe("Notebook");
    expect(n1.children()).toBe(n1.lines);
    expect(n1.cursors.length).toBe(0);

    const c1 = n1.newCursor();
    expect(c1.indexes).toEqual([CURSOR_START]);
  });

  test("Cursors at Entity", () => {
    const n1 = new Notebook();
    const c1 = n1.newCursor();
    const s1 = new Line();
    const s2 = new Line();
    const s3 = new Line();
    n1.insertLine(c1, s1);
    n1.insertLine(c1, s2);
    n1.insertLine(c1, s3);
    expect(n1.children().length).toBe(3);
    expect(n1.childAt(0)).toBe(s1);
    expect(n1.childAt(1)).toBe(s2);
    expect(n1.childAt(2)).toBe(s3);
  });
});

describe("Snippet Tests", () => {
  test("Create Snippet", () => {
    const n1 = new Notebook();
    const s1 = n1.newSnippet();
    const s2 = n1.newSnippet();
    s1.newRole("sw", true);
    s2.newRole("sh");
    expect(s1.currRole.name).toBe("sw");
    expect(s1.currRole.notesOnly).toBe(true);
    expect(s2.currRole.name).toBe("sh");
    expect(s2.currRole.notesOnly).toBe(false);
  });

  test("Snippets should recursively get properties and roles", () => {
    const n1 = new Notebook();
    const s1 = n1.newSnippet();
    const s2 = n1.newSnippet();
    const r1 = s1.newRole("sw", true);
    const r2 = s2.newRole("sh");
    expect(s2.getRole("sh")).toEqual([r2, s2]);
    expect(s2.getRole("sw")).toEqual([r1, s1]);
  });
});
