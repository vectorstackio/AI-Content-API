// lib/common/db/helpers.ts

import mongoose from 'mongoose'
import config from '@/lib/common/config'

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