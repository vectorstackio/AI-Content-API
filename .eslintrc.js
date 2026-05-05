module.exports = {
  'env': {
    'browser': true,
    'es6': true,
    'node': true,
    'jest': true,
    'amd': true
  },
  'extends': [
    'next/core-web-vitals',
    'eslint:recommended',
    'plugin:react/recommended'
  ],
  'parserOptions': {
    'ecmaFeatures': {
      'jsx': true
    },
    'ecmaVersion': 2020,
    'sourceType': 'module',
    'allowImportExportEverywhere': true
  },
  'plugins': [
    'react'
  ],
  'settings': {
    'react': {
      'version': 'detect'
    }
  },
  'rules': {
    'react/no-unknown-property': ['error', { ignore: ['jsx', 'global'], }],
    'react/react-in-jsx-scope': 'off',
    'no-control-regex': 0,
    'no-prototype-builtins': 0,
    'no-console': 2,
    'react/prop-types': ['error'],
    'no-unused-vars': [
      'error',
      {
        'ignoreRestSiblings': true
      }
    ],
    'indent': [
      'error',
      2
    ],
    'linebreak-style': [
      'error',
      'unix'
    ],
    'quotes': [
      'error',
      'single'
    ],
    'semi': [
      'error',
      'never'
    ]
  }
}
