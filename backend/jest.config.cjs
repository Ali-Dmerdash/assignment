/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  // ESM mode: required because file-type (and its plugins) are ESM-only.
  extensionsToTreatAsEsm: [".ts"],
  // Source uses nodenext-style ".js" import specifiers; strip them so the
  // ".ts" sources resolve.
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  setupFiles: ["<rootDir>/test/setup.ts"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { useESM: true }],
  },
};
