// lib/common/db/index.ts

import config from '@/lib/common/config'

interface Message {
  userId: string
  role: string
  content: string
  queryId: string
}

/**
 * @function safeCreateMessage  Create a new message in the database.
 *
 * @param  {object} data  The message data.
 */
export async function safeCreateMessage(data: Message): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const response = await fetch(`${config.app.apiUrl}/api/v02/db/hubAiMessages?tspAuthToken=${config.app.apiAuthToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) throw new Error(`Message persistence failed (${response.status})`)

    return {
      success: true,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

/**
 * @function getConversationHistory  Get the last 20 messages for a user.
 *
 * @param  {string} userId  The user ID.
 * @param  {number} limit   The number of messages to retrieve.
 */
export async function getConversationHistory(userId: string, limit: number = 20): Promise<Message[]> {
  const response = await fetch(
    `${config.app.apiUrl}/api/v02/db/hubAiMessages?userId=${encodeURIComponent(userId)}&limit=${limit}&tspAuthToken=${config.app.apiAuthToken}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    }
  )
  if (!response.ok) throw new Error(`Conversation history request failed (${response.status})`)
  const data = await response.json()
  const messages = data.records ?? []
  if (!Array.isArray(messages)) throw new Error('Invalid conversation history response')

  return messages
}

export { dbConnect } from '@/lib/common/db/helpers'
