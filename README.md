# NodeAI

This is a Node.js backend application that provides an API for interacting with
an AI agent backed by a local Ollama server.

## Tech Stack

- **Fastify** API
- **Sqlite3** database for conversation history
- **Ollama** for the local LLM backing the agent
- **Typebox** for schema definition and validation
- **Typescirpt** with strict validation for all files

## Project structure

The Fastify app is decorated with a custom database plugin defined in
`src/plugins/db.ts`. It includes prepared queries for CRUD operations on the
conversation history database.

Typebox is heavily used to define all data types, API requests and response
schemas and validate them. Fastify already provides built-in types, and we
enhance them with our own in `src/types.ts` for common global types.

Individual source files also have their own local type definitions at the top
when necessary.

The `src/routes` directory contains all the public API endpoints

- `agent.ts`: chat with the agent with access to all tools
- `chat.ts`: chat with the raw Ollama model (synchronous and SSE stream mode)
- `conversation.ts`: CRUD operations on conversations with the agent
- `rag.ts`: re-index and search the RAG database, and chat with an agent that can perform RAG searches

## Agent tools

The agent has access to the following tools

- get_weather: Use a public API to get the current weather
- calculator: Evaluate a simple mathematical expression
- get_datetime: Return current date and time
- read_local_file: Read the contents of a file in the `docs` directory of the project
