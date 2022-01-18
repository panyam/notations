import { App } from "./app";
import { patchChromeAnchorBug } from "../fecommon/utils";

const __webpack_nonce__ = "c29tZSBjb29sIHN0cmluZyB3aWxsIHBvcCB1cCAxMjM=";

document.addEventListener("DOMContentLoaded", () => {
  patchChromeAnchorBug();
  // const body = document.querySelector("body") as HTMLElement;
  const app = new App();
  (window as any).app = app;
});
