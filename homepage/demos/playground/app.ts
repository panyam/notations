import * as TSU from "@panyam/tsutils";
import "./styles/composer.scss";
import * as GL from "golden-layout";
import { InputView } from "./InputView";
import { ConsoleView } from "./ConsoleView";
import { ParseTableView } from "./ParseTableView";
import * as configs from "./configs";

const LAYOUT_STATE_KEY = "galorium:savedState";

/**
 * The app that drives the viewer and the editor.
 */
export class App {
  inputView: InputView;
  consoleView: ConsoleView;
  parseTableView: ParseTableView;
  eventHub: TSU.Events.EventHub;

  constructor() {
    this.eventHub = new TSU.Events.EventHub();
    const desktopDiv = document.querySelector("#desktopArea") as HTMLDivElement;
    const grammarAreaDiv = document.querySelector("#grammarArea") as HTMLElement;
    const normalizedGrammarAreaDiv = document.querySelector("#normalizedGrammarArea") as HTMLElement;
    const inputAreaDiv = document.querySelector("#inputArea") as HTMLElement;
    const ptreeAreaDiv = document.querySelector("#ptreeArea") as HTMLElement;
    const ptableAreaDiv = document.querySelector("#ptableArea") as HTMLElement;
    const consoleAreaDiv = document.querySelector("#consoleArea") as HTMLElement;

    this.inputView = new InputView(inputAreaDiv, this);
    this.consoleView = new ConsoleView(consoleAreaDiv, this);
    this.parseTableView = new ParseTableView(ptableAreaDiv, this);

    const savedState = localStorage.getItem(LAYOUT_STATE_KEY);
    let inputContents = "";
    const myLayout = new GL.GoldenLayout(
      configs.defaultGLConfig,
      // savedState == null ? configs.defaultGLConfig : JSON.parse(savedState),
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
    myLayout.registerComponent("ptableArea", (container, componentState) => {
      const elem = container.getElement();
      elem.appendChild(ptableAreaDiv);
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
