import { Type } from '@sinclair/typebox'

export const MessageSchema = Type.Object({
  id: Type.Integer(),
  conversationId: Type.Integer(),
  role: Type.String(),
  content: Type.String(),
  createdAt: Type.String()
}, { $id: 'Message' })

export const ConversationSchema = Type.Object({
  id: Type.Integer(),
  title: Type.String(),
  createdAt: Type.String(),
  messageCount: Type.Integer()
}, { $id: 'Conversation' })

export const IdParams = Type.Object({ id: Type.Integer() })

export const ChatMessageBody = Type.Object({
  message: Type.String({ minLength: 1, maxLength: 4096 })
}, { additionalProperties: false })

export const RagSearchBody = Type.Object({
  query: Type.String({ minLength: 1 }),
  k: Type.Number({ minimum: 1, maximum: 10 })
}, { additionalProperties: false })

export const HealthResponse = Type.Object({ status: Type.String() })
