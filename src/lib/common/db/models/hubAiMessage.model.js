// src/lib/common/db/models/hubAiMessage.model.js

import mongoose from 'mongoose'

const Schema = mongoose.Schema
const fields = {
  userId: { type: String, required: true },
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
}

const HubAiMessagesSchema = new Schema(
  fields,
  { timestamps: true }
)

export default mongoose.model('HubAiMessages', HubAiMessagesSchema)