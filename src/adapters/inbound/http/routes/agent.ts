import { ChatMessageBody } from '#src/adapters/inbound/http/schemas.js'
import { createSseSink } from '#src/adapters/inbound/http/sse.js'
import type { App } from '#src/types.js'

export async function agentRoute(app: App) {
  app.post('/chat/agent', {
    schema: { body: ChatMessageBody }
  }, async (request, reply) => {
    const { message } = request.body

    const controller = new AbortController()
    const sink = createSseSink(reply)

    request.socket.once('close', () => controller.abort())

    try {
      for await (const event of app.agentUseCase.run(message, controller.signal)) {
        sink.sendEvent(event)
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        request.log.error(err, 'Agent error')
        sink.sendEvent({ type: 'error', message: (err as Error).message })
      }
    } finally {
      sink.end()
    }
  })
}
