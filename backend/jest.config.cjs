module.exports = {
  "preset": "ts-jest/presets/default-esm",
  "testEnvironment": "node",
  "extensionsToTreatAsEsm": [".ts"],
  "roots": [
    "<rootDir>"
  ],
  "testMatch": [
    "**/__tests__/**/*.ts",
    "**/?(*.)+(spec|test).ts"
  ],
  "moduleFileExtensions": [
    "ts",
    "tsx",
    "js",
    "jsx",
    "json",
    "node"
  ],
  "collectCoverageFrom": [
    "**/*.ts",
    "!**/*.d.ts",
    "!**/node_modules/**",
    "!**/tests/**",
    "!**/dist/**"
  ],
  "coverageThreshold": {
    "global": {
      "statements": 80,
      "branches": 75,
      "functions": 80,
      "lines": 80
    }
  },
  "testTimeout": 10000,
  "maxWorkers": 1,
  "verbose": true,
  "bail": false,
  "detectOpenHandles": true,
  "forceExit": true,
  "clearMocks": true,
  "resetMocks": true,
  "restoreMocks": true,
  "transform": {
    "^.+\\.ts$": [
      "ts-jest",
      {
        "useESM": true,
        "tsconfig": {
          "esModuleInterop": true,
          "allowSyntheticDefaultImports": true
        }
      }
    ]
  },
  "moduleNameMapper": {
    "^(\\.{1,2}/.*)\\.js$": "$1"
  }
};