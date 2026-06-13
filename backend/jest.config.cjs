/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  // Source uses nodenext-style ".js" import specifiers; strip them so ts-jest
  // resolves the ".ts" sources when compiling tests to CommonJS.
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  setupFiles: ["<rootDir>/test/setup.ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        // Compile to CommonJS for the test run (avoids experimental ESM VM).
        useESM: false,
        tsconfig: {
          module: "commonjs",
          moduleResolution: "node",
          ignoreDeprecations: "6.0",
          verbatimModuleSyntax: false,
          esModuleInterop: true,
          isolatedModules: true,
          types: ["node", "jest"],
        },
      },
    ],
  },
};
