const path = require("path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");

module.exports = (_env, options) => {
  const isDevelopment = options.mode == "development";
  return {
    devtool: "source-map",
    entry: {
      DocsPage: path.join(__dirname, "./components/DocsPage.ts"),
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: [path.resolve(__dirname, "node_modules"), path.resolve(__dirname, "dist")],
          use: ["babel-loader"],
        },
        {
          test: /\.ts$/,
          exclude: [path.resolve(__dirname, "node_modules"), path.resolve(__dirname, "dist")],
          include: [
            path.resolve(__dirname, "components")
          ],
          use: [
            {
              loader: "ts-loader",
              options: { configFile: "tsconfig.json" },
            },
          ],
        },
      ],
    },
    resolve: {
      extensions: [".js", ".jsx", ".ts", ".tsx", ".scss", ".css"],
      fallback: {
        assert: false,
        child_process: false,
        crypto: false,
        fs: false,
        http: false,
        https: false,
        net: false,
        os: false,
        path: false,
        querystring: false,
        stream: require.resolve("stream-browserify"),
        buffer: require.resolve("buffer"),
        tls: false,
        url: false,
        util: false,
        zlib: false,
      },
    },
    output: {
      path: path.resolve(__dirname, "./static/js/gen/"),
      publicPath: "/docs/static/js/gen/",
      filename: "[name].[contenthash].js",
      library: ["notations", "[name]"],
      libraryTarget: "umd",
      umdNamedDefine: true,
      globalObject: "this",
    },
    plugins: [
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
      }),
      new CleanWebpackPlugin(),
      new HtmlWebpackPlugin({
        chunks: ["DocsPage"],
        filename: path.resolve(__dirname, "./templates/gen.DocsPage.html"),
        templateContent: "",
        minify: { collapseWhitespace: false },
      }),
    ],
    optimization: {
      splitChunks: {
        chunks: "all",
      },
    },
  };
};
