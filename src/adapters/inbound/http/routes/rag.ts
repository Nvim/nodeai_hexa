import { ChatMessageBody, RagSearchBody } from '#src/adapters/inbound/http/schemas.js'
import { createSseSink } from '#src/adapters/inbound/http/sse.js'
import type { App } from '#src/types.js'

export async function ragRoute(app: App) {
  app.post('/rag/reindex', async (request, reply) => {
    request.log.info('RAG: manual reindex triggered')
    const result = await app.ragReindexUseCase.reindex()
    return { indexed: true, files: result.files, chunks: result.chunks }
  })

  app.post('/rag/search', {
    schema: { body: RagSearchBody }
  }, async (request) => {
    const { query, k = 4 } = request.body as { query: string; k?: number }
    const results = await app.ragSearchUseCase.search(query, k)
    return results.map(r => ({
      source: r.source,
      section: r.section,
      content: r.content,
      similarity: Math.round(r.similarity * 1000) / 1000
    }))
  })

  app.post('/chat/rag', {
    schema: { body: ChatMessageBody }
  }, async (request, reply) => {
    const { message } = request.body

    const controller = new AbortController()
    const sink = createSseSink(reply)

    request.socket.once('close', () => controller.abort())

    try {
      for await (const event of app.ragChatUseCase.chat(message, controller.signal)) {
        sink.sendEvent(event)
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        request.log.error(err, 'RAG streaming error')
        sink.sendEvent({ type: 'error', message: (err as Error).message })
      }
    } finally {
      sink.end()
    }
  })
}
