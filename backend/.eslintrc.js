module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended'],
  env: {
    node: true,
    es2020: true,
  },
  rules: {
    // Disable base rule and use TypeScript version
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_',
        'caughtErrorsIgnorePattern': '^_',
        // Allow unused parameters in function type definitions
        'args': 'after-used'
      }
    ],
    'no-console': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
  },
};
