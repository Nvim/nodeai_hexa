import { HealthResponse } from '#src/adapters/inbound/http/schemas.js'
import type { App } from '#src/types.js'

export async function healthRoute(app: App) {
  app.get('/health', {
    schema: {
      response: {
        200: HealthResponse
      }
    }
  }, async () => {
    return { status: 'ok' }
  })
}
