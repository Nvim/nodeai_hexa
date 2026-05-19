import type { FastifyReply } from 'fastify'

export interface SseSink {
  sendEvent(payload: object): void
  end(): void
}

export function createSseSink(reply: FastifyReply): SseSink {
  reply.hijack()
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  })

  return {
    sendEvent(payload: object) {
      reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`)
    },
    end() {
      reply.raw.end()
    }
  }
}

export interface SseEvent {
  type: string
  [key: string]: unknown
}

export type StreamResult<S> = AsyncGenerator<S, void, undefined>
