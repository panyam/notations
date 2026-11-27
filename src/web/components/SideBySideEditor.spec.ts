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
