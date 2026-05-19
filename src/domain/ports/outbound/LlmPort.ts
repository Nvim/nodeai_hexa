import type { StreamEvent } from '#src/domain/models/Llm.js'

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface LlmPort {
  chatSync(
    messages: Array<{ role: string; content: string }>,
    options?: { signal?: AbortSignal; tools?: ToolDefinition[] }
  ): Promise<string>

  chatStream(
    messages: Array<{ role: string; content: string }>,
    options?: {
      signal?: AbortSignal
      tools?: ToolDefinition[]
      onToolCalls?: (toolCalls: Array<{ function: { name: string; arguments: Record<string, unknown> } }>) => void
    }
  ): AsyncGenerator<StreamEvent, void, undefined>
}
