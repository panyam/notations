import * as path from "path";

import { JSDOM } from "jsdom";
global.DOMParser = new JSDOM().window.DOMParser;

const ONE_SEC = 1000000000;

describe("Viewer Tests", () => {
  test("Basic Viewer", () => {
    // TODO
  });
});
