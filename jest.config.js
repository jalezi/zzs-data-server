/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.jest-test.*'],
  transform: {
    '^.+.tsx?$': ['ts-jest', {}],
  },
  passWithNoTests: true,
}
