// functions/.eslintrc.js
module.exports = {
  root: true, // Rất quan trọng: Giúp ESLint không đi tìm .eslintrc từ thư mục cha (root project)
  env: {
    es6: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'next/core-web-vitals'

  ],
  parserOptions: {
    ecmaVersion: 2022, 
  },
  rules: {
    'no-restricted-globals': ['error', 'name', 'length'],
    'prefer-arrow-callback': 'error',
    'no-console': 'off', 
    'require-jsdoc': 'off',
    'valid-jsdoc': 'off',
    
  },
};
