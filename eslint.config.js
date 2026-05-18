'use strict';

const js = require('@eslint/js');

module.exports = [
  js.configs.recommended,
  {
    ignores: [
      'eslint.config.js',
      'jest.config.js',
      'gen/**',
      'app/**',
      'node_modules/**',
    ],
  },
  {
    files: ['*.js', 'srv/**/*.js', 'test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        // Node.js
        require:    'readonly',
        module:     'readonly',
        exports:    'readonly',
        __dirname:  'readonly',
        __filename: 'readonly',
        process:    'readonly',
        console:    'readonly',
        global:     'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        INSERT:     'readonly',
        SELECT:     'readonly',
        UPDATE:     'readonly',
        DELETE:     'readonly',
        // Jest
        describe:   'readonly',
        test:       'readonly',
        expect:     'readonly',
        beforeAll:  'readonly',
        afterAll:   'readonly',
        beforeEach: 'readonly',
        afterEach:  'readonly',
        jest:       'readonly',
        // Node.js 18+ globals
        fetch:           'readonly',
        URLSearchParams: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console':     'warn',
      eqeqeq:           'error',
      semi:             ['error', 'always'],
      'no-var':         'error',
    },
  },
  // Test scripts at repo root are allowed to log
  {
    files: ['test-*.js'],
    rules: {
      'no-console': 'off',
    },
  },
];
