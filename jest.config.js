// const { pathsToModuleNameMapper } = require("ts-jest/utils");
// const { compilerOptions } = require("./tsconfig");

module.exports = {
  globals: {
    "ts-jest": {
      tsConfig: "./tsconfig.json",
    },
  },
  preset: "ts-jest",
  testEnvironment: "node",
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/.*",
    "<rootDir>/dist/.*",
    "<rootDir>/tests/samples.ts",
    "<rootDir>/tests/mocks.ts",
  ],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  // moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths /*, { prefix: '<rootDir>/' } */),
  transform: {
    "^.+\\.jsx?$": "babel-jest", // Adding this line solved the issue
    "^.+\\.(ts|tsx)?$": "ts-jest",
  },
  moduleDirectories: ["node_modules", "src"],
};
