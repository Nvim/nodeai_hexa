import type { LlmPort, ToolDefinition } from '#src/domain/ports/outbound/LlmPort.js'
import type { EmbeddingServicePort } from '#src/domain/ports/outbound/EmbeddingServicePort.js'
import type { StreamEvent } from '#src/domain/models/Llm.js'

interface OllamaOptions {
  baseUrl: string
  model: string
  embedModel: string
}

interface OllamaToolCall {
  function: {
    name: string
    arguments: Record<string, unknown>
  }
}

export class OllamaAdapter implements LlmPort, EmbeddingServicePort {
  private readonly baseUrl: string
  private readonly model: string
  private readonly embedModel: string

  constructor(opts: Partial<OllamaOptions> = {}) {
    this.baseUrl = opts.baseUrl ?? process.env.OLLAMA_URL ?? 'http://localhost:11434'
    this.model = opts.model ?? process.env.OLLAMA_MODEL ?? 'llama3.2'
    this.embedModel = opts.embedModel ?? process.env.EMBED_MODEL ?? 'nomic-embed-text'
  }

  async chatSync(
    messages: Array<{ role: string; content: string }>,
    options?: { signal?: AbortSignal; tools?: ToolDefinition[] }
  ): Promise<string> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      stream: false
    }

    if (options?.tools?.length) {
      body.tools = options.tools
    }

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: options?.signal
    })

    if (!res.ok) {
      throw new Error(`Ollama request failed: ${res.status}`)
    }

    const data = await res.json() as { message: { content: string } }
    return data.message.content
  }

  async *chatStream(
    messages: Array<{ role: string; content: string }>,
    options?: {
      signal?: AbortSignal
      tools?: ToolDefinition[]
      onToolCalls?: (toolCalls: OllamaToolCall[]) => void
    }
  ): AsyncGenerator<StreamEvent, void, undefined> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      stream: true
    }

    if (options?.tools?.length) {
      body.tools = options.tools
    }

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: options?.signal
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Ollama request failed: ${res.status} — ${text}`)
    }

    if (!res.body) {
      throw new Error('Ollama returned empty body')
    }

    for await (const chunk of res.body) {
      const lines = new TextDecoder().decode(chunk as Uint8Array).split('\n').filter(Boolean)
      for (const line of lines) {
        const parsed = JSON.parse(line) as {
          message?: { content?: string; tool_calls?: OllamaToolCall[] }
          done?: boolean
        }

        if (parsed.message?.content) {
          yield { type: 'token', value: parsed.message.content }
        }

        if (parsed.message?.tool_calls?.length && options?.onToolCalls) {
          options.onToolCalls(parsed.message.tool_calls)
        }

        if (parsed.done) {
          yield { type: 'done' }
        }
      }
    }
  }

  async getEmbedding(text: string): Promise<number[]> {
    const res = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.embedModel, prompt: text })
    })

    if (!res.ok) {
      throw new Error(`Ollama embeddings error: ${res.status}`)
    }

    const data = await res.json() as { embedding: number[] }
    return data.embedding
  }
}
