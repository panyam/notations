/**
 * @jest-environment jsdom
 */
import SideBySideEditor from "./SideBySideEditor";

// The notation renderer measures SVG text, and jsdom has no layout.
(SVGElement.prototype as any).getBBox = () => ({ x: 0, y: 0, width: 10, height: 10 });

describe("SideBySideEditor", () => {
  test("renders a clean source and reports no errors", () => {
    const onParseError = jest.fn();
    const editor = new SideBySideEditor({ initialSource: "Sw: S R G M", onParseError });
    expect(onParseError).not.toHaveBeenCalled();
    expect(editor.getNotation()).not.toBeNull();
    expect(editor.outputElement.querySelector("svg")).not.toBeNull();
  });

  // load() drops a bad command and keeps the rest (#69), so the rest still renders (#94).
  test("renders the valid lines when one command is unknown", () => {
    const onParseError = jest.fn();
    const onNotationParsed = jest.fn();
    const editor = new SideBySideEditor({ onParseError, onNotationParsed });
    editor.editorElement.value = "Sw: S R G M\n\\noTala";

    expect(editor.render()).toBe(false);
    expect(onParseError).toHaveBeenCalledTimes(1);
    expect(onParseError.mock.calls[0][0][0].message).toMatch(/notala/i);
    expect(onNotationParsed).toHaveBeenCalledTimes(1);
    expect(editor.getNotation()).not.toBeNull();
    expect(editor.outputElement.querySelector("svg")).not.toBeNull();
  });
});

describe("cursor sync (panyam/notation#294)", () => {
  const SRC = "Sw: S R G M";
  const R = SRC.indexOf("R");
  const marked = (editor: SideBySideEditor) =>
    [...editor.outputElement.querySelectorAll(".mark-cursor")].map((el) => el.getAttribute("sourceatomid"));
  const atomOf = (editor: SideBySideEditor, value: string) =>
    [...editor.outputElement.querySelectorAll("g.atomViewRootGroup")].find((g) => g.textContent?.trim() == value)!;
  const caretAt = (editor: SideBySideEditor, offset: number) => {
    editor.editorElement.setSelectionRange(offset, offset);
    editor.editorElement.dispatchEvent(new Event("keyup"));
  };

  test("a caret on a note marks that note in the output", () => {
    const editor = new SideBySideEditor({ initialSource: SRC });
    caretAt(editor, R);
    expect(marked(editor)).toEqual([atomOf(editor, "R").getAttribute("sourceatomid")]);
  });

  test("a caret off any note clears the mark", () => {
    const editor = new SideBySideEditor({ initialSource: SRC });
    caretAt(editor, R);
    caretAt(editor, 1);
    expect(marked(editor)).toEqual([]);
  });

  test("clicking a rendered note selects its source text", () => {
    const editor = new SideBySideEditor({ initialSource: SRC });
    const g = atomOf(editor, "G");
    (g.querySelector("text") ?? g).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const { selectionStart, selectionEnd, value } = editor.editorElement;
    expect(value.substring(selectionStart, selectionEnd)).toBe("G");
    expect(marked(editor)).toEqual([g.getAttribute("sourceatomid")]);
  });

  test("clicking outside any note leaves the selection alone", () => {
    const editor = new SideBySideEditor({ initialSource: SRC });
    editor.editorElement.setSelectionRange(2, 2);
    editor.outputElement.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(editor.editorElement.selectionStart).toBe(2);
  });

  test("after an edit, nothing syncs until the source renders again", () => {
    const editor = new SideBySideEditor({ initialSource: SRC, debounceDelay: 0 });
    caretAt(editor, R);
    editor.editorElement.value = "Sw: P " + SRC.substring(4);
    caretAt(editor, R);
    expect(marked(editor)).toEqual([]);
    const g = atomOf(editor, "G");
    (g.querySelector("text") ?? g).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(editor.editorElement.selectionStart).toBe(R);
  });

  test("the cursor mark survives a render", () => {
    const editor = new SideBySideEditor({ initialSource: SRC });
    caretAt(editor, R);
    editor.render();
    expect(marked(editor)).toEqual([atomOf(editor, "R").getAttribute("sourceatomid")]);
  });

  test("cursorSync: false turns both directions off", () => {
    const editor = new SideBySideEditor({ initialSource: SRC, cursorSync: false });
    caretAt(editor, R);
    expect(marked(editor)).toEqual([]);
    const g = atomOf(editor, "G");
    (g.querySelector("text") ?? g).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(editor.editorElement.selectionStart).toBe(R);
  });
});
