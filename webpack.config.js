const path = require("path");
const webpack = require("webpack");
const BundleAnalyzerPlugin = require("webpack-bundle-analyzer").BundleAnalyzerPlugin;

module.exports = (env, argv) => {
  const isProd = argv.mode === "production";
  const analyze = env && env.analyze;

  const plugins = [
    new webpack.ProvidePlugin({
      Buffer: ["buffer", "Buffer"],
    }),
  ];

  if (analyze) {
    plugins.push(new BundleAnalyzerPlugin());
  }

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
    plugins,
    module: {
      rules: [{ test: /\.t|js$/, use: "babel-loader" }],
    },
  };
};
