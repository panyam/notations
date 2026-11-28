// const { pathsToModuleNameMapper } = require("ts-jest/utils");
// const { compilerOptions } = require("./tsconfig");

module.exports = {
  testEnvironment: "node",
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/.*",
    "<rootDir>/dist/.*",
    "<rootDir>/.cache/.*",
    "<rootDir>/tests/samples.ts",
    "<rootDir>/tests/mocks.ts",
  ],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  moduleNameMapper: {
    "^yaml$": "<rootDir>/node_modules/yaml/dist/index.js",
  },
  transform: {
    "^.+\\.jsx?$": "babel-jest", // Adding this line solved the issue
    "^.+\\.(ts|tsx)?$": ["ts-jest", { tsconfig: "./tsconfig.test.json" }],
  },
  moduleDirectories: ["node_modules", "src"],
};
