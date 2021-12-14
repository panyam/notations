const fs = require("fs");
const path = require("path");
const webpack = require("webpack");
const CopyPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const HtmlWebpackTagsPlugin = require("html-webpack-tags-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
// const uglifyJsPlugin = require("uglifyjs-webpack-plugin");

function setupHandlebarsEngine(engine, info) {
  // Reset partials otherwise same engine is passed to each template and we are stuck
  // with partial values bleeding across templates
  engine.partials = {};
  engine.loadPartial = function (name) {
    let partial = engine.partials[name];
    if (typeof partial === "string") {
      partial = engine.compile(partial);
      engine.partials[name] = partial;
    }
    return partial;
  };
  engine.registerHelper("block", function (name, options) {
    /* Look for partial by name. */
    const partial = engine.loadPartial(name) || options.fn;
    return partial(this, { data: options.hash });
  });
  engine.registerHelper("partial", function (name, options) {
    engine.registerPartial(name, options.fn);
  });
  engine.registerPartial("require", function (filename) {
    const contents = fs.readFileSync(filename).toString();
    const template = engine.compile(contents);
    const result = template({});
    return result;
  });
  engine.registerPartial("include", function (filename) {
    const contents = fs.readFileSync(filename).toString();
    const template = engine.compile(contents);
    const result = template({});
    return result;
  });
  engine.registerPartial("basepage", fs.readFileSync("./fecommon/partials/basePage.hbs").toString());
  engine.registerPartial("commonHeaders", fs.readFileSync("./fecommon/partials/commonHeaders.hbs").toString());
  engine.registerPartial("commonFooters", fs.readFileSync("./fecommon/partials/commonFooters.hbs").toString());
}

// Read Samples first
function readdir(path) {
  const items = fs.readdirSync(path);
  return items.map(function (item) {
    let file = path;
    if (item.startsWith("/") || file.endsWith("/")) {
      file += item;
    } else {
      file += "/" + item;
    }
    const stats = fs.statSync(file);
    return { file: file, name: item, stats: stats };
  });
}

const pages = ["playground"];

module.exports = (_env, options) => {
  context: __dirname; // path.resolve(__dirname);
  const isDevelopment = options.mode == "development";
  const webpackConfigs = {
    devtool: "inline-source-map",
    devServer: {
      hot: true,
      serveIndex: true,
      contentBase: path.join(__dirname, "../dist/demos/"),
      before: function (app, server) {
        app.get(/\/dir\/.*/, function (req, res) {
          const path = "./" + req.path.substr(5);
          console.log("Listing dir: ", path);
          const listing = readdir(path);
          res.json({ entries: listing });
        });
      },
    },
    optimization: {
      splitChunks: {
        chunks: "all",
      },
    },
    output: {
      path: path.resolve(__dirname, "../dist/demos/"),
      publicPath: "/demos/",
      filename: "[name]-[hash:8].js",
      library: ["galorium", "[name]"],
      libraryTarget: "umd",
      umdNamedDefine: true,
      globalObject: "this",
    },
    module: {
      rules: [
        {
          // The rule for rendering page-hbs.html from a handlebars template.
          test: /\.hbs$/,
          use: [
            /*
            {
              loader: "file-loader?name=[path][name]-[ext].html",
            },
            {
              loader: "extract-loader",
            },
            */
            {
              loader: "render-template-loader",
              options: {
                engine: "handlebars",
                locals: {
                  title: "Rendered with Handlebars!",
                  desc: "Partials Support",
                },
                init: setupHandlebarsEngine,
              },
            },
          ],
        },
        {
          test: /\.js$/,
          exclude: ["node_modules/", "dist"].map((x) => path.resolve(__dirname, x)),
          use: ["babel-loader"],
        },
        {
          test: /\.ts$/,
          exclude: [path.resolve(__dirname, "node_modules"), path.resolve(__dirname, "dist")],
          include: ["./"].map((x) => { console.log("TSL Path: ", x); return path.resolve(__dirname, x) }),
          use: [
            {
              loader: "ts-loader",
              options: { configFile: "tsconfig.json" },
            },
          ],
        },
        {
          test: /\.s(a|c)ss$/,
          use: [
            "style-loader",
            "css-loader",
            {
              loader: "sass-loader",
              options: {
                sourceMap: isDevelopment,
              },
            },
          ],
        },
        {
          test: /\.(png|svg|jpg|jpeg|gif)$/i,
          // use: [ "url-loader" ],
          type: "asset/resource",
        },
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/i,
          type: "asset/resource",
        },
      ],
    },
    entry: {
      playground: "./playground/index.ts",
    },
    plugins: [
      new CleanWebpackPlugin(),
      /*
      new HtmlWebpackPlugin({
        title: "Demo List Page",
        myPageHeader: "Demo List",
        chunks: ["client"],
        inject: false,
        filename: path.resolve(__dirname, "dist/static/dist/clients/index.html"),
        template: path.resolve(__dirname, "src/clients/index.html"),
      }),
      */
      ...pages.map(
        (page) =>
          new HtmlWebpackPlugin({
            chunks: [page],
            // inject: false,
            filename: path.resolve(__dirname, `../dist/demos/${page}/index.html`),
            template: path.resolve(__dirname, `${page}/index.hbs`),
            minify: { collapseWhitespace: false },
          }),
      ),
      new webpack.HotModuleReplacementPlugin(),
    ],
    resolve: {
      extensions: [".js", ".jsx", ".ts", ".tsx", ".scss", ".css", ".png"],
      fallback: {
        "crypto-browserify": require.resolve("crypto-browserify"), //if you want to use this module also don't forget npm i crypto-browserify
        "querystring-es3": false,
        assert: false,
        buffer: false,
        child_process: false,
        crypto: false,
        fs: false,
        http: false,
        https: false,
        net: false,
        os: false,
        path: false,
        querystring: false,
        stream: false,
        tls: false,
        url: false,
        util: false,
        zlib: false,
      },
    },
  };
  if (false && !isDevelopment) {
    webpackConfigs.plugins.splice(0, 0, new uglifyJsPlugin());
  }
  return webpackConfigs;
};
