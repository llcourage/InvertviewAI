#!/usr/bin/env node
/**
 * Jest runner script for Bazel
 * This script runs Jest with the configuration file
 */

const { execSync } = require('child_process');
const path = require('path');

try {
  // Get the jest config path
  const jestConfigPath = path.join(__dirname, '..', 'jest.config.js');
  const jestBinPath = require.resolve('jest/bin/jest.js');
  
  // Run jest synchronously for Bazel
  execSync(`node "${jestBinPath}" --config "${jestConfigPath}"`, {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
  });
  
  process.exit(0);
} catch (error) {
  console.error('Jest test failed:', error.message);
  process.exit(1);
}
