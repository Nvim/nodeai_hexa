import { readFile, readdir } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { chunkMarkdown } from './chunker.js'
import type Database from 'better-sqlite3'
import type { Stmts, IndexResult } from '../types.js'

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434'
const EMBED_MODEL = process.env.EMBED_MODEL ?? 'nomic-embed-text'
const DOCS_DIR = join(process.cwd(), 'docs')

export async function getEmbedding(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text })
  })
  if (!res.ok) throw new Error(`Ollama embeddings error: ${res.status}`)
  const data = await res.json() as { embedding: number[] }
  return data.embedding
}

export async function indexDocs(db: Database.Database, stmts: Stmts): Promise<IndexResult> {
  const files = await readdir(DOCS_DIR, { recursive: true })
  const markdownFiles = (files as string[]).filter(f => extname(f) === '.md')

  let totalChunks = 0

  db.prepare('DELETE FROM chunks').run()

  for (const file of markdownFiles) {
    const fullPath = join(DOCS_DIR, file)
    const content = await readFile(fullPath, 'utf8')
    const chunks = chunkMarkdown(content, file)

    for (const chunk of chunks) {
      const embedding = await getEmbedding(chunk.content)
      stmts.insertChunk.run(
        chunk.source,
        chunk.section,
        chunk.position,
        chunk.content,
        JSON.stringify(embedding)
      )
      totalChunks++
    }
  }

  return { files: markdownFiles.length, chunks: totalChunks }
}