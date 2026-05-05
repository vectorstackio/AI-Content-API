// lib/scrape/index.js

import axios from 'axios'
import * as cheerio from 'cheerio'

export async function scrapeUrl(): Promise<string[]> {
  const url = 'https://the-brilliant-club.helpscoutdocs.com/article/85-what-is-the-hub'

  try {
    const { data: html } = await axios.get(url)

    const $ = cheerio.load(html)

    const docs: string[] = []

    // Grab main article content
    const article = $('article, .article, .content').first()

    // Extract headings + paragraphs
    article.find('h1, h2, h3, p, li').each((_, el) => {
      const text = $(el).text().trim()

      if (
        text &&
        text.length > 40 && // filter noise
        !text.toLowerCase().includes('last updated') &&
        !text.toLowerCase().includes('click here')
      ) {
        docs.push(text)
      }
    })

    // Optional: merge small fragments into bigger chunks
    const mergedDocs: string[] = []
    let buffer = ''

    for (const line of docs) {
      if ((buffer + ' ' + line).length < 300) {
        buffer += ' ' + line
      } else {
        mergedDocs.push(buffer.trim())
        buffer = line
      }
    }

    if (buffer) mergedDocs.push(buffer.trim())

    return mergedDocs
  } catch /*(err)*/ {
    //console.error('Scraping failed:', err)
    return []
  }
}