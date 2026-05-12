// lib/common/db/index.ts

import mongoose from 'mongoose'

import config from '@/lib/common/config'
import HubAiMessages from '@/lib/common/db/models/hubAiMessage.model'

interface Message {
  userId: string
  role: string
  content: string
}

/**
 * @function dbConnect  Connect to mongoDB using Mongoose.
 *
 * @return {object}     A Mongoose instance.
 */
export const dbConnect = async (): Promise<typeof mongoose> => {
  if (!config.db.url) {
    throw new Error('Please define the MONGODB_URI environment variable')
  }
  await mongoose.connect(config.db.url)
  return mongoose
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