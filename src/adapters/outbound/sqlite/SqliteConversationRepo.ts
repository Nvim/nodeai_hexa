import type Database from 'better-sqlite3'
import type { ConversationRepositoryPort } from '#src/domain/ports/outbound/ConversationRepositoryPort.js'
import type {
  ConversationModel,
  ConversationListItem,
  ConversationWithMessages,
  MessageModel,
} from '#src/domain/models/Conversation.js'

export class SqliteConversationRepo implements ConversationRepositoryPort {
  private readonly createConv: Database.Statement
  private readonly listConvs: Database.Statement
  private readonly getConv: Database.Statement
  private readonly deleteConv: Database.Statement
  private readonly getMessagesStmt: Database.Statement
  private readonly addMsg: Database.Statement
  private readonly updateTitleStmt: Database.Statement

  constructor(private readonly db: Database.Database) {
    this.createConv = db.prepare('INSERT INTO conversations (title) VALUES (?) RETURNING *')
    this.listConvs = db.prepare(`
      SELECT c.id, c.title, c.createdAt,
             COUNT(m.id) AS messageCount
      FROM conversations c
      LEFT JOIN messages m ON m.conversationId = c.id
      GROUP BY c.id ORDER BY c.createdAt DESC
    `)
    this.getConv = db.prepare('SELECT * FROM conversations WHERE id = ?')
    this.deleteConv = db.prepare('DELETE FROM conversations WHERE id = ?')
    this.getMessagesStmt = db.prepare('SELECT * FROM messages WHERE conversationId = ? ORDER BY id')
    this.addMsg = db.prepare('INSERT INTO messages (conversationId, role, content) VALUES (?, ?, ?) RETURNING *')
    this.updateTitleStmt = db.prepare('UPDATE conversations SET title = ? WHERE id = ?')
  }

  create(title: string): ConversationModel {
    return this.createConv.get(title) as ConversationModel
  }

  listAll(): ConversationListItem[] {
    return this.listConvs.all() as ConversationListItem[]
  }

  findById(id: number): ConversationWithMessages | undefined {
    const conv = this.getConv.get(id) as ConversationModel | undefined
    if (!conv) return undefined
    const messages = this.getMessagesStmt.all(id) as MessageModel[]
    return { ...conv, messages }
  }

  delete(id: number): boolean {
    const result = this.deleteConv.run(id) as { changes: number }
    return result.changes > 0
  }

  addMessage(conversationId: number, role: string, content: string): MessageModel {
    return this.addMsg.get(conversationId, role, content) as MessageModel
  }

  getMessages(conversationId: number): MessageModel[] {
    return this.getMessagesStmt.all(conversationId) as MessageModel[]
  }

  updateTitle(id: number, title: string): void {
    this.updateTitleStmt.run(title, id)
  }
}
