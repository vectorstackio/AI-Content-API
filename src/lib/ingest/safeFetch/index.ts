import { lookup } from 'node:dns/promises'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { isIP } from 'node:net'
import { ClientError } from '@/lib/common/error'
import { isPublicAddress } from './address'

export const FETCH_LIMITS = {
  connectionMs: 5000,
  overallMs: 15000,
  responseBytes: 2 * 1024 * 1024,
} as const

function parseUrl(input: string): URL {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    throw new ClientError('Invalid URL')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ClientError('Only HTTP and HTTPS URLs are supported')
  }
  if (url.username || url.password) throw new ClientError('URL credentials are not allowed')
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '')
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new ClientError('URL destination is not public')
  }
  return url
}

/** Fetch HTML with a fresh direct connection pinned to a validated DNS snapshot. */
export async function fetchHtml(input: string): Promise<string> {
  const url = parseUrl(input)
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  const abort = new AbortController()
  const timeoutError = new ClientError('URL request timed out')
  const overallTimer = setTimeout(() => abort.abort(timeoutError), FETCH_LIMITS.overallMs)
  // DNS lookup itself is not cancellable; race it against the same overall deadline.
  let onAbort: () => void = () => {}
  const deadline = new Promise<never>((_, reject) => {
    onAbort = () => reject(timeoutError)
    abort.signal.addEventListener('abort', onAbort, { once: true })
  })

  try {
    const operation = async () => {
      const addresses = isIP(hostname)
        ? [{ address: hostname, family: isIP(hostname) }]
        : await lookup(hostname, { all: true, verbatim: true })
      if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
        throw new ClientError('URL destination is not public')
      }
      if (abort.signal.aborted) throw timeoutError
      const destination = addresses[0]

      return new Promise<string>((resolve, reject) => {
        const request = url.protocol === 'https:' ? httpsRequest : httpRequest
        // Node retains the URL hostname for Host, TLS SNI and certificate checks.
        // No proxy, redirects, connection pooling or subsequent DNS resolution.
        const req = request(url, {
          agent: false,
          signal: abort.signal,
          lookup: (_hostname, options, callback) => {
            if (options.all) callback(null, [destination])
            else callback(null, destination.address, destination.family)
          },
          headers: { Accept: 'text/html, application/xhtml+xml', 'Accept-Encoding': 'identity' },
        }, response => {
          const fail = (message: string) => {
            reject(new ClientError(message))
            response.destroy()
            req.destroy()
          }
          const status = response.statusCode ?? 0
          if (status >= 300 && status < 400) return fail('URL redirects are not supported')
          if (status < 200 || status >= 300) return fail('URL returned an unsuccessful response')
          const type = response.headers['content-type']?.split(';')[0].trim().toLowerCase()
          if (type !== 'text/html' && type !== 'application/xhtml+xml') {
            return fail('URL did not return HTML content')
          }
          const encoding = response.headers['content-encoding']
          if (encoding && encoding.toLowerCase() !== 'identity') {
            return fail('Compressed URL responses are not supported')
          }
          if (Number(response.headers['content-length']) > FETCH_LIMITS.responseBytes) {
            return fail('URL response is too large')
          }
          const chunks: Buffer[] = []
          let size = 0
          response.on('data', (chunk: Buffer) => {
            size += chunk.length
            if (size > FETCH_LIMITS.responseBytes) return fail('URL response is too large')
            chunks.push(chunk)
          })
          response.once('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
          response.once('error', reject)
        })
        const connectionTimer = setTimeout(() => req.destroy(timeoutError), FETCH_LIMITS.connectionMs)
        req.once('socket', socket => {
          socket.once(url.protocol === 'https:' ? 'secureConnect' : 'connect', () => {
            clearTimeout(connectionTimer)
          })
        })
        req.once('close', () => clearTimeout(connectionTimer))
        req.setTimeout(FETCH_LIMITS.connectionMs, () => req.destroy(timeoutError))
        req.once('error', reject)
        req.end()
      })
    }
    return await Promise.race([operation(), deadline])
  } catch (error) {
    if (abort.signal.aborted) throw timeoutError
    if (error instanceof ClientError) throw error
    throw new ClientError('Unable to fetch URL')
  } finally {
    clearTimeout(overallTimer)
    abort.signal.removeEventListener('abort', onAbort)
  }
}
