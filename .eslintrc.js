module.exports = {
  root: true,
  env: {
    node: true
  },
  'extends': [
    'plugin:vue/vue3-essential',
    'eslint:recommended'
  ],
  rules: {
    'no-console': 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'generator-star-spacing': 'off',
    'space-before-function-paren': 0,
    "vue/no-parsing-error": [2, {
      "x-invalid-end-tag": false
    }],
    'space-in-parens': [0, 'never']
  },
  parserOptions: {
    ecmaVersion: 2020
  }
}
