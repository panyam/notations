export function patchChromeAnchorBug(): void {
  const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
  if (window.location.hash && isChrome) {
    setTimeout(function () {
      const hash = window.location.hash;
      window.location.hash = "";
      window.location.hash = hash;
    }, 300);
  }
}

const M = module as any;
declare const Handlebars: any;

export function initHandlebars() {
  if (Handlebars) {
    Handlebars.registerHelper("eachInMap", function (map: any, node: any) {
      let out = "";
      if (map) {
        Object.keys(map).map(function (prop) {
          out += node.fn({ key: prop, value: map[prop] });
        });
      }
      return out;
    });
    Handlebars.registerHelper("eitherVal", function (value: any, defaultValue: any) {
      const out = value || defaultValue;
      return new Handlebars.SafeString(out);
    });
  }
}

export function commonInit() {
  initHandlebars();

  document.addEventListener("DOMContentLoaded", () => {
    // DO things here
  });

  if (M.hot) {
    M.hot.accept();
  }
}

export function stripPrefixSpaces(input: string): string {
  const lines: [string, number, number][] = input
    .split("\n")
    .map((line) => [line.trim(), line.length, line.trimStart().length]);
  // .filter(([line, lineLen, trimmedLen], i) => trimmedLen > 0);
  const prefLens = lines.map(([_, lineLen, trimmedLen]) => (trimmedLen == 0 ? 1024 : lineLen - trimmedLen));
  const minPrefix = Math.min(...prefLens);
  const output = lines.map(([line, lineLen, _], i) => (lineLen == 0 ? "" : " ".repeat(prefLens[i] - minPrefix) + line));
  return output.join("\n");
}
