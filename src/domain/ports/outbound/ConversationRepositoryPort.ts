import type {
  ConversationModel,
  ConversationListItem,
  ConversationWithMessages,
  MessageModel,
} from '#src/domain/models/Conversation.js'

export interface ConversationRepositoryPort {
  create(title: string): ConversationModel
  listAll(): ConversationListItem[]
  findById(id: number): ConversationWithMessages | undefined
  delete(id: number): boolean
  addMessage(conversationId: number, role: string, content: string): MessageModel
  getMessages(conversationId: number): MessageModel[]
  updateTitle(id: number, title: string): void
}
