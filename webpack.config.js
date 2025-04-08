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
    resolve: {
        extensions: [ '.ts', '.js' ],
        fallback: {
            // "stream": require.resolve("stream-browserify"),
            "buffer": require.resolve("buffer")
        }
    },
    plugins: [
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
      }),
    ],
    module: {
      rules: [{ test: /\.t|js$/, use: "babel-loader" }],
    },
  };
};
