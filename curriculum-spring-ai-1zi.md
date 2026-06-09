# Curs Spring AI — 1 zi (curriculum pentru trainer)

> Stadiul informației: **9 iunie 2026**. Sursele complete sunt la final.
> Conceput pentru un curs interactiv, hands-on, livrat de un trainer profesionist.

---

## 0. Starea curentă a Spring AI (de spus în primele 5 minute)

Acesta e mesajul cu care deschizi cursul — pune tot restul în context și e exact zona unde cursanții au informații greșite de pe blogurile de hype.

| Linie | Versiune | Status | Bază |
|---|---|---|---|
| 1.0.x | 1.0.8 | GA, stabil | Spring Boot 3.x |
| **1.1.x** | **1.1.7** | **GA, stabil — recomandat pentru producție azi** | Spring Boot 3.x |
| 2.0.x | **2.0.0-RC1** (6 iun 2026) | Release Candidate, drum spre GA | Spring Boot 4.0 / Spring Framework 7.0 / Java 21 |

**Capcana de hype de demontat:** mai multe bloguri (byteiota, HeroDevs) au anunțat agresiv "Spring AI 2.0 GA pe 28 mai 2026". GA-ul a alunecat — pe 6 iunie proiectul era încă la RC1. Lecția pentru cursanți: pentru producție, azi mergi pe **1.1.x**; **2.0 e pentru greenfield / cei deja pe Boot 4**.

**Ce aduce 2.0 (de prezentat ca "viitorul imediat"):**
- Migrare obligatorie la **Spring Boot 4.0 + Spring Framework 7.0 + Java 21 + Jakarta EE 11**.
- **Jackson 2 → Jackson 3** (`com.fasterxml.jackson` → `tools.jackson`) — capcană: serializarea datelor și ordinea proprietăților se schimbă silentios.
- **JSpecify null-safety** enforced la compile-time (NullAway) → tipuri nullable/non-nullable reale în Kotlin.
- **MCP mutat în core** (din modulul community în `org.springframework.ai.mcp.annotation`).
- **Tool calling overhaul** (vezi mai jos).

---

## 1. Ce TREBUIE să includă (fundamentele "obligatorii")

Acesta e nucleul fără de care nu poți numi cursul "Spring AI". Le predai în ordinea logică de mai jos pentru că fiecare se construiește pe cel anterior.

1. **`ChatModel` vs `ChatClient`**
   - `ChatModel` = abstracția portabilă peste furnizori (OpenAI, Anthropic, Ollama, Gemini/Google GenAI, Bedrock, Mistral, DeepSeek…). Schimbarea furnizorului = schimbare de config, nu de cod.
   - `ChatClient` = API fluent (în stilul `WebClient`/`RestClient`): `.prompt().user(...).call().content()`.
   - **Punct de predat:** portabilitatea e argumentul de vânzare față de Python; arată cum swap-ezi OpenAI → Ollama local doar din `application.properties`.

2. **Prompturi & Mesaje**
   - `SystemMessage`, `UserMessage`, `AssistantMessage`, `ToolResponseMessage`.
   - `PromptTemplate` cu placeholder-e (StringTemplate engine).

3. **Structured Output** (unul dintre cele mai puternice features)
   - `.entity(MyRecord.class)` → mapează direct răspunsul pe un Java record.
   - `BeanOutputConverter` generează JSON Schema (DRAFT_2020_12) din clasa Java.
   - **Native structured output**: schema e trimisă direct la API-ul modelului → fiabilitate mai mare, prompturi mai curate, fără instrucțiuni de format în prompt.
   - În RC1: `EntityParamSpec` permite configurarea structured-output per-apel pe `.entity()`.

4. **Advisors API** (conceptul-cheie de arhitectură)
   - Lanț de tip middleware care interceptează/îmbogățește request & response.
   - Built-in: `SimpleLoggerAdvisor`, `MessageChatMemoryAdvisor`, `QuestionAnswerAdvisor` (RAG).
   - **Punct de predat:** ordinea advisorilor contează; arată cum se compun.

5. **Chat Memory**
   - API-ul modelului e stateless → istoricul trebuie trimis la fiecare request.
   - `MessageWindowChatMemory` + repository-uri (`JdbcChatMemoryRepository`, Cassandra, Neo4j…).
   - În 2.0: conversation ID acum **obligatoriu explicit** (capcană de migrare din 1.x).

6. **Tool Calling (function calling)**
   - Modelul cere apelarea unei metode Java; framework-ul o execută și trimite rezultatul înapoi.
   - **⚠️ Overhaul în 2.0-RC1 (de avertizat neapărat):**
     - Execuția tool-urilor scoasă din fiecare `ChatModel`; se face acum **extern** via `ChatClient` + `ToolCallingAdvisor` (fost `ToolCallAdvisor`).
     - `internalToolExecutionEnabled` — **eliminat**.
     - `toolNames()` și `SpringBeanToolCallbackResolver` — **eliminate**; tool-urile se înregistrează ca `ToolCallback` beans și se pasează explicit prin `.tools(...)`.
     - **Nou:** `ToolSearchToolCallingAdvisor` cu `ToolIndex` (vector store / Lucene / regex) → descoperire de tool-uri "on-demand" (nu mai încarci toate definițiile în context). Aici e puntea spre agentic.

7. **Embeddings & Vector Stores**
   - `EmbeddingModel` + `VectorStore` (PGVector, Redis, Chroma, Qdrant, Mongo Atlas…).
   - Similarity search cu filtrare SQL-like; `SimpleVectorStore` in-memory pentru demo.

8. **RAG**
   - **Simplu:** `QuestionAnswerAdvisor` — injectează contextul în prompt dintr-un `VectorStore`.
   - **Modular RAG** (experimental, dar important): `RetrievalAugmentationAdvisor` cu `queryTransformers` (ex. `RewriteQueryTransformer`), `DocumentRetriever` (`VectorStoreDocumentRetriever` cu `similarityThreshold`), `DocumentPostProcessor`. Inspirat de paper-ul "Modular RAG: LEGO-like Reconfigurable Frameworks".
   - **ETL pipeline:** `DocumentReader` → `DocumentTransformer` (splitter/chunking) → `DocumentWriter`.

9. **Observability**
   - Integrare Micrometer (spans pentru ChatClient + tool calls). În RC1 s-au reparat ierarhiile de span pe streaming.

---

## 2. Agendă propusă (1 zi, ~6.5h efectiv)

| Ora | Modul | Format |
|---|---|---|
| 09:00–09:30 | Intro + starea ecosistemului (vezi §0) + setup Initializr | Demo |
| 09:30–10:30 | ChatClient, prompturi, structured output | Demo + Lab 1 |
| 10:30–10:45 | Pauză | |
| 10:45–12:00 | Advisors + Memory + Tool Calling (cu overhaul 2.0) | Demo + Lab 2 |
| 12:00–13:00 | Prânz | |
| 13:00–14:15 | RAG: simplu → modular + ETL + vector store | Demo + Lab 3 |
| 14:15–15:15 | **MCP**: server cu `@McpTool` + `@McpResource` + transport + securitate | Demo + Lab 4 |
| 15:15–15:30 | Pauză | |
| 15:30–16:15 | Evaluare / **LLM-as-judge** + agentic patterns | Demo + Lab 5 |
| 16:15–16:45 | Spring AI vs LangChain4j (ce face LC4j în plus) | Discuție live |
| 16:45–17:00 | Q&A, recap, "ce duci în producție luni" | |

> Stil recomandat (în linia ta): fiecare modul = demo scurt → lab pe cont propriu → un mini-concurs (cine face tool-ul cel mai util / cel mai bun prompt de judge). Feedback live.

---

## 3. Laboratoarele practice (exact ce voiai)

### Lab 4 — MCP Server (vârful de lance al părții practice)

Spring AI 2.0 a adus **anotări native** (din 2.0-M6, acum în core). Înlocuiesc complet vechiul ritual ToolCallback (descriptori manuali, înregistrare, schema JSON de mână).

**4a — MCP Tool**
```java
@Component
public class CalculatorTools {
    @McpTool(name = "add", description = "Add two numbers together")
    public int add(
        @McpToolParam(description = "First number", required = true) int a,
        @McpToolParam(description = "Second number", required = true) int b) {
        return a + b;
    }
}
```
Spring AI generează automat JSON Schema din parametri; auto-config înregistrează bean-ul la startup.

**4b — MCP Resource** (prin URI template)
```java
@McpResource(uri = "document://{id}", name = "Document",
             description = "Access stored documents")
public ReadResourceResult getDocument(String id, McpMeta meta) {
    // poți citi access level din meta pentru permisiuni
    ...
}
```

**4c — MCP Prompt / Complete** (extensie naturală)
```java
@McpPrompt(...)   // generează mesaje de prompt
@McpComplete(...) // auto-completare pentru argumente de prompt
```

**Puncte de predat:**
- Transporturi: **STDIO** (tool local, single-process, ex. wire în Claude Code) · **SSE** (backward-compat) · **Streamable HTTP** (default modern, producție/remote agents).
- Async: toate anotările suportă `Mono<...>` cu Reactor + `McpProgressToken` pentru progres.
- Context: `McpSyncRequestContext` / `McpAsyncRequestContext` (stateful) vs `McpTransportContext` (stateless).

**4d — Securitate MCP** (diferențiatorul "enterprise" — clienții tăi de bancă îl vor cere)
- MCP server = **OAuth2 Resource Server**; tokenul vine de la un Authorization Server extern.
- `McpServerOAuth2Configurer.mcpServerOAuth2()` + `spring.security.oauth2.resourceserver.jwt.issuer-uri`.
- Modul: `org.springaicommunity:mcp-server-security-spring-boot`.
- Avansat: Dynamic Client Registration (off by default), scope step-up, HTTPS forțat anti-SSRF.

### Lab 5a — LLM-as-judge (răspunde direct la cererea ta de "judge LM")

Două niveluri, predate progresiv:

1. **Evaluatoarele built-in** (`Evaluator` interface):
   - `RelevancyEvaluator` — răspunsul e relevant la întrebare? (prinde "off-topic")
   - `FactCheckingEvaluator` — răspunsul e ancorat în context? (prinde halucinațiile)
   - Pattern de test: `EvaluationRequest(question, retrievedDocs, answer)` → `evaluator.evaluate(...).isPass()`. Excelent în teste cu Testcontainers + Ollama local.

2. **LLM-as-judge "serios"** (ghidul oficial cu Recursive Advisors):
   - **Direct Assessment** (point-wise, scor 1–4) cu self-refine: la fail, reîncearcă cu feedback → buclă de auto-îmbunătățire.
   - **Pairwise comparison** (alege mai bun din 2 — util în A/B).
   - Dimensiuni judecate: relevance, factual accuracy, faithfulness, instruction adherence, coherence.
   - De spus: judecătorii ajung la ~85% acord cu oamenii (peste acordul om-om de ~81%).

### Lab 5b — Agentic (partea de "agent")

Cele **5 pattern-uri** din "Building Effective Agents" (Anthropic), implementate în `spring-ai-examples/agentic-patterns`:
1. **Chain** — descompune task complex în pași secvențiali.
2. **Parallelization** — apeluri LLM concurente + agregare.
3. **Routing** — clasifică input-ul și rutează spre handler specializat.
4. **Orchestrator-Workers** — un orchestrator deleagă la workeri.
5. **Evaluator-Optimizer** — buclă generează → evaluează → rafinează (se leagă direct de Lab 5a).

**Foarte relevant pentru tine (agentic.how):** noul toolkit **`spring-ai-agent-utils`** (blog Spring, ian 2026) inspirat de Claude Code — **Agent Skills (suportă fișiere `SKILL.md` cu YAML frontmatter, inclusiv skill-uri Claude Code existente)**, Task Management, `AskUserQuestion`, Hierarchical Sub-Agents, Dynamic Tool Discovery. E puntea perfectă între cursul Spring AI și brandul tău agentic.how.

> Distincția-cheie de predat (din paper): **Workflows** = LLM-uri orchestrate prin căi de cod predefinite (predictibil, enterprise) vs **Agents** = LLM-ul își dirijează singur procesul. Pentru task-uri bine definite, workflow-urile bat agenții autonomi la predictibilitate.

---

## 4. Ce face LangChain4j în plus (cele 2–3 lucruri pe care Spring AI nu le are nativ)

De pus la final ca discuție onestă "alege unealta potrivită". Sunt diferențe de **filozofie**: Spring AI e opinionat pe *compoziție* (Advisors, Spring beans ca tools), LC4j e opinionat pe *building blocks* ("Lego").

1. **`AiServices` — servicii AI declarative din interfețe** (cel mai mare diferențiator)
   ```java
   interface Assistant {
       @SystemMessage("You are a Java expert")
       String chat(@UserMessage String question);
   }
   Assistant a = AiServices.create(Assistant.class, model);
   ```
   LC4j generează un proxy care gestionează conversația, tool calling-ul și parsarea output-ului. Spring AI **nu are echivalent direct** — folosești `ChatClient` fluent + advisors. (Trade-off: AiServices e concis dar "magic"; debugging-ul proxy-ului e mai greu.)

2. **Guardrails (input & output) — disponibile doar pe AiServices**
   - **Input guardrails:** validează mesajul user *înainte* de model (anti prompt-injection, redactare PII, schema de input).
   - **Output guardrails:** validează răspunsul; pot cere **retry sau reprompt** (mesaj adăugat în context + reîncercare, până la `maxRetries`).
   - Spring AI **nu are un API dedicat de guardrails cu reprompt-loop** (poți simula cu advisors, dar nu e first-class).

3. **Acoperire mai largă de furnizori & vector stores** (20+ providers, 30+ embedding stores) + **agnostic de framework** (Quarkus, Spring Boot, plain Java).
   - Trade-off (de menționat onest): LC4j abstractizează peste mulți furnizori → când un provider scoate un feature nou (ex. code execution OpenAI, grounding Gemini), LC4j întârzie câteva săptămâni. Breadth over novelty.

> Mini-demo de impact: talk-ul "Codepocalypse Now: LangChain4j vs Spring AI" (Baruch Sadogursky & Viktor) construiește același agent de 6 ori în paralel — memory, tools, agentic, guardrails, observability. Format bun de furat pentru segmentul de comparație.

---

## 5. "Gotchas" & breaking changes (material de aur pentru trainer)

- **Hype vs realitate pe GA** (vezi §0) — corectează percepția cursanților.
- **2.0 cuplat de Boot 4** — nu poți lua 2.0 fără să migrezi întâi la Spring Boot 4.0. Migrarea Boot 3→4 e de luni, nu săptămâni. Boot 3.5 EOL = 30 iunie 2026.
- **Jackson 3** — schimbă silentios forma JSON-ului (date, ordinea câmpurilor). Rulează suita de integrare *înainte și după* upgrade și diff pe output.
- **Tool calling overhaul** — codul vechi cu `internalToolExecutionEnabled` / `toolNames()` nu compilează pe RC1.
- **Conversation ID obligatoriu explicit** la chat memory în 2.0.
- **Module eliminate/depreciate:** Vertex AI (rămâne doar embedding), ZhiPu, OCI GenAI depreciate; MiniMax scos în favoarea integrării Anthropic; modele Mistral retrase (Pixtral Large).
- **Evaluatoarele sunt "quirky"** — ai nevoie de prompt tuning pe judge (ex. modelul "crede" că e încă 2023; confundă "you"). Spune-le să nu se bazeze orbește.

---

## 6. Setup recomandat pentru lab (macOS)

- Java 21 (pentru 2.0) sau 17 (pentru 1.1.x).
- `start.spring.io` → alegi modelul + vector store din UI.
- Model local fără cost: **Ollama** (ex. `llama3`, embeddings locale) — ideal ca să nu plătească nimeni token-uri în sală.
- Testcontainers pentru Ollama/PGVector în testele de evaluare.
- Pentru MCP: un client (Claude Code / Inspector) ca să vadă tool-urile live.

---

## 7. Surse (selecție, iunie 2026)

**Oficial Spring**
- Spring AI 2.0.0-RC1 release: https://spring.io/blog/2026/06/06/spring-ai-2-0-0-RC1-available-now/
- Spring AI 2.0.0-M1 (baza Boot 4): https://spring.io/blog/2025/12/11/spring-ai-2-0-0-M1-available-now/
- Blog releases (index): https://spring.io/blog/category/releases/
- Ref: ChatClient — https://docs.spring.io/spring-ai/reference/api/chatclient.html
- Ref: Advisors — https://docs.spring.io/spring-ai/reference/api/advisors.html
- Ref: Tool Calling — https://docs.spring.io/spring-ai/reference/api/tools.html
- Ref: Structured Output — https://docs.spring.io/spring-ai/reference/api/structured-output-converter.html
- Ref: RAG / Modular RAG — https://docs.spring.io/spring-ai/reference/api/retrieval-augmented-generation.html
- Ref: Evaluation Testing — https://docs.spring.io/spring-ai/reference/api/testing.html
- Guide: LLM-as-a-Judge — https://docs.spring.io/spring-ai/reference/guides/llm-as-judge.html
- Ref: MCP overview — https://docs.spring.io/spring-ai/reference/api/mcp/mcp-overview.html
- Ref: MCP Server annotations — https://docs.spring.io/spring-ai/reference/api/mcp/mcp-annotations-server.html
- Ref: MCP Security — https://docs.spring.io/spring-ai/reference/api/mcp/mcp-security.html
- Building Effective Agents — https://docs.spring.io/spring-ai/reference/api/effective-agents.html
- Blog: agentic patterns — https://spring.io/blog/2025/01/21/spring-ai-agentic-patterns/
- Blog: Agent Skills (spring-ai-agent-utils) — https://spring.io/blog/2026/01/13/spring-ai-generic-agent-skills/
- Blog: MCP server OAuth2 — https://spring.io/blog/2025/09/30/spring-ai-mcp-server-security/

**Conferințe recente**
- Spring I/O 2026 — "The Spring AI Ecosystem in 2026: From Foundations to Agents": https://2026.springio.net/sessions/the-spring-ai-ecosystem-in-2026-from-foundations-to-agents/
- Spring I/O 2026 — "From Assistants to Agents: Self-Improving Agentic Systems": https://2026.springio.net/sessions/from-assistants-to-agents-self-improving-agentic-systems-with-spring-ai/
- "Codepocalypse Now: LangChain4j vs Spring AI" (Baruch & Viktor): https://speaking.jbaru.ch/talks/2026-04-14-arcofai26-codepocalypse-now/
- Foojay — Spring I/O 2026 field notes ("web framework → agent platform"): https://foojay.io/today/spring-i-o-2026-field-notes-from-barcelona/

**LangChain4j**
- AI Services — https://docs.langchain4j.dev/tutorials/ai-services/
- Guardrails — https://docs.langchain4j.dev/tutorials/guardrails/

**Articole / tutoriale recente**
- Spring AI 2.0 MCP annotations (R. Patra, mai 2026) — https://www.rabinarayanpatra.com/blogs/spring-ai-2-mcp-annotations-tutorial
- Build MCP server cu MongoDB (DEV, nov 2025) — https://dev.to/mongodb/build-a-spring-ai-mcp-server-with-mongodb-1ebd
- Advanced RAG (Vaadin / M. Hellberg) — https://vaadin.com/blog/advanced-rag-techniques-with-spring-ai
- Evaluators (Baeldung) — https://www.baeldung.com/spring-ai-testing-ai-evaluators
- Spring AI vs LangChain4j 2026 (JavaCodeGeeks) — https://www.javacodegeeks.com/2026/03/choosing-a-java-llm-integration-strategy-in-2026-spring-ai-1-1-vs-langchain4j-vs-direct-api-calls.html
- Java AI agent frameworks 2026 (CodeWiz) — https://codewiz.info/blog/java-ai-agent-frameworks-2026/
