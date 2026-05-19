import { ChatMessageBody } from '#src/adapters/inbound/http/schemas.js'
import { createSseSink } from '#src/adapters/inbound/http/sse.js'
import type { App } from '#src/types.js'

export async function chatRoute(app: App) {
  app.post('/chat', {
    schema: {
      body: ChatMessageBody,
      response: {
        200: { type: 'object', properties: { response: { type: 'string' } } },
        502: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (request, reply) => {
    const { message } = request.body
    try {
      const response = await app.chatUseCase.chat(message)
      return { response }
    } catch (err) {
      request.log.error(err, 'Ollama error')
      return reply.status(502).send({ error: 'Ollama request failed' })
    }
  })

  app.post('/chat/stream', {
    schema: { body: ChatMessageBody }
  }, async (request, reply) => {
    const { message } = request.body
    const controller = new AbortController()
    const sink = createSseSink(reply)

    request.raw.once('close', () => {
      request.log.info('Client disconnected — aborting Ollama stream')
      controller.abort()
    })

    try {
      for await (const event of app.chatUseCase.chatStream(message, controller.signal)) {
        sink.sendEvent(event)
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        request.log.error(err, 'Streaming error')
        sink.sendEvent({ type: 'error', message: (err as Error).message })
      }
    } finally {
      sink.end()
    }
  })
}
