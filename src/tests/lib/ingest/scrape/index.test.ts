import { describe, it, expect, vi } from 'vitest'

import { fetchHtml } from '@/lib/ingest/safeFetch'
import { scrapeUrl } from '@/lib/ingest/scrape'

vi.mock('@/lib/ingest/safeFetch', () => ({ fetchHtml: vi.fn() }))
const mockedFetchHtml = vi.mocked(fetchHtml)

describe('scrapeUrl', () => {
  it('extracts text from headings, paragraphs and list items', async () => {
    mockedFetchHtml.mockResolvedValue(`
        <html>
          <body>
            <article>
              <h1>Main Title</h1>
              <h2>Subtitle</h2>
              <p>First paragraph</p>
              <ul>
                <li>Item 1</li>
                <li>Item 2</li>
              </ul>
            </article>
          </body>
        </html>
      `
    )

    const result = await scrapeUrl('https://example.com')

    expect(mockedFetchHtml).toHaveBeenCalledWith(
      'https://example.com'
    )

    expect(result).toBe(
      'Main Title Subtitle First paragraph Item 1 Item 2'
    )
  })

  it('uses the first matching content container only', async () => {
    mockedFetchHtml.mockResolvedValue(`
        <html>
          <body>
            <div class="content">
              <p>First container</p>
            </div>

            <article>
              <p>Second container</p>
            </article>
          </body>
        </html>
      `
    )

    const result = await scrapeUrl('https://example.com')

    expect(result).toBe('First container')
  })

  it('ignores empty text nodes', async () => {
    mockedFetchHtml.mockResolvedValue(`
        <html>
          <body>
            <article>
              <p>   </p>
              <p>Valid text</p>
              <li></li>
            </article>
          </body>
        </html>
      `
    )

    const result = await scrapeUrl('https://example.com')

    expect(result).toBe('Valid text')
  })

  it('returns an empty string when no matching container exists', async () => {
    mockedFetchHtml.mockResolvedValue(`
        <html>
          <body>
            <div>
              <p>No matching wrapper</p>
            </div>
          </body>
        </html>
      `
    )

    const result = await scrapeUrl('https://example.com')

    expect(result).toBe('')
  })
})
