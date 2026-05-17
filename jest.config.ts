// jest.config.ts

import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  'coverageThreshold': {
    'global': {
      'statements': 80,
      'branches': 80,
      'functions': 80,
      'lines': 80
    }
  },
}

export default createJestConfig(customJestConfig)