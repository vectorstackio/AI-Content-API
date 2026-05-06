// lib/error/index.ts

class ClientError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ClientError'
  }
}

export { ClientError }