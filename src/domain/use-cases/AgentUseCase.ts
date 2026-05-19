import type { LlmPort, ToolDefinition } from '#src/domain/ports/outbound/LlmPort.js'
import type { StreamEvent } from '#src/domain/models/Llm.js'
import { toolDefinitions, executeTool } from '#src/tools/registry.js'

const MAX_ITERATIONS = 5

export interface AgentToolCallEvent {
  type: 'tool_call'
  name: string
  args: Record<string, unknown>
}

export interface AgentToolResultEvent {
  type: 'tool_result'
  name: string
  result: string
}

export type AgentEvent = StreamEvent | AgentToolCallEvent | AgentToolResultEvent

interface OllamaToolCall {
  function: {
    name: string
    arguments: Record<string, unknown>
  }
}

export class AgentUseCase {
  constructor(private readonly llm: LlmPort) {}

  async *run(message: string, signal?: AbortSignal): AsyncGenerator<AgentEvent, void, undefined> {
    const messages: Array<{ role: string; content: string; tool_calls?: OllamaToolCall[] }> = [
      { role: 'user', content: message }
    ]

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      let assistantContent = ''
      const toolCalls: OllamaToolCall[] = []

      const onToolCalls = (tc: OllamaToolCall[]) => {
        toolCalls.push(...tc)
      }

      try {
        for await (const event of this.llm.chatStream(messages, {
          signal,
          tools: toolDefinitions as ToolDefinition[],
          onToolCalls
        })) {
          if (event.type === 'token') {
            assistantContent += event.value
            yield event
          }
          if (event.type === 'done') {
            // done will be yielded after tool processing
          }
          if (event.type === 'error') {
            yield event
            return
          }
        }
      } catch (err) {
        yield { type: 'error', message: (err as Error).message }
        return
      }

      messages.push({
        role: 'assistant',
        content: assistantContent,
        ...(toolCalls.length ? { tool_calls: toolCalls } : {})
      })

      if (!toolCalls.length) {
        yield { type: 'done' }
        return
      }

      for (const tc of toolCalls) {
        const name = tc.function.name
        const args = tc.function.arguments

        yield { type: 'tool_call', name, args }

        let result: string
        try {
          result = await executeTool(name, args)
        } catch (err) {
          result = `Erreur: ${(err as Error).message}`
        }

        yield { type: 'tool_result', name, result }
        messages.push({ role: 'tool', content: String(result) })
      }
    }

    yield { type: 'done' }
  }
}
