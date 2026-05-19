export interface ConversationModel {
  id: number
  title: string
  createdAt: string
}

export interface MessageModel {
  id: number
  conversationId: number
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
}

export interface ConversationWithMessages extends ConversationModel {
  messages: MessageModel[]
}

export interface ConversationListItem extends ConversationModel {
  messageCount: number
}
