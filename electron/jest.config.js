module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  testMatch: ['**/__tests__/**/*_test.ts', '**/?(*.)+_test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/build-preload.js',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  // Mock Electron modules
  moduleNameMapper: {
    '^electron$': '<rootDir>/__tests__/mocks/electron.mock.ts',
  },
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
};

