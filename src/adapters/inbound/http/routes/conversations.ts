import { Type } from '@sinclair/typebox'
import { MessageSchema, ConversationSchema, IdParams, ChatMessageBody } from '#src/adapters/inbound/http/schemas.js'
import { createSseSink } from '#src/adapters/inbound/http/sse.js'
import type { App } from '#src/types.js'

export async function conversationsRoute(app: App) {
  app.addSchema(MessageSchema)
  app.addSchema(ConversationSchema)

  app.post('/conversations', {
    schema: {
      response: { 201: Type.Ref('Conversation') }
    }
  }, async (request, reply) => {
    const conv = app.conversationsUseCase.create()
    return reply.status(201).send(conv)
  })

  app.get('/conversations', {
    schema: {
      response: { 200: Type.Array(Type.Ref('Conversation')) }
    }
  }, async () => {
    return app.conversationsUseCase.listAll()
  })

  app.get('/conversations/:id', {
    schema: {
      params: IdParams,
      response: {
        200: Type.Object({
          id: Type.Integer(),
          title: Type.String(),
          createdAt: Type.String(),
          messages: Type.Array(Type.Ref('Message'))
        })
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: number }
    const conv = app.conversationsUseCase.getById(id)
    if (!conv) return reply.notFound(`Conversation ${id} introuvable`)
    return conv
  })

  app.delete('/conversations/:id', {
    schema: {
      params: IdParams
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: number }
    const deleted = app.conversationsUseCase.delete(id)
    if (!deleted) return reply.notFound(`Conversation ${id} introuvable`)
    return reply.status(204).send()
  })

  app.post('/conversations/:id/messages', {
    schema: {
      params: IdParams,
      body: ChatMessageBody
    }
  }, async (request, reply) => {
    const { id: convId } = request.params as { id: number }
    const { message } = request.body

    const conv = app.conversationsUseCase.getById(convId)
    if (!conv) return reply.notFound(`Conversation ${convId} introuvable`)

    const controller = new AbortController()
    const sink = createSseSink(reply)

    request.raw.once('close', () => {
      request.log.info('Client disconnected — aborting Ollama stream')
      controller.abort()
    })

    try {
      for await (const event of app.conversationsUseCase.sendMessage(convId, message, controller.signal)) {
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
