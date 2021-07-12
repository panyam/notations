import { Command, V3Parser } from "../v3";
import { TokenType } from "../tokens";
import { Notebook } from "../../models/notebook";
import "../../../common/jest/matchers";

describe("Parser Tests", () => {
  test("Test Command Parsing", () => {
    const notebook = new Notebook();
    const snippet = notebook.newSnippet();
    const input = `\\line( "world" , "a", "b", x = 1, c = 'hello', ab = "cd")`;
    const parser = new V3Parser(snippet);
    const root = parser.parse(input);
    console.log("Result Parse Tree: \n", JSON.stringify(root?.debugValue(), null, 2));
    console.log("Result Snippet: \n", JSON.stringify(parser.snippet.debugValue(), null, 2));
    expect(parser.snippet.debugValue()).toEqual({
      instrs: [
        {
          name: "CreateLine",
          index: 0,
          params: [
            {
              key: null,
              value: "world",
            },
            {
              key: null,
              value: "a",
            },
            {
              key: null,
              value: "b",
            },
            {
              key: "x",
              value: {
                num: 1,
                den: 1,
              },
            },
            {
              key: "c",
              value: "hello",
            },
            {
              key: "ab",
              value: "cd",
            },
          ],
        },
      ],
    });
  });

  /*
  test("Parse Multi line command", () => {
    const notebook = new Notebook();
    const snippet = notebook.newSnippet();
    const parser = new V3Parser(snippet);
    expect(notebook.snippets.length).toBe(1);
    expect(notebook.cursors.length).toBe(1);
    expect(() => parser.parse(`a = 2`)).toThrowError();
    notebook.removeSnippet(snippet);
    expect(notebook.snippets.length).toBe(0);
    expect(notebook.cursors.length).toBe(0);
  });

  test("Test Parser", () => {
    const notebook = new Notebook();
    const snippet = notebook.newSnippet();
    const parser = new V3Parser(snippet);
    parser.parse("\\line(world)");
    parser.parse("\\role(sw, notes = true, x = 3, d = 4 / 5)");
    parser.parse("Sw: S R G M");
    expect(snippet.instructions.length).toBe(7);
  });

  test("Test Duplicate Roles", () => {
    const notebook = new Notebook();
    const snippet = notebook.newSnippet();
    const parser = new V3Parser(snippet);
    parser.parse("\\line(world)");
    parser.parse("\\role(sw)");
    expect(() => parser.parse("\\role(sw, notes = true)")).not.toThrowError();
  });

  test("Test Atoms", () => {
    const notebook = new Notebook();
    const snippet = notebook.newSnippet();
    const parser = new V3Parser(snippet);
    parser.parse("\\line(world)");
    parser.parse("\\role(sw, notes = true)");
    parser.parse("\\role(sh)");
    parser.parse("Sw: S R [ G. .M ]");
    parser.parse("Sh: S R G 2/3 M");
  });
  */
});
