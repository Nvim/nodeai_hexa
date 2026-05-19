import { Type } from '@sinclair/typebox'
import type { App } from '../types.js'
import { toolDefinitions, executeTool } from '../tools/registry.js'

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434'
const MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2'
const MAX_ITERATIONS = 5

const agentBodySchema = Type.Object({
  message: Type.String({ minLength: 1, maxLength: 4096 })
}, { additionalProperties: false })

interface OllamaToolCall {
  function: {
    name: string
    arguments: Record<string, unknown>
  }
}

function makeAbortOnDisconnect(request: import('fastify').FastifyRequest) {
  const controller = new AbortController()
  const onClose = () => controller.abort()
  request.socket.once('close', onClose)
  const cleanup = () => request.socket.removeListener('close', onClose)
  return { controller, cleanup }
}

export async function agentRoute(app: App) {
  app.post('/chat/agent', {
    schema: { body: agentBodySchema }
  }, async (request, reply) => {
    const { message } = request.body

    const messages: Array<{ role: string; content: string; tool_calls?: OllamaToolCall[] }> = [
      { role: 'user', content: message }
    ]

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    })

    const sendEvent = (payload: object) => reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`)
    const { controller, cleanup } = makeAbortOnDisconnect(request)

    try {
      for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        const res = await fetch(`${OLLAMA_URL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            model: MODEL,
            messages,
            tools: toolDefinitions,
            stream: true
          })
        })

        if (!res.ok) {
          const text = await res.text()
          request.log.error({ status: res.status, body: text }, 'Ollama error')
          sendEvent({ type: 'error', message: 'Ollama request failed' })
          break
        }

        let assistantContent = ''
        const toolCalls: OllamaToolCall[] = []

        for await (const chunk of res.body!) {
          const lines = Buffer.from(chunk as Uint8Array).toString('utf8').split('\n').filter(Boolean)
          for (const line of lines) {
            const parsed = JSON.parse(line) as { message?: { content?: string; tool_calls?: OllamaToolCall[] }; done?: boolean }

            if (parsed.message?.content) {
              assistantContent += parsed.message.content
              sendEvent({ type: 'token', value: parsed.message.content })
            }

            if (parsed.message?.tool_calls?.length) {
              toolCalls.push(...parsed.message.tool_calls)
            }
          }
        }

        messages.push({
          role: 'assistant',
          content: assistantContent,
          ...(toolCalls.length ? { tool_calls: toolCalls } : {})
        })

        if (!toolCalls.length) {
          sendEvent({ type: 'done' })
          break
        }

        for (const tc of toolCalls) {
          const name = tc.function.name
          const args = tc.function.arguments

          request.log.info({ name, args }, 'Tool call')
          sendEvent({ type: 'tool_call', name, args })

          let result: string
          try {
            result = await executeTool(name, args)
          } catch (err) {
            result = `Erreur: ${(err as Error).message}`
            request.log.warn({ name, err: (err as Error).message }, 'Tool error')
          }

          request.log.info({ name, result }, 'Tool result')
          sendEvent({ type: 'tool_result', name, result })

          messages.push({ role: 'tool', content: String(result) })
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        request.log.error(err, 'Agent error')
        sendEvent({ type: 'error', message: (err as Error).message })
      }
    } finally {
      cleanup()
      reply.raw.end()
    }
  })
}