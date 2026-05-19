import Fastify from 'fastify'
import sensible from '@fastify/sensible'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { healthRoute } from './routes/health.js'
import { chatRoute } from './routes/chat.js'
import { conversationsRoute } from './routes/conversations.js'
import { agentRoute } from './routes/agent.js'
import { ragRoute } from './routes/rag.js'
import dbPlugin from './plugins/db.js'

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

  await app.register(healthRoute)
  await app.register(chatRoute)
  await app.register(conversationsRoute)
  await app.register(agentRoute)
  await app.register(ragRoute)

  return app
}