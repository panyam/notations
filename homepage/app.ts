// import createError from "http-errors";
import express = require("express");
import path = require("path");
import bodyParser = require("body-parser");
const session = require("express-session");
const exphbs = require("express-handlebars");

function setupInheritance(engine: any): void {
  engine.loadPartial = function (name: string) {
    let partial = engine.partials[name];
    if (typeof partial === "string") {
      partial = engine.compile(partial);
      engine.partials[name] = partial;
    }
    return partial;
  };
  engine.registerHelper("block", (name: string, options: any): string => {
    /* Look for partial by name. */
    const partial = engine.loadPartial(name) || options.fn;
    return partial(engine, { data: options.hash });
  });
  engine.registerHelper("partial", function (name: string, options: any): void {
    engine.registerPartial(name, options.fn);
  });
}

// Create a new express app instance
const app: express.Application = express();

const copsHeader = [
  ["font-src", ["'self'", "https://fonts.gstatic.com/", "*"]],
  [
    "script-src",
    [
      "http://localhost:3000",
      "'self'",
      "https://unpkg.com/ace-builds@1.4.12/src-noconflict/",
      "http://code.jquery.com/jquery-3.5.1.min.js",
    ],
  ],
  [
    "script-src-elem",
    [
      "http://localhost:3000",
      "'self'",
      "'sha256-Az0bWf8jQdMaG6dzok4j+bqRkUraBGtPudz6j4NAYVU='",
      "https://unpkg.com/ace-builds@1.4.12/src-noconflict/",
      "http://code.jquery.com/jquery-3.5.1.min.js",
    ],
  ],
  /*
  [
    "style-src-elem",
    [
      // For blog
      "'self'",
      "https://unpkg.com/modern-normalize@0.6.0/modern-normalize.css",
    ],
  ],
  */
  [
    "style-src",
    [
      "'self'",
      "'unsafe-inline'",
      "https://fonts.googleapis.com/icon",
      "https://fonts.googleapis.com/css",
      "https://fonts.googleapis.com/css2",
      "https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/css/materialize.min.css",
      "https://golden-layout.com/files/latest/css/goldenlayout-base.css",
      "https://golden-layout.com/files/latest/css/goldenlayout-dark-theme.css",
      "https://golden-layout.com/files/latest/css/goldenlayout-light-theme.css",
      // For blog
      "https://unpkg.com/modern-normalize@0.6.0/modern-normalize.css",
      // Site
      "https://cdn.jsdelivr.net/gh/rastikerdar/vazir-font@v27.0.1/dist/font-face.css",
    ],
  ],
  ["frame-src", ["'self'"]],
]
  .map((entry) => [entry[0] + " " + (entry[1] as string[]).map((v) => `${v}`).join(" ")])
  .join(" ; ");

/// Enable static sites for dev (and hence CORS)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

app.use(function (req, res, next) {
  // res.setHeader("Content-Security-Policy", copsHeader);
  res.setHeader("Content-Security-Policy-Report-Only", "default-src 'self'; report-uri /csp-violation-report/");
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// app.use(cookieParser());
app.use(bodyParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// app.use("/blog", express.static(path.join(__dirname, "sites/blog")));
// app.use("/docs", express.static(path.join(__dirname, "sites/docs")));
app.use("/demos", express.static(path.join(__dirname, "demos")));
app.use("/docs/", express.static(path.join(__dirname, "docs")));
app.use("/csp-violation-report/", function (req: any, res: any, next: any) {
  console.log("Here ok: ", req.body);
  res.sendStatus(200);
});
app.use("/", express.static(path.join(__dirname, "site")));

// Setup view/templating engine
/*
app.set("views", [path.join(__dirname, "static/dist")]);
app.set("view engine", "html");
const hbs = exphbs.create({
  defaultLayout: "main",
  extname: "html",
  allowProtoMethodsByDefault: true,
  allowProtoPropertiesByDefault: true,
  layoutsDir: __dirname + "/src/views/layouts",
});
setupInheritance(hbs.handlebars);
app.engine("html", hbs.engine);
*/

// And setup routes and error handlers
// const indexRouter = require("./src/server/routes");
// const ENV = app.get("env");

module.exports = app;
