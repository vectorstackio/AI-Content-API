// lib/common/db/index.ts

import HubAiMessages from '@/lib/common/db/models/hubAiMessage.model'

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
    await HubAiMessages.create(data)

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
  const messages = await HubAiMessages.find({
    userId,
  }).sort({ createdAt: 1 }).limit(limit)

  return messages
}

export { dbConnect } from '@/lib/common/db/helpers'