import * as TSU from "@panyam/tsutils";
import "./styles/composer.scss";
import "notations/styles/NotationView.scss";
import * as GL from "golden-layout";
import { InputView } from "./InputView";
import { ConsoleView } from "./ConsoleView";
import * as N from "notations";
const MarkdownIt = require("markdown-it");
import * as configs from "./configs";
import * as events from "./events";

const LAYOUT_STATE_KEY = "notation-playground:savedState:1";
const INPUT_DOC_KEY = "notation-playground:savedContents:1";

/**
 * The app that drives the viewer and the editor.
 */
export class App {
  inputView: InputView;
  consoleView: ConsoleView;
  notationView: N.Carnatic.NotationView;
  eventHub: TSU.Events.EventHub;

  constructor() {
    this.eventHub = new TSU.Events.EventHub();
    const desktopDiv = document.querySelector("#desktopArea") as HTMLDivElement;
    const grammarAreaDiv = document.querySelector("#grammarArea") as HTMLElement;
    const normalizedGrammarAreaDiv = document.querySelector("#normalizedGrammarArea") as HTMLElement;
    const inputAreaDiv = document.querySelector("#inputArea") as HTMLElement;
    const outputAreaDiv = document.querySelector("#outputArea") as HTMLElement;
    const consoleAreaDiv = document.querySelector("#consoleArea") as HTMLElement;

    this.inputView = new InputView(inputAreaDiv, this);
    this.consoleView = new ConsoleView(consoleAreaDiv, this);
    this.notationView = new N.Carnatic.NotationView(outputAreaDiv);
    this.notationView.markdownParser = (contents: string) => {
      const md = new MarkdownIt({
        html: true,
      });
      const tokens = md.parse(contents.trim(), {});
      return md.renderer.render(tokens, { langPrefix: "v4_" });
    };

    const savedState = localStorage.getItem(LAYOUT_STATE_KEY);
    const myLayout = new GL.GoldenLayout(
      // configs.defaultGLConfig,
      savedState == null ? configs.defaultGLConfig : JSON.parse(savedState),
      desktopDiv,
    );
    const resizeObserver = new ResizeObserver(() => {
      (myLayout as any).updateSize();
    });
    resizeObserver.observe(desktopDiv);
    myLayout.registerComponent("inputArea", (container, componentState: any) => {
      const elem = container.getElement();
      elem.appendChild(inputAreaDiv);
    });
    myLayout.registerComponent("outputArea", (container, componentState) => {
      const elem = container.getElement();
      elem.appendChild(outputAreaDiv);
    });
    myLayout.registerComponent("consoleArea", (container, componentState) => {
      const elem = container.getElement();
      elem.appendChild(consoleAreaDiv);
    });
    myLayout.on("stateChanged", function () {
      var state = JSON.stringify(myLayout.toConfig());
      localStorage.setItem(LAYOUT_STATE_KEY, state);
      // console.log("Saving State: ", state);
    });
    myLayout.init();

    this.eventHub?.on(events.InputParsed, (evt) => {
      console.log("Ok here, evt: ", evt);
      const [notation, beatsByLineRole, beatLayouts] = evt.payload;
      this.notationView.clear();
      this.notationView.notation = notation;
      this.notationView.beatsByLineRole = beatsByLineRole;
      this.notationView.beatLayouts = beatLayouts;
      this.notationView.refreshLayout();
    });
    const inputContents = localStorage.getItem(INPUT_DOC_KEY) || "";
    this.inputView.setContents(inputContents);
    this.eventHub?.on(events.InputSaved, (evt) => {
      const INPUT_DOC_KEY = "notation-playground:savedContents:1";
      localStorage.setItem(INPUT_DOC_KEY, evt.payload);
    });
  }
}
