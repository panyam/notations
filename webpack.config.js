const path = require("path");

module.exports = (env, argv) => {
  return {
    devtool: "inline-source-map",
    entry: {
      index: path.resolve(__dirname, "./lib/esm/index.js"),
    },
    output: {
      path: path.resolve(__dirname, "./lib/umd"), // builds to ./dist/umd/
      filename: "[name].js", // index.js
      library: {
        name: "notations", // aka window.myLibrary
        type: "umd",
      },
      // libraryTarget: "umd", // supports commonjs, amd and web browsers
      globalObject: "this",
    },
    module: {
      rules: [{ test: /\.t|js$/, use: "babel-loader" }],
    },
  };
};
