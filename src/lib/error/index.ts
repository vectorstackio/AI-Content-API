// lib/error/index.ts

/**
 * Class to provide custom error type.
 */
class ClientError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ClientError'
  }
}

export { ClientError }