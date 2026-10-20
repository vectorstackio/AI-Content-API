import { Socket } from 'node:net'
import { beforeEach, vi } from 'vitest'

// Never load developer credentials or connect real database clients in unit tests.
vi.mock('server-only', () => ({}))
vi.mock('dotenv', () => ({ config: vi.fn() }))
vi.mock('mongoose', () => ({
  default: { connect: vi.fn() },
}))

for (const [name, value] of Object.entries({
  OPENAI_API_KEY: 'test-openai-key',
  PINECONE_API_KEY: 'test-pinecone-key',
  PINECONE_INDEX_NAME: 'test-index',
  API_AUTH_TOKEN: 'test-token',
  API_URL: 'https://database.invalid',
  DB_URL: 'mongodb://database.invalid/test',
})) {
  process.env[name] = value
}

function blockNetwork() {
  vi.stubGlobal('fetch', vi.fn(() => {
    throw new Error('Unexpected fetch: mock external HTTP in this test')
  }))
  // Also block Axios, SDK transports and accidental Redis/MongoDB connections.
  vi.spyOn(Socket.prototype, 'connect').mockImplementation(() => {
    throw new Error('Unexpected socket connection: mock the external dependency')
  })
}

blockNetwork()
beforeEach(blockNetwork)
