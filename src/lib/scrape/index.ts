// lib/scrape/index.js

import axios from 'axios'
import * as cheerio from 'cheerio'

export async function scrapeUrl(url: string): Promise<string> {
  const { data: html } = await axios.get(url)
  const $ = cheerio.load(html)

  const article = $('article, .article, .content').first()

  const text: string[] = []

  article.find('h1, h2, h3, p, li').each((_, el) => {
    const t = $(el).text().trim()
    if (t) text.push(t)
  })

  return text.join(' ')
}