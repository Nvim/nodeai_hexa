import { Type } from '@sinclair/typebox'
import type { App } from '../types.js'

export async function healthRoute(app: App) {
  app.get('/health', {
    schema: {
      response: {
        200: Type.Object({ status: Type.String() })
      }
    }
  }, async () => {
    return { status: 'ok' }
  })
}