module.exports = {
  root: true,
  extends: [],
  ignorePatterns: [
    'node_modules/',
    '.next/',
    'src/**/*.ts',
    'src/**/*.tsx',
    'src/**/*.js',
    'src/**/*.jsx',
    'public/'
  ],
  rules: {
    'no-unused-vars': 'off',
    'no-undef': 'off',
    'react/no-unescaped-entities': 'off'
  }
}; 