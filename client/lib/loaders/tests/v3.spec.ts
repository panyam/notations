import { Command, V3Parser } from "../v3";
import { TokenType } from "../tokens";
import { Notebook } from "../../notebook";
import "../../../jest/matchers";

describe("Parser Tests", () => {
  /*
  test("Test Command Parsing", () => {
    const notebook = new Notebook();
    const snippet = notebook.newSnippet();
    const input = "\\line ( world , a, b, x = 1, c = 'hello', ab = cd)";
    const tokenizer = V3Tokenizer(input);
    const parser = new SnippetParser(snippet).setTokenizer(tokenizer);
    const root = parser.parse();
    console.log("Result Parse Tree: \n", root?.debugValue);
  });

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
