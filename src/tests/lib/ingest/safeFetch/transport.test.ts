import { createServer } from 'node:http'
import { Socket } from 'node:net'
import { once } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { fetchHtml } from '@/lib/ingest/safeFetch'

const { resolve } = vi.hoisted(() => ({ resolve: vi.fn() }))
vi.mock('node:dns/promises', () => ({ lookup: resolve }))
// Only this isolated transport fixture admits loopback. The real address policy
// is exercised independently in address.test.ts and index.test.ts.
vi.mock('@/lib/ingest/safeFetch/address', () => ({
  isPublicAddress: (address: string) => address === '127.0.0.1',
}))

describe('real Node HTTP transport', () => {
  it('uses the validated DNS snapshot on the actual socket, retaining Host', async () => {
    // Restore the test suite's network guard only for this local fixture.
    vi.mocked(Socket.prototype.connect).mockRestore()
    const received = vi.fn()
    const server = createServer((req, res) => {
      received(req.headers.host)
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<article><p>Pinned destination</p></article>')
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    try {
      const address = server.address()
      if (!address || typeof address === 'string') throw new Error('Missing fixture address')
      // A second resolution would return a different (unvalidated) destination.
      resolve.mockReset()
        .mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }])
        .mockResolvedValue([{ address: '127.0.0.2', family: 4 }])
      const hostname = `rebinding.invalid:${address.port}`
      await expect(fetchHtml(`http://${hostname}`)).resolves.toContain('Pinned destination')
      expect(resolve).toHaveBeenCalledOnce()
      expect(received).toHaveBeenCalledExactlyOnceWith(hostname)
    } finally {
      await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()))
    }
  })
})
