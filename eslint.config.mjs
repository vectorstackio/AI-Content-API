import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
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
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'src/scripts/**'
  ]),
])

export default eslintConfig
