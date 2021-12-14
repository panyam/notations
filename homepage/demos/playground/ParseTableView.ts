import "./styles/ParseTableView.scss";

import * as TSU from "@panyam/tsutils";
import { App } from "./app";
import * as events from "./events";
import * as G from "galore";

export class ParseTableView {
  headerElement: HTMLDivElement;

  constructor(public readonly rootElement: HTMLElement, public readonly app: App, public readonly config?: any) {
    this.loadChildViews();
  }

  protected loadChildViews(): void {
    this.headerElement = this.rootElement.querySelector(".inputHeaderArea") as HTMLDivElement;
  }

  gotoSymbolSorter = (s1: G.Sym, s2: G.Sym) => {
    const diff = (s1.isTerminal ? 0 : 1) - (s2.isTerminal ? 0 : 1);
    if (diff != 0) return diff;
    return s1.creationId - s2.creationId;
  };
}
