import * as TSU from "@panyam/tsutils";
import "./styles/composer.scss";
import * as GL from "golden-layout";
import { InputView } from "./InputView";
import { ConsoleView } from "./ConsoleView";
import { NotationView } from "./NotationView";
import * as configs from "./configs";

const LAYOUT_STATE_KEY = "notation-playground:savedState:1";

/**
 * The app that drives the viewer and the editor.
 */
export class App {
  inputView: InputView;
  consoleView: ConsoleView;
  notationView: NotationView;
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
    this.notationView = new NotationView(outputAreaDiv, this);

    const savedState = localStorage.getItem(LAYOUT_STATE_KEY);
    let inputContents = "";
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
      console.log("Saving State: ", state);
    });
    myLayout.init();

    this.inputView.setContents(inputContents);
  }
}
