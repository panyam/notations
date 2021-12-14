import "./styles/ConsoleView.scss";

import * as TSU from "@panyam/tsutils";
import { App } from "./app";
import * as events from "./events";

export class ConsoleView {
  headerElement: HTMLDivElement;
  consoleLogElement: HTMLDivElement;
  clearButton: HTMLButtonElement;

  constructor(public readonly rootElement: HTMLElement, public readonly app: App, public readonly config?: any) {
    app.eventHub?.on(events.Log, (evt) => {
      this.add(evt.payload);
    });
    this.loadChildViews();
  }

  protected loadChildViews(): void {
    this.headerElement = this.rootElement.querySelector(".consoleHeaderArea") as HTMLDivElement;
    this.consoleLogElement = this.rootElement.querySelector(".consoleLogArea") as HTMLDivElement;

    this.clearButton = this.rootElement.querySelector(".clearButton") as HTMLButtonElement;
    this.clearButton.addEventListener("click", (evt) => {
      this.clear();
    });
  }

  add(line: string): void {
    TSU.DOM.createNode("div", {
      parent: this.consoleLogElement,
      attrs: {
        class: "consoleLogItem",
      },
      text: line,
    });
    // scroll to bottom
    this.consoleLogElement.scrollTop = this.consoleLogElement.scrollHeight - this.consoleLogElement.clientHeight;
  }

  clear(): void {
    this.consoleLogElement.textContent = "\n";
  }
}
