// lib/query/prompt/index.ts

type BuildPromptParams = {
  question: string
  contextChunks: string[]
}

export function buildPrompt({
  question,
  contextChunks,
}: BuildPromptParams) {
  const formattedContext = contextChunks
    .filter(Boolean)
    .map((chunk, index) => {
      return `[Source ${index + 1}]\n${chunk}`
    })
    .join('\n\n')

  return [
    {
      role: 'system' as const,
      content: `
You are a retrieval-based assistant.

Rules:
- Answer ONLY using the provided sources
- Never invent facts
- If the answer is not present, say "I don't know"
- Keep answers concise
- If sources conflict, say so
      `,
    },

    {
      role: 'user' as const,
      content: `
SOURCES:
${formattedContext}

QUESTION:
${question}
      `,
    },
  ]
}