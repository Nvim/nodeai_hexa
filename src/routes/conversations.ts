import { Type } from '@sinclair/typebox'
import type { App, ConversationRow, MessageRow } from '../types.js'

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434'
const MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2'

const MessageSchema = Type.Object({
  id: Type.Integer(),
  conversationId: Type.Integer(),
  role: Type.String(),
  content: Type.String(),
  createdAt: Type.String()
}, { $id: 'Message' })

const ConversationSchema = Type.Object({
  id: Type.Integer(),
  title: Type.String(),
  createdAt: Type.String(),
  messageCount: Type.Integer()
}, { $id: 'Conversation' })

const IdParams = Type.Object({ id: Type.Integer() })

export async function conversationsRoute(app: App) {
  app.addSchema(MessageSchema)
  app.addSchema(ConversationSchema)

  app.post('/conversations', {
    schema: {
      response: { 201: Type.Ref('Conversation') }
    }
  }, async (request, reply) => {
    const conv = app.stmts.createConv.get('Nouvelle conversation') as ConversationRow
    return reply.status(201).send(conv)
  })

  app.get('/conversations', {
    schema: {
      response: { 200: Type.Array(Type.Ref('Conversation')) }
    }
  }, async () => {
    return app.stmts.listConvs.all() as ConversationRow[]
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
    const conv = app.stmts.getConv.get(id) as ConversationRow | undefined
    if (!conv) return reply.notFound(`Conversation ${id} introuvable`)
    const messages = app.stmts.getMessages.all(conv.id) as MessageRow[]
    return { ...conv, messages }
  })

  app.delete('/conversations/:id', {
    schema: {
      params: IdParams
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: number }
    const result = app.stmts.deleteConv.run(id) as { changes: number }
    if (result.changes === 0) return reply.notFound(`Conversation ${id} introuvable`)
    return reply.status(204).send()
  })

  app.post('/conversations/:id/messages', {
    schema: {
      params: IdParams,
      body: Type.Object({
        message: Type.String({ minLength: 1, maxLength: 4096 })
      }, { additionalProperties: false })
    }
  }, async (request, reply) => {
    const { id: convId } = request.params as { id: number }
    const conv = app.stmts.getConv.get(convId) as ConversationRow | undefined
    if (!conv) return reply.notFound(`Conversation ${convId} introuvable`)

    const { message } = request.body as { message: string }

    const history = app.stmts.getMessages.all(convId) as MessageRow[]
    if (history.length === 0) {
      app.db.prepare('UPDATE conversations SET title = ? WHERE id = ?')
        .run(message.slice(0, 60), convId)
    }

    app.stmts.addMessage.get(convId, 'user', message)

    const updatedHistory = app.stmts.getMessages.all(convId) as MessageRow[]
    const ollamaMessages = updatedHistory.map(m => ({ role: m.role, content: m.content }))

    const controller = new AbortController()
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ model: MODEL, messages: ollamaMessages, stream: true })
    })

    if (!res.ok) {
      const text = await res.text()
      request.log.error({ status: res.status, body: text }, 'Ollama error')
      return reply.status(502).send({ error: 'Ollama request failed' })
    }

    request.raw.once('close', () => controller.abort())

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    })

    const sendEvent = (payload: object) => reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`)

    let fullResponse = ''
    try {
      for await (const chunk of res.body!) {
        const lines = Buffer.from(chunk as Uint8Array).toString('utf8').split('\n').filter(Boolean)
        for (const line of lines) {
          const parsed = JSON.parse(line) as { message?: { content?: string }; done?: boolean }
          if (parsed.message?.content) {
            fullResponse += parsed.message.content
            sendEvent({ type: 'token', value: parsed.message.content })
          }
          if (parsed.done) {
            app.stmts.addMessage.get(convId, 'assistant', fullResponse)
            sendEvent({ type: 'done' })
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        request.log.error(err, 'Streaming error')
        sendEvent({ type: 'error', message: (err as Error).message })
      }
    } finally {
      reply.raw.end()
    }
  })
}