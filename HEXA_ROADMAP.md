# Hexagonal Architecture Refactoring Roadmap

## Current Architecture Assessment

| Concern | Where it lives | Problem |
|---|---|---|
| HTTP handling + SSE streaming | Route files | Mixed with business logic and infra calls |
| Ollama API calls (`fetch`) | Route files directly | Coupled to HTTP routes |
| SQLite CRUD | Routes via `app.stmts` (Fastify decoration) | No repository abstraction |
| Tool execution | `tools/registry.ts` | Mixes pure logic, I/O, and schema definitions |
| RAG chunking | `rag/chunker.ts` | Already pure domain logic — just misplaced |
| RAG embedding/indexing | `rag/indexer.ts` | I/O mixed with orchestration |
| RAG retrieval | `rag/retriever.ts` | Business logic mixed with DB + Ollama calls |
| SSE boilerplate | Duplicated in 4 route files | ~80 lines of duplicate `writeHead`/`sendEvent` per file |

## Key Tradeoffs

1. **SSE streaming**: Hexagonal architecture favors request→response DTOs. SSE requires a long-lived connection. Solution: use cases return `AsyncGenerator<Event>` and routes convert to wire format. The use case stays framework-agnostic.

2. **Agent loop**: Multi-turn tool-calling loop is a stateful workflow. Model it as a use case that takes a message + history and yields events via async generator.

3. **Tool registry**: Mixes pure functions with I/O. Keep at `src/tools/` for now.

4. **Database plugin**: The Fastify plugin stays but shrinks to just initializing SQLite and creating port implementations.

## Proposed File Structure

```
src/
  domain/
    ports/
      outbound/
        ConversationRepositoryPort.ts   # CRUD for conversations + messages
        ChunkRepositoryPort.ts          # CRUD for RAG chunks
        LlmPort.ts                      # Chat, streaming chat, embeddings
        EmbeddingServicePort.ts         # getEmbedding(text) → number[]
        DocumentIndexerPort.ts          # indexDocs() → IndexResult
    use-cases/
      ChatUseCase.ts                    # Direct chat + streaming chat
      AgentUseCase.ts                   # Tool-calling agent loop (streaming)
      ConversationsUseCase.ts           # CRUD + streaming conversation chat
      RagChatUseCase.ts                 # RAG-based streaming chat
      RagSearchUseCase.ts               # Semantic search
      RagReindexUseCase.ts              # Reindex documents
    models/
      Conversation.ts                   # Plain data objects
      Message.ts
      Chunk.ts
      chunker.ts                        # Already pure — move here
    schemas.ts                          # Cross-domain TypeBox schemas (shared types)
  adapters/
    inbound/
      http/
        routes/
          health.ts
          chat.ts
          conversations.ts
          agent.ts
          rag.ts
        sse.ts                          # SSE helpers (writeHead, sendEvent)
        app.ts                          # Fastify app builder
    outbound/
      ollama/
        OllamaAdapter.ts                # implements LlmPort, EmbeddingServicePort
      sqlite/
        SqliteConversationRepo.ts       # implements ConversationRepositoryPort
        SqliteChunkRepo.ts              # implements ChunkRepositoryPort
        SqliteDocumentIndexer.ts        # implements DocumentIndexerPort
  plugins/
    db.ts                               # Fastify plugin — initializes SQLite + repos
  tools/                                # Ambiguous — stays at root for now
    registry.ts
  server.ts                             # Entry point
```

## Step-by-Step Migration Plan

### Phase 1: Foundation (ports + SSE extraction)

| Step | What |
|---|---|
| 1.1 | Extract SSE helpers to `src/adapters/inbound/http/sse.ts` |
| 1.2 | Define outbound ports in `src/domain/ports/outbound/` |
| 1.3 | Move `rag/chunker.ts` → `src/domain/models/chunker.ts` |
| 1.4 | Move TypeBox schemas to `src/adapters/inbound/http/schemas.ts` |

### Phase 2: Outbound adapters

| Step | What |
|---|---|
| 2.1 | Create `OllamaAdapter` implementing `LlmPort` + `EmbeddingServicePort` |
| 2.2 | Create `SqliteConversationRepo` implementing `ConversationRepositoryPort` |
| 2.3 | Create `SqliteChunkRepo` implementing `ChunkRepositoryPort` |
| 2.4 | Create `SqliteDocumentIndexer` implementing `DocumentIndexerPort` |

### Phase 3: Use cases (application layer)

| Step | What |
|---|---|
| 3.1 | `ConversationsUseCase` — CRUD operations |
| 3.2 | `ChatUseCase` — sync chat + streaming chat |
| 3.3 | `AgentUseCase` — tool-calling agent loop |
| 3.4 | `RagSearchUseCase` — semantic search |
| 3.5 | `RagReindexUseCase` — document reindexing |
| 3.6 | `RagChatUseCase` — RAG streaming chat |

### Phase 4: Wire up (composition)

| Step | What |
|---|---|
| 4.1 | Update `plugins/db.ts` to instantiate repos/indexer |
| 4.2 | Update `app.ts` to create use cases and inject into routes |
| 4.3 | Rewrite each route to delegate to use cases |
| 4.4 | Remove `rag/indexer.ts` and `rag/retriever.ts` |

### Phase 5: Verify

| Step | What |
|---|---|
| 5.1 | Run `npm run typecheck` |
| 5.2 | Verify the app starts with `npm run dev` |

## What stays at `src/` root (ambiguous modules)

- **`tools/registry.ts`** — Mixes pure functions with I/O calls and TypeBox schemas.
- **`types.ts`** — Cross-cutting types used everywhere.
