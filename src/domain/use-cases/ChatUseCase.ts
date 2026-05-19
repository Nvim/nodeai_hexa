import type { LlmPort } from '#src/domain/ports/outbound/LlmPort.js'
import type { StreamEvent } from '#src/domain/models/Llm.js'

export class ChatUseCase {
  constructor(private readonly llm: LlmPort) {}

  async chat(message: string): Promise<string> {
    return this.llm.chatSync([
      { role: 'user', content: message }
    ])
  }

  async *chatStream(message: string, signal?: AbortSignal): AsyncGenerator<StreamEvent, void, undefined> {
    for await (const event of this.llm.chatStream(
      [{ role: 'user', content: message }],
      { signal }
    )) {
      yield event
    }
  }
}
