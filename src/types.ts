import type {
  FastifyInstance,
  FastifyBaseLogger,
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
} from 'fastify'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import type Database from 'better-sqlite3'

export type App = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression<RawServerDefault>,
  RawReplyDefaultExpression<RawServerDefault>,
  FastifyBaseLogger,
  TypeBoxTypeProvider
>

export interface ConversationRow {
  id: number
  title: string
  createdAt: string
  messageCount?: number
}

export interface MessageRow {
  id: number
  conversationId: number
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
}

export interface ChunkRow {
  id: number
  source: string
  section: string
  position: number
  content: string
  embedding: string
}

export interface Stmts {
  createConv: Database.Statement
  listConvs: Database.Statement
  getConv: Database.Statement
  deleteConv: Database.Statement
  getMessages: Database.Statement
  addMessage: Database.Statement
  insertChunk: Database.Statement
  getAllChunks: Database.Statement
  countChunks: Database.Statement
}

export interface ChunkData {
  source: string
  section: string
  position: number
  content: string
}

export interface RetrievedChunk {
  source: string
  section: string
  content: string
  similarity: number
}

export interface IndexResult {
  files: number
  chunks: number
}

declare module 'fastify' {
  interface FastifyInstance {
    db: Database.Database
    stmts: Stmts
  }
}