import "./styles/InputView.scss";

import * as TSU from "@panyam/tsutils";
import { App } from "./app";
import * as ace from "ace-builds";
import * as events from "./events";
import * as G from "galore";
import * as configs from "./configs";

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

  parse(): void {
    /** parse model */
    /*
    const input = this.codeEditor.getValue();
    const startTime = performance.now();
    const ptree = this.parser.parse(input);
    const endTime = performance.now();
    this.app.eventHub.emit(events.Log, this, "Input Parsed in " + (endTime - startTime) + "ms");
    this.app.eventHub.emit(events.InputParsed, this, ptree);
    */
  }
}
