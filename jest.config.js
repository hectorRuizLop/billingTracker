'use strict';

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
  testTimeout: 30000,
  maxWorkers: 1,
  setupFiles: ['<rootDir>/test/setup.js'],
};
