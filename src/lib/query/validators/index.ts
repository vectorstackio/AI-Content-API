// lib/query/validators/index.ts

import { z } from 'zod'

export const querySchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, 'Question is required')
    .max(2000, 'Question too long'),

  userType: z.enum(['pupil', 'teacher', 'tutor']),
})

export type QueryInput = z.infer<typeof querySchema>