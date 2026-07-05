module.exports = {
  env: {
    browser: true,
    node: true,
    es2021: true,
    jest: true, // Add jest environment for testing globals
  },
  extends: [
    'react-app',
    'react-app/jest',
    'plugin:react-hooks/recommended', // Explicitly add react-hooks recommended rules
  ],
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 12,
    sourceType: 'module',
  },
  plugins: [
    'react',
    'react-hooks', // Ensure react-hooks plugin is listed
  ],
  rules: {
    // You can add custom rules here if needed
    // For example, to ignore no-undef for specific globals if necessary
    // 'no-undef': 'off', 
  },
};