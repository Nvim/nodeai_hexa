import type { LlmPort } from '#src/domain/ports/outbound/LlmPort.js'
import type { StreamEvent } from '#src/domain/models/Llm.js'
import type { RagSearchUseCase, RetrievedChunk } from '#src/domain/use-cases/RagUseCases.js'

const RAG_SYSTEM_PROMPT = `Tu es un assistant qui répond UNIQUEMENT à partir du contexte ci-dessous.
Si le contexte ne contient pas la réponse, réponds exactement : "Je ne trouve pas l'information dans mes documents."
Cite tes sources entre crochets, format [fichier.md§section].`

export interface RagSourcesEvent {
  type: 'sources'
  sources: Array<{ source: string; section: string; similarity: number }>
}

export type RagStreamEvent = StreamEvent | RagSourcesEvent

export class RagChatUseCase {
  constructor(
    private readonly llm: LlmPort,
    private readonly ragSearch: RagSearchUseCase
  ) {}

  async *chat(message: string, signal?: AbortSignal): AsyncGenerator<RagStreamEvent, void, undefined> {
    const chunks: RetrievedChunk[] = await this.ragSearch.search(message, 4)

    if (chunks.length === 0) {
      yield { type: 'token', value: "Je ne trouve pas l'information dans mes documents." }
      yield { type: 'done' }
      return
    }

    const contextBlock = chunks.map(c =>
      `[${c.source}§${c.section}]\n${c.content}`
    ).join('\n\n---\n\n')

    const systemMessage = `${RAG_SYSTEM_PROMPT}\n\nContexte :\n${contextBlock}`

    yield {
      type: 'sources',
      sources: chunks.map(c => ({
        source: c.source,
        section: c.section,
        similarity: Math.round(c.similarity * 1000) / 1000
      }))
    }

    const messages = [
      { role: 'system', content: systemMessage },
      { role: 'user', content: message }
    ]

    for await (const event of this.llm.chatStream(messages, { signal })) {
      yield event
    }
  }
}
