import type { ChunkModel } from '#src/domain/models/Chunk.js'

export interface ChunkRepositoryPort {
  deleteAll(): void
  insert(chunk: Omit<ChunkModel, 'id' | 'embedding'> & { embedding: string }): void
  getAllWithEmbeddings(): Array<{
    id: number
    source: string
    section: string
    position: number
    content: string
    embedding: string
  }>
  count(): number
}
