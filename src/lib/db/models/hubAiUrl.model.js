// src/lib/db/models/hubAiUrl.model.js

import mongoose from 'mongoose'

const Schema = mongoose.Schema
const fields = {
  url: { type: String, required: true },
  content: { type: String, required: true },
  contentHash: { type: String, required: true },
}

const HubAiUrlsSchema = new Schema(
  fields,
  { timestamps: true }
)

export default mongoose.model('HubAiUrls', HubAiUrlsSchema)