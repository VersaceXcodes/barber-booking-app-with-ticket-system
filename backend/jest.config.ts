module.exports = {
  "preset": "ts-jest",
  "testEnvironment": "node",
  "roots": [
    "<rootDir>/tests"
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
  "coverageThresholds": {
    "global": {
      "statements": 80,
      "branches": 75,
      "functions": 80,
      "lines": 80
    }
  },
  "setupFilesAfterEnv": [
    "<rootDir>/tests/setup.ts"
  ],
  "testTimeout": 10000,
  "maxWorkers": 1,
  "verbose": true,
  "bail": false,
  "detectOpenHandles": true,
  "forceExit": true,
  "clearMocks": true,
  "resetMocks": true,
  "restoreMocks": true,
  "globals": {
    "ts-jest": {
      "tsconfig": {
        "esModuleInterop": true,
        "allowSyntheticDefaultImports": true
      }
    }
  }
};