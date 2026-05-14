// jest.setup.ts

import '@testing-library/jest-dom'

jest.mock('mongoose', () => ({
  connect: jest.fn(),
  model: jest.fn(),
  Schema: jest.fn(),
}))

jest.mock('@/lib/common/db/models/hubAiMessage.model', () => ({
  create: jest.fn(),
  find: jest.fn(),
}))
