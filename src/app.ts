import Fastify from 'fastify'
import sensible from '@fastify/sensible'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import dbPlugin from '#src/plugins/db.js'
import { OllamaAdapter } from '#src/adapters/outbound/ollama/OllamaAdapter.js'
import { SqliteConversationRepo } from '#src/adapters/outbound/sqlite/SqliteConversationRepo.js'
import { SqliteChunkRepo } from '#src/adapters/outbound/sqlite/SqliteChunkRepo.js'
import { SqliteDocumentIndexer } from '#src/adapters/outbound/sqlite/SqliteDocumentIndexer.js'
import { ChatUseCase } from '#src/domain/use-cases/ChatUseCase.js'
import { ConversationsUseCase } from '#src/domain/use-cases/ConversationsUseCase.js'
import { AgentUseCase } from '#src/domain/use-cases/AgentUseCase.js'
import { RagSearchUseCase, RagReindexUseCase } from '#src/domain/use-cases/RagUseCases.js'
import { RagChatUseCase } from '#src/domain/use-cases/RagChatUseCase.js'
import { healthRoute } from '#src/adapters/inbound/http/routes/health.js'
import { chatRoute } from '#src/adapters/inbound/http/routes/chat.js'
import { conversationsRoute } from '#src/adapters/inbound/http/routes/conversations.js'
import { agentRoute } from '#src/adapters/inbound/http/routes/agent.js'
import { ragRoute } from '#src/adapters/inbound/http/routes/rag.js'

export async function buildApp(opts?: Partial<import('fastify').FastifyServerOptions>) {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
        : undefined
    },
    ...opts
  }).withTypeProvider<TypeBoxTypeProvider>()

  await app.register(sensible)
  await app.register(dbPlugin)

  // Outbound adapters
  const ollama = new OllamaAdapter()
  const convRepo = new SqliteConversationRepo(app.db)
  const chunkRepo = new SqliteChunkRepo(app.db)
  const documentIndexer = new SqliteDocumentIndexer(chunkRepo, ollama)

  // Use cases
  const chatUseCase = new ChatUseCase(ollama)
  const conversationsUseCase = new ConversationsUseCase(convRepo, ollama)
  const agentUseCase = new AgentUseCase(ollama)
  const ragSearchUseCase = new RagSearchUseCase(ollama, chunkRepo)
  const ragReindexUseCase = new RagReindexUseCase(documentIndexer)
  const ragChatUseCase = new RagChatUseCase(ollama, ragSearchUseCase)

  // Decorate app with use cases for route access
  app.decorate('chatUseCase', chatUseCase)
  app.decorate('conversationsUseCase', conversationsUseCase)
  app.decorate('agentUseCase', agentUseCase)
  app.decorate('ragSearchUseCase', ragSearchUseCase)
  app.decorate('ragReindexUseCase', ragReindexUseCase)
  app.decorate('ragChatUseCase', ragChatUseCase)

  app.addHook('onReady', async () => {
    if (chunkRepo.count() === 0) {
      app.log.info('RAG: no chunks in DB, indexing documents...')
      try {
        const { files, chunks } = await ragReindexUseCase.reindex()
        app.log.info(`RAG: indexed ${chunks} chunks from ${files} files`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        app.log.warn({ err: msg }, 'RAG: indexing failed (empty docs or Ollama unavailable)')
      }
    } else {
      app.log.info(`RAG: ${chunkRepo.count()} chunks already indexed`)
    }
  })

  // Inbound adapters (routes)
  await app.register(healthRoute)
  await app.register(chatRoute)
  await app.register(conversationsRoute)
  await app.register(agentRoute)
  await app.register(ragRoute)

  return app
}
