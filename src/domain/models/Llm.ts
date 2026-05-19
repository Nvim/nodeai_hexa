export interface ChatStreamEvent {
  type: 'token'
  value: string
}

export interface DoneEvent {
  type: 'done'
}

export interface ErrorEvent {
  type: 'error'
  message: string
}

export type StreamEvent = ChatStreamEvent | DoneEvent | ErrorEvent

export interface LlmChatRequest {
  messages: Array<{ role: string; content: string }>
  tools?: Array<Record<string, unknown>>
  signal?: AbortSignal
}
