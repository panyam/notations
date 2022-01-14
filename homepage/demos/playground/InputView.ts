import "./styles/InputView.scss";

import * as TLEX from "tlex";
import * as G from "galore";
import * as TSU from "@panyam/tsutils";
import * as N from "notations";
import { App } from "./app";
import * as events from "./events";
import * as configs from "./configs";
import * as ace from "ace-builds";
import { StatusBar } from "ace-builds/src-noconflict/ext-statusbar";

function evalLineOffsets(contents: string): number[] {
  const lines = contents.split("\n");
  const out = [] as number[];
  lines.forEach((line, index) => {
    if (index == 0) {
      out.push(line.length + 1);
    } else {
      out.push(out[index - 1] + line.length + 1);
    }
  });
  return out;
}

function offsetToLine(lineOffsets: number[], offset: number): number {
  // TODO - Bisect
  let i = 0;
  for (; i < lineOffsets.length; i++) {
    if (offset < lineOffsets[i]) return i + 1;
  }
  return i + 1;
}

export class InputView {
  codeEditor: ace.Ace.Editor;
  headerElement: HTMLDivElement;
  editorElement: HTMLDivElement;
  parseButton: HTMLButtonElement;

  constructor(public readonly rootElement: HTMLElement, public readonly app: App, public config?: any) {
    this.loadChildViews();
  }

  protected loadChildViews(): void {
    ace.config.set("basePath", "https://unpkg.com/ace-builds@1.4.12/src-noconflict");
    this.headerElement = this.rootElement.querySelector(".inputHeaderArea") as HTMLDivElement;
    this.editorElement = this.rootElement.querySelector(".inputEditorArea") as HTMLDivElement;
    this.codeEditor = ace.edit(this.editorElement);
    this.codeEditor.setTheme("ace/theme/monokai");
    this.codeEditor.session.setMode("ace/mode/markdown");

    this.parseButton = this.rootElement.querySelector(".parseButton") as HTMLButtonElement;
    this.parseButton.addEventListener("click", (evt) => {
      this.parse();
    });

    this.codeEditor.on("change", (data: any) => {
      // Called on change - invoke incremental parsing here
    });

    // add command to lazy-load keybinding_menu extension
    this.codeEditor.commands.addCommand({
      name: "saveDocument",
      bindKey: { win: "Ctrl-s", mac: "Command-s" },
      exec: (editor: ace.Ace.Editor) => {
        alert("TODO - Saving Input");
      },
    });
    this.codeEditor.commands.addCommand({
      name: "compileGrammar",
      bindKey: { win: "Ctrl-enter", mac: "Command-enter" },
      exec: (editor: ace.Ace.Editor) => {
        this.parse();
      },
    });
  }

  setContents(val: any): void {
    this.codeEditor.setValue(val);
    this.codeEditor.clearSelection();
  }

  private markers: number[] = [];
  private lineOffsets: number[] = [];
  private annotations: any[] = [];
  parse(): void {
    /** parse model */
    const input = this.codeEditor.getValue();
    const startTime = performance.now();
    const [notation, beatsByLineRole, beatLayouts, errors, timings] = N.load(input, {});
    const endTime = performance.now();
    this.app.eventHub.emit(events.Log, this, `Input Parsed in ${(timings.parseTime * 100) / 100} ms`);
    this.app.eventHub.emit(events.Log, this, `Input Built in ${(timings.buildTime * 100) / 100} ms`);

    this.codeEditor.session.clearAnnotations();
    for (const markerId of this.markers) {
      this.codeEditor.session.removeMarker(markerId);
    }
    this.markers = [];
    this.lineOffsets = [];
    if (errors.length > 0) {
      // evaluate line numbers
      this.lineOffsets = evalLineOffsets(input);
      errors.forEach((err) => this.logError(err));
      this.codeEditor.session.setAnnotations(this.annotations);
    } else {
      this.app.eventHub.emit(events.InputParsed, this, [
        notation, beatsByLineRole, beatLayouts
      ]);
    }
  }

  logError(err: Error): void {
    if (err.name == "TokenizerError") {
      const error = err as TLEX.TokenizerError;
      const line = offsetToLine(this.lineOffsets, error.offset);
      const col = error.offset - this.lineOffsets[line - 1];
      this.app.eventHub.emit(events.Log, this, `Error in line (${line}): ${error.message}`);
      this.annotations.push({
        row: line - 1,
        column: col,
        text: error.message,
        type: "error",
      });
    } else if (err.name == "ParseError") {
      const error = err as G.ParseError;
      const b = 0;
    } else {
      console.log(err);
    }
  }
}
