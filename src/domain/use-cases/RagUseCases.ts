import type { EmbeddingServicePort } from '#src/domain/ports/outbound/EmbeddingServicePort.js'
import type { ChunkRepositoryPort } from '#src/domain/ports/outbound/ChunkRepositoryPort.js'
import type { DocumentIndexerPort, IndexResult } from '#src/domain/ports/outbound/DocumentIndexerPort.js'

export interface RetrievedChunk {
  source: string
  section: string
  content: string
  similarity: number
}

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

export class RagSearchUseCase {
  constructor(
    private readonly embeddingService: EmbeddingServicePort,
    private readonly chunkRepo: ChunkRepositoryPort
  ) {}

  async search(query: string, k = 4): Promise<RetrievedChunk[]> {
    const queryEmbedding = await this.embeddingService.getEmbedding(query)

    const chunks = this.chunkRepo.getAllWithEmbeddings()

    const ranked = chunks
      .map(chunk => {
        const embedding = JSON.parse(chunk.embedding) as number[]
        const similarity = cosineSimilarity(queryEmbedding, embedding)
        return {
          source: chunk.source,
          section: chunk.section,
          content: chunk.content,
          similarity
        }
      })
      .filter(c => c.similarity >= MIN_SIMILARITY)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k)

    return ranked
  }
}

export class RagReindexUseCase {
  constructor(private readonly indexer: DocumentIndexerPort) {}

  async reindex(): Promise<IndexResult> {
    return this.indexer.indexDocs()
  }
}
