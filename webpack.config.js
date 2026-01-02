const path = require("path");
const webpack = require("webpack");

module.exports = (env, argv) => {
  const isProd = argv.mode === "production";
  return {
    devtool: isProd ? "source-map" : "inline-source-map",
    entry: {
      notations: path.resolve(__dirname, "./lib/esm/index.js"),
    },
    output: {
      path: path.resolve(__dirname, "./dist"),
      filename: isProd ? "[name].umd.min.js" : "[name].umd.js",
      library: {
        name: "Notations",
        type: "umd",
        export: "default",
      },
      globalObject: "this",
    },
    resolve: {
      extensions: [".ts", ".js"],
      fallback: {
        buffer: require.resolve("buffer"),
      },
    },
    plugins: [
      new webpack.ProvidePlugin({
        Buffer: ["buffer", "Buffer"],
      }),
    ],
    module: {
      rules: [{ test: /\.t|js$/, use: "babel-loader" }],
    },
  };
};
