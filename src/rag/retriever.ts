import { getEmbedding } from './indexer.js'
import type { Stmts, RetrievedChunk, ChunkRow } from '../types.js'

const MIN_SIMILARITY = 0.65

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export async function retrieve(stmts: Stmts, query: string, k = 4): Promise<RetrievedChunk[]> {
  const queryEmbedding = await getEmbedding(query)

  const chunks = stmts.getAllChunks.all() as ChunkRow[]

  const ranked = chunks
    .map(chunk => {
      const embedding = JSON.parse(chunk.embedding) as number[]
      const similarity = cosineSimilarity(queryEmbedding, embedding)
      return { source: chunk.source, section: chunk.section, content: chunk.content, similarity }
    })
    .filter(c => c.similarity >= MIN_SIMILARITY)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k)

  return ranked
}