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
  ["font-src", ["'self'", "https://fonts.gstatic.com/"]],
  [
    "script-src",
    ["'self'", "https://unpkg.com/ace-builds@1.4.12/src-noconflict/", "http://code.jquery.com/jquery-1.11.1.min.js"],
  ],
  [
    "script-src-elem",
    ["'self'", "https://unpkg.com/ace-builds@1.4.12/src-noconflict/", "http://code.jquery.com/jquery-1.11.1.min.js"],
  ],
  [
    "style-src",
    [
      "'self'",
      "'unsafe-inline'",
      "https://fonts.googleapis.com/icon",
      "https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/css/materialize.min.css",
      "https://golden-layout.com/files/latest/css/goldenlayout-base.css",
      "https://golden-layout.com/files/latest/css/goldenlayout-dark-theme.css",
    ],
  ],
  ["frame-src", ["'self'"]],
]
  .map((entry) => [entry[0] + " " + (entry[1] as string[]).map((v) => `${v}`).join(" ")])
  .join(" ; ");

app.use(function (req, res, next) {
  res.setHeader("Content-Security-Policy", copsHeader);
  next();
});

// app.use("/blog", express.static(path.join(__dirname, "sites/blog")));
// app.use("/docs", express.static(path.join(__dirname, "sites/docs")));
app.use("/demos", express.static(path.join(__dirname, "demos")));
app.use("/", express.static(path.join(__dirname, "site")));

/// Enable static sites for dev (and hence CORS)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

// Setup view/templating engine
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

// Session Setup - Needed for most things session
// eg auth
const useMemSessions = false;
if (useMemSessions) {
  app.use(
    session({
      // It holds the secret key for session
      name: "usid",
      secret: "secret1234",
      cookie: {
        maxAge: 600000,
        sameSite: true,
      },
      resave: false,
      saveUninitialized: false,
    }),
  );
}

// And setup routes and error handlers

const indexRouter = require("./src/server/routes");

const ENV = app.get("env");

app.use("/", indexRouter);

// Iniitalise auth flows
// TODO - finalise a naming convention for these
// TSG.Auth.initAuth2App(app);

// catch 404 and forward to error handler
/*
app.use((req: any, res: any, next: any) => {
  next(createError(404));
});

// error handler
app.use((err: any, req: any, res: any, next: any) => {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = ENV === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error/index.html");
});
*/

module.exports = app;
