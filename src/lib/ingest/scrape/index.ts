// lib/ingest/scrape/index.ts

import { fetchHtml } from '@/lib/ingest/safeFetch'
import * as cheerio from 'cheerio'

/**
 * @function scrapeUrl  Upsert vectors into Pinecone.
 *
 * @param  {string} url The data being scraped.
 * @return {string}     The scraped content. 
 */
export const scrapeUrl = async (url: string): Promise<string> => {
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)

  const article = $('article, .article, .content').first()

  const text: string[] = []

  article.find('h1, h2, h3, p, li').each((_, el) => {
    const t = $(el).text().trim()
    if (t) text.push(t)
  })

  return text.join(' ')
}