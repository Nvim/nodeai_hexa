import type { ConversationRepositoryPort } from '#src/domain/ports/outbound/ConversationRepositoryPort.js'
import type { LlmPort } from '#src/domain/ports/outbound/LlmPort.js'
import type {
  ConversationModel,
  ConversationListItem,
  ConversationWithMessages,
  MessageModel,
} from '#src/domain/models/Conversation.js'
import type { StreamEvent } from '#src/domain/models/Llm.js'

export class ConversationsUseCase {
  constructor(
    private readonly repo: ConversationRepositoryPort,
    private readonly llm: LlmPort
  ) {}

  create(): ConversationModel {
    return this.repo.create('Nouvelle conversation')
  }

  listAll(): ConversationListItem[] {
    return this.repo.listAll()
  }

  getById(id: number): ConversationWithMessages | undefined {
    return this.repo.findById(id)
  }

  delete(id: number): boolean {
    return this.repo.delete(id)
  }

  async *sendMessage(
    conversationId: number,
    message: string,
    signal?: AbortSignal
  ): AsyncGenerator<StreamEvent, void, undefined> {
    const conv = this.repo.findById(conversationId)
    if (!conv) throw Object.assign(new Error(`Conversation ${conversationId} introuvable`), { statusCode: 404 })

    const messages = this.repo.getMessages(conversationId)
    if (messages.length === 0) {
      this.repo.updateTitle(conversationId, message.slice(0, 60))
    }

    this.repo.addMessage(conversationId, 'user', message)

    const updatedMessages = this.repo.getMessages(conversationId)
    const ollamaMessages: Array<{ role: string; content: string }> = updatedMessages.map((m: MessageModel) => ({
      role: m.role,
      content: m.content
    }))

    let fullResponse = ''

    for await (const event of this.llm.chatStream(ollamaMessages, { signal })) {
      if (event.type === 'token') {
        fullResponse += event.value
      }
      if (event.type === 'done') {
        this.repo.addMessage(conversationId, 'assistant', fullResponse)
      }
      yield event
    }
  }
}
