# PetClinic Chatbot (Spring AI)

A teaching module that builds a **triage assistant** with [Spring AI](https://docs.spring.io/spring-ai/reference/).

## What

A Spring AI triage assistant for the PetClinic. The flow:

1. An owner describes a pet symptom in natural language ("my dog Leo is limping…").
2. **RAG** over a small specialty knowledge base finds the right vet **specialty** (e.g. orthopedics, dentistry, dermatology).
3. The assistant **books a visit** by calling the PetClinic backend's **MCP server** (remote tools) for that specialty.
4. It **confirms** the booking back to the owner.

Responses are **streamed** to the browser as markdown. Uses **OpenAI only** — for both chat completions and embeddings.

## Run

1. **Start pgvector** — from this folder:
   ```sh
   docker compose up -d
   ```
   Brings up Postgres + pgvector on **:5433** (separate from the app DB).
2. **Start the PetClinic DB + backend** — from the repo root:
   ```sh
   ./start-database.sh    # embedded Postgres on :5432
   ./start-backend.sh     # Spring Boot on :8080, exposes the MCP server
   ```
3. **Start the chatbot** — from the repo root, with your OpenAI key:
   ```sh
   OPENAI_API_KEY=sk-… mvn -f petclinic-chatbot/pom.xml spring-boot:run
   ```
   App starts on **:8082**.
4. **Try it** — open <http://localhost:8082> and click an example prompt, or curl the streaming endpoint directly:
   ```sh
   curl "http://localhost:8082/george/assistant?q=My%20dog%20is%20limping"
   ```

## Architecture

- **`ChatClient`** — the fluent entry point; assembles the prompt and streams the reply.
- **`PromptChatMemoryAdvisor`** — per-user conversation memory (the path segment `/{user}/…` is the conversation id), so follow-ups like "yes, book it" keep context.
- **`QuestionAnswerAdvisor`** — RAG over `specialty-knowledge.txt`, embedded into **pgvector**, to map symptoms → specialty.
- **Remote MCP tools** via **`SyncMcpToolCallbackProvider`** — `list_visits`, `create_visit`, `cancel_visit` are exposed by the PetClinic backend's MCP server and called as tools.
- **MCP elicitation** — `create_visit` elicits a missing field (phone number); the client **auto-accepts** a demo phone for a frictionless demo.

## Curriculum map

Features mapped to sections of [`../curriculum-spring-ai-1zi.md`](../curriculum-spring-ai-1zi.md):

| Feature | Curriculum |
|---|---|
| ChatClient | §1.1 |
| Structured output | §1.3 |
| Advisors API | §1.4 |
| Chat Memory | §1.5 |
| Tool calling / MCP | §1.6 + Lab 4 |
| RAG (QuestionAnswerAdvisor + pgvector) | §1.8 |
| Streaming responses | Streaming |
| MCP security / elicitation | Lab 4d |

## Future (not built yet)

- **LangChain4j alternative** — the same assistant as a declarative `AiServices` interface, plus input/output **guardrails** with a reprompt loop (§4).
- **Embabel multi-step agentic workflow** — triage → specialty → book modelled as planned `@Action`s.
- **Firefighter agent + LangGraph guardrails** — deferred.

## Security note

The MCP bearer token is a **demo JWT** for George Franklin (`sub=1`). The backend only **base64-parses the `sub` claim** — there is no signature verification. This is **NOT production authentication**; it exists purely to wire the demo end to end.
