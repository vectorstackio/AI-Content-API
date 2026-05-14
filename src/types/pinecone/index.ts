// types/pinecone/index.ts

export type UserType = 'pupil' | 'teacher' | 'tutor'

export type ChunkMetadata = {
  chunk: string
  userType: UserType
  source?: string
  url?: string
}