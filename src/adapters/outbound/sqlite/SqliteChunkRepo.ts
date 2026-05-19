import type Database from 'better-sqlite3'
import type { ChunkRepositoryPort } from '#src/domain/ports/outbound/ChunkRepositoryPort.js'
import type { ChunkModel } from '#src/domain/models/Chunk.js'

export class SqliteChunkRepo implements ChunkRepositoryPort {
  private readonly insertStmt: Database.Statement
  private readonly getAllStmt: Database.Statement
  private readonly countStmt: Database.Statement
  private readonly deleteAllStmt: Database.Statement

  constructor(private readonly db: Database.Database) {
    this.insertStmt = db.prepare(
      'INSERT INTO chunks (source, section, position, content, embedding) VALUES (?, ?, ?, ?, ?)'
    )
    this.getAllStmt = db.prepare('SELECT id, source, section, position, content, embedding FROM chunks')
    this.countStmt = db.prepare('SELECT COUNT(*) as count FROM chunks')
    this.deleteAllStmt = db.prepare('DELETE FROM chunks')
  }

  deleteAll(): void {
    this.deleteAllStmt.run()
  }

  insert(chunk: Omit<ChunkModel, 'id' | 'embedding'> & { embedding: string }): void {
    this.insertStmt.run(chunk.source, chunk.section, chunk.position, chunk.content, chunk.embedding)
  }

  getAllWithEmbeddings(): Array<{
    id: number
    source: string
    section: string
    position: number
    content: string
    embedding: string
  }> {
    return this.getAllStmt.all() as Array<{
      id: number
      source: string
      section: string
      position: number
      content: string
      embedding: string
    }>
  }

  count(): number {
    const row = this.countStmt.get() as { count: number }
    return row.count
  }
}
