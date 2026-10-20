import { describe, it, expect, vi } from 'vitest'
import type { Mocked } from 'vitest'

import axios from 'axios'
import { scrapeUrl } from '@/lib/ingest/scrape'

vi.mock('axios')
const mockedAxios = axios as Mocked<typeof axios>

describe('scrapeUrl', () => {
  it('extracts text from headings, paragraphs and list items', async () => {
    mockedAxios.get.mockResolvedValue({
      data: `
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
      `,
    })

    const result = await scrapeUrl('https://example.com')

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://example.com'
    )

    expect(result).toBe(
      'Main Title Subtitle First paragraph Item 1 Item 2'
    )
  })

  it('uses the first matching content container only', async () => {
    mockedAxios.get.mockResolvedValue({
      data: `
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
      `,
    })

    const result = await scrapeUrl('https://example.com')

    expect(result).toBe('First container')
  })

  it('ignores empty text nodes', async () => {
    mockedAxios.get.mockResolvedValue({
      data: `
        <html>
          <body>
            <article>
              <p>   </p>
              <p>Valid text</p>
              <li></li>
            </article>
          </body>
        </html>
      `,
    })

    const result = await scrapeUrl('https://example.com')

    expect(result).toBe('Valid text')
  })

  it('returns an empty string when no matching container exists', async () => {
    mockedAxios.get.mockResolvedValue({
      data: `
        <html>
          <body>
            <div>
              <p>No matching wrapper</p>
            </div>
          </body>
        </html>
      `,
    })

    const result = await scrapeUrl('https://example.com')

    expect(result).toBe('')
  })
})
