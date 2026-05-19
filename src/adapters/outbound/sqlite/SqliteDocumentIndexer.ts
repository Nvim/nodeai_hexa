import { readFile, readdir } from 'node:fs/promises'
import { join, extname } from 'node:path'
import type { DocumentIndexerPort, IndexResult } from '#src/domain/ports/outbound/DocumentIndexerPort.js'
import type { EmbeddingServicePort } from '#src/domain/ports/outbound/EmbeddingServicePort.js'
import type { ChunkRepositoryPort } from '#src/domain/ports/outbound/ChunkRepositoryPort.js'
import { chunkMarkdown } from '#src/domain/models/chunker.js'

const DOCS_DIR = join(process.cwd(), 'docs')

export class SqliteDocumentIndexer implements DocumentIndexerPort {
  constructor(
    private readonly chunkRepo: ChunkRepositoryPort,
    private readonly embeddingService: EmbeddingServicePort
  ) {}

  async indexDocs(): Promise<IndexResult> {
    const files = await readdir(DOCS_DIR, { recursive: true })
    const markdownFiles = (files as string[]).filter(f => extname(f) === '.md')

    this.chunkRepo.deleteAll()

    let totalChunks = 0

    for (const file of markdownFiles) {
      const fullPath = join(DOCS_DIR, file)
      const content = await readFile(fullPath, 'utf8')
      const chunks = chunkMarkdown(content, file)

      for (const chunk of chunks) {
        const embedding = await this.embeddingService.getEmbedding(chunk.content)
        this.chunkRepo.insert({
          source: chunk.source,
          section: chunk.section,
          position: chunk.position,
          content: chunk.content,
          embedding: JSON.stringify(embedding)
        })
        totalChunks++
      }
    }

    return { files: markdownFiles.length, chunks: totalChunks }
  }
}
