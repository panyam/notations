import * as fs from "fs";
import * as path from "path";

// Step 6 of #48's exercise: an FAQ, and somewhere to ask a question.
const DOCS = path.resolve(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(DOCS, p), "utf8");

describe("FAQ and a place to ask (#83, #84)", () => {
  test("there is an FAQ page, linked from the sidebar", () => {
    expect(fs.existsSync(path.join(DOCS, "content/faq/index.html"))).toBe(true);
    expect(read("templates/Sidebar.html")).toContain('href="{{.Site.PathPrefix}}/faq/"');
  });

  test("Contributing links GitHub Issues and Discussions, not just names them", () => {
    const page = read("content/contributing/index.html");
    expect(page).toContain('href="https://github.com/panyam/notations/issues"');
    expect(page).toContain('href="https://github.com/panyam/notations/discussions"');
  });

  test("the FAQ points to Discussions for anything it doesn't answer", () => {
    expect(read("content/faq/index.html")).toContain('href="https://github.com/panyam/notations/discussions"');
  });
});
