/**
 * Jest config scoped to pure unit tests of business logic (debt math, formatting).
 *
 * Uses the ts-jest preset with a Node environment on purpose: these utilities are
 * framework-agnostic pure functions, so we deliberately avoid the React Native /
 * Expo transform pipeline. This keeps the test run fast and fully isolated from the
 * app runtime — adding tests has zero effect on the shipped application.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  clearMocks: true,
};
