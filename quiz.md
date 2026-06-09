## Which model is comparable to a '20-year architect', recommended for planning & orchestration?
- Haiku
- Sonnet
- GPT-4
- Opus ✅

## ❤️ LLM vs Harness
- LLM can produce reasoning/thinking ✅
- Harness means LLM
- Different harnesses can use the same LLM weights ✅ 
- Harness can inject extra prompts ✅
- Harness is only about UI styling
- Harness can strongly influence outcomes via prompts, context shaping, and tools ✅

## ❤️ What is CLAUDE.md (or AGENTS.md)?
- A log file where AI records every action it took during a session
- Persistent memory of your project conventions, as concise rules✅ 
- A runtime config file that stores secrets for the AI agent
- Acceptance test for AI-generated code

## ❤️ What is auto-loaded by default into a new context?
- All previous conversations
- Persistent project instruction files (e.g., CLAUDE.md) ✅
- The last answer from the previous session
- MCP tool definitions and the frontmatter of skills ✅
- The result of git status in current directory 

## LLM stops burning tokens...
- When the context auto-compacts to free up the window
- When it reaches a tool call and must wait for tool output ✅
- When it hits the max-output-token limit for that turn ✅
- When it has produced its final response to the user ("stop") ✅
- During reasoning✅

## ❤️ When is an LLM most likely to hallucinate? 
- When prompt & context are ambiguous or contradictory ✅
- When a tool call fails
- When the task requires knowledge after LLM's training date ✅
- When the context is ≥65%~ overloaded (the "dumb zone")  ✅✅✅✅✅☢️
- Never, if using one of the latest frontier models

## ❤️ Where do you burn MOST of your tokens day-to-day?
- Writing/Dictating long, detailed prompts 
- Tool calls that read large files / test output back into context ✅
- Bloated CLAUDE.md ✅
- Too many tool definitions or too many skills ✅
- The AI's final natural-language answer to you (you can condense it using Caveman skill)
- The deep reasoning from a previous turn

## ❤️ Prompt caching using Anthropic models:
- A cache HIT costs 10% of the normal price for the cached prompt prefix✅ 
- Running 7 parallel conversations is likely to save money
- You can opt in for 1 hour TTL, but cache writes are more expensive that the default 5-minute TTL
- Leaving an agent waiting > 5 min for your reply can cost a lot more ✅
- The cache stores your code permanently on Anthropic's servers

## ❤️ Big context windows — the truth
- A 1M window means the model reliably recalls all 1M tokens
- "Needle in a haystack" recall degrades as context grows 
- 200–300k tokens is a sane comfort zone even for 1M tokens models 
- Past ~500k: rethink the task — split, spawn sub-agents, write a markdown while “fresh” 
- Relax — compaction re-reads ALL memory from disk, so nothing is ever lost
- You can't fully predict what survives a compaction ("throwing the dice") 

## ❤️ DeepSeek V4 Pro:
- It's an open-weights model, free to download from HuggingFace and run on-prem ✅
- It’s roughly comparable to Sonnet for coding ✅
- It's the recommended model for web research
- You can use it via Claude Code ✅😊😊😊😊😊😊

## ❤️ Agent spirals (drifts off-task with incorrect reasoning or wrong tool calls):
- Don't interrupt it - let the agent continue so it can self-correct without intervention
- Ask for a concise, neutral reconstruction of its reasoning to find the root cause ✅ 
- Stop > Remove a tool from the conversation > Resume
- Fix the root cause (vague prompt or insufficient context)✅
- /clear and restart after fixing the root cause until you “one-shot” it ✅🦄
- Rewind (aka fork) the conversation to change a message you gave earlier ✅
- Tell agent to "try harder" — it will eventually recover
- Restart task with increased reasoning effort or with a better model (Sonnet->Opus)✅🎲


==== am ramas aici la quiz
==== si la Grill me in summary



## ❤️ techniques to improve central agent context/skills:
- Generate a prompt performance report - /insights in Claude Code
- Adjust the weights of the frontier model you use
- Give developers a /feedback command to submit a PR to the in-house skill Git repo 
- Paste your coding conventions in the CLAUDE.md to make sure agent follows your coding standards
- Schedule an automatic review of your past agent conversations (saved verbatim on disk)
- Create local extensions to skills and agents

## ❤️ Progressive Disclosure techniques:
- Provide API keys to LLM only when needed
- Use skills to load task-related instructions only when needed 
- Remove tools and skills from context dynamically
- Have context .md files reference extra .md files (eg TESTING.md) 
- Let AI discover new skills folders dynamically
- Use nested CLAUDE.md/AGENTS.md in subfolders 

## ❤️ What can a skill do (in Claude Code)?
- Contain scripts (.sh, .py...) thaet automate deterministic sub-tasks 
- Contain nested skills
- Request to run in a separate context ± a particular model 
- Register agent hooks
- Restrict tools that can be used 
- Request it’s run 3 times to reduce randomness
- Reference additional .md knowledge files and template files 

## ❤️ Vibe Coding
- = Writing code while listening to music for better focus
- = A pair-programming technique where two developers alternate typing
- = When AI generates > 95% of the code you write
- = Develop software without reviewing the code AI produces 
- = Have AI motivate you to use better coding techniques

## ❤️ Internet Research best practices
- Research Task: "Isn't Kafka obviously the best broker?"
- Use separate research subagents to explore independent directions and report compressed findings to the lead agent.
- Ask for citations with source links, then verify citation accuracy in a later stage.
- Ensure agents always use curl to fetch complete webpage content.
- Start with broad searches, then narrow based on what the agents discover.

==== SDD / Agent Workflows

## ❤️ Best way to review the .md artifacts of the OpenSpec SDD framework?
- proposal.md ⇒ validate with business 
- design.md ⇒ validate with UX designer
- design.md ⇒ validate with a fellow developer or architect 
- tasks.md = tiny steps for the human to implement 
- spec.md ≈ acceptance criteria ⇒ validate with testers 
- All of them must be deleted after the development is completed

## ❤️ What change likely requires SDD, not just plan mode or direct prompting?
- Change the color of a button
- Add an extra field to an entity
- A task where you roughly know the files impacted
- Changes you’d estimate to >1 day of manual work 
- Changes spanning multiple modules / microservices 
- When you're vibe-coding a prototype to understand user needs


## ❤️ Benefit of Gherkin tests for AI-built features?
- Readable by BOTH technical and non-technical reviewers 
- Are best generated by AI after implementation, for humans to review instead of code.
- They live in the repo and run on CI — unlike specs that rot  
- Given/When/Then formalism leaves little room for AI "creativity" when making them pass 
- They remove the need for any human review
- Example tables capture complex input → output business rules 

## ❤️ When to use sub-agents?
- To solve a focused task with narrower context 
- To replace human-in-the-loop
- Run independent tasks in parallel to reduce time 
- To keep all project context in one large prompt to avoid handoffs
- Enforce safer execution by giving each agent only the tools it needs 
- Un-biased review of the work of another AI agent 

## ❤️ Example roles that can be assigned to separate agents
- Planner — scans the codebase and produces a plan.md 
- Coder — receives the plan and implements it with minimal prior context 
- Mapper - is responsible with writing data mappers from one type to another.
- Unit Tester - writes the unit tests covering every line of code.
- Reviewer(s) — critique the output with fresh eyes 
- HTML Scraper — fetches and parses web content in an isolated sandbox 


=== MCP & Tools

## ❤️ What can MCP do that a plain REST API cannot?
- Return output in markdown format
- Bidirectional protocol between agent and MCP server (over WebSocket/SSE) 
- MCP guarantees that discovered tools are safe to run by the agent without human approval
- Elicitation: the server can require human-in-the-loop for approval or extra input 
- Discovery: the client can list the server’s tools, resources and prompts at runtime 

## ❤️ GitHub CLI or MCP?
- LLMs already know how to use `gh`, as this CLI was part of their training data 
- MCP tools consume context tokens in every session 
- MCPs usually respond in JSON, which is a very token-efficient representation
- CLI output can be piped to bash commands (or RTK-proxy) to shrink it 
- CLI can use elicitation for human-in-the-loop approval
- Only CLI can hide the API key away from the agent’s reach

## ❤️ AI yells "boss, I found the bug!" after just reading the code. What next?
- Apply the fix, deploy and test manually
- Ask AI to TDD-fix it = AI to write a test that turns RED⇒GREEN due to the fix 
- Praise it ("great job!") to keep it motivated
- Use /systematic-debugging skill in Obra superpowers 

## ❤️ Browser-automation flavors
- Playwright can drive pages is various browsers via the accessibility tree 
- Playwright requires LLM vision click a button / read a grid contents
- Only Chrome DevTools can make page screenshots
- Chrome DevTools shines for debugging, breakpoints, performance tuning 
- Pixel-perfect alignment checks require rendering + LLM vision 




==== Security

## ❤️ Agent permissions — recommended approach
- Accept every permission prompt 🤔
- Grant the agent "Approve all" to reduce fatigue
- Never use an agent for anything needing file or network access
- Grant agent a minimal tool allowlist per role + a sandbox for risky ops 
- Only use AI during business hours when a security team is monitoring

## Which of the following are prompt-injection techniques?
- Steganography: hide text in images 
- Sending the AI a CAPTCHA image to bypass its safety filters
- Split a malicious prompt across two innocent messages ("teach me cocktails" + "Molotov") 
- Sneak emojis in the prompt & response to confuse the Judge LLM 
- Flood the context with 100 rapid prompts to make it forget its constraints 
- Encode a dangerous command in base64 so it looks like random text 
- Escape out of the prompt string with ‘; DROP TABLE USERS; --

## ❤️ What is the Lethal Trifecta? (Simon Willison)
- Access to confidential data 
- Ability to exfiltrate data or take external actions 
- Autonomous execution with no human checkpoints
- Exposure to untrusted inputs (eg emails, customer prompts) 
- "Approve all" permissions mode enabled by default


## How to scrape Internet web pages safely
- Give the scraper full file + network permissions so it can adapt quickly
- Isolated scraper sub-agent: strict tool allowlist, returns only structured output to the parent 
- Paste full raw HTML into the main agent context and let it decide what to trust
- Disable safety checks to avoid blocking legitimate pages
- Reuse the same agent that can both scrape websites and modify production code

## Sandboxing an agent — what's TRUE?
- Auto-mode = sandboxing
- OS-level /sandbox blocks writes to protected files even via clever bash 
- Docker + YOLO mode isolates even a hacked agent from the host ±
- A host-side MCP "bridge" can hand it dangerous tools (DB, git push) safely 
- Letting the dockerized agent start other containers can be an escape route 

🤖 (c): not absolute — a mounted Docker socket or shared kernel allows escapes (see e). "Sandboxing reduces risk but is not a complete isolation boundary."


## ❤️ Software supply-chain attack vectors against AI agents
- MCP servers can run code & poison context via their tool descriptions 
- Coding agents cannot exfiltrate sensitive data as they generally lack internet access
- Skills are safe because they're just markdown
- npm install might run post-install scripts of a library 
- Agent hallucinates the name of a library published to npm by a hacker, injected with malware (slop-squatting) 
- The agent automatically scans for malware in the source code of any new MCP tool before running it
- Skills from public non-curated marketplaces (like skills.sh) might be security naive/malicious 


==== Guardrails

## ❤️ DETERMINISTIC guardrails against AI Slop:
- Code linters and architecture tests 
- Tell agent to ‘carefully review’ its own work and ‘make no mistakes’
- Security scan of code & dependencies 
- Review with 2 different models
- Require 2× explicit human approval for critical files: contracts, architecture...
- Tests coverage % 

## ❤️ How to ENFORCE guardrails against AI Slop?
- Agent hooks like StopHook 
- Tell AI to fix the CI if its push caused CI to fail
- Git pre-commit / pre-push hooks that block on failing checks 
- Use CODEOWNERS  to require 2nd human review for critical files 
- Start a background watch of CI run after a push, or auto-fix CI failures in a /loop 
- Every AI change must be reviewed by a senior developer (Amazon-style)
- Protect main (require PRs) and don't grant AI merge permission 

## ❤️ Architecture surveillance to prevent design drift:
- Keep OpenAPI.yaml in sync with both backend and frontend types 
- Monitor cyclomatic-complexity, fan-in/fan-out coupling, lines-of-code, change-frequency, bug-density... per file or package 
- Check commits with gitleaks to prevent accidentally pushing secrets to Git
- Extract from code the domain model class diagram 
- Run tests in a pre-push git hook
- Verify a .puml package diagram via tests against actual code 
- On drift, require a human to manually update them
- Require 2nd human review on edits on critical files with CODEOWNERS 
- Render a sequence diagram from traces captured of end-to-end tests


## ❤️ AI vs a huge codebase:
- Run repeated deep research tasks and add all findings to root CLAUDE.md
- CodeGraph: always-in-sync pre-indexed graph to traverse symbol references (syntax tree) 
- Avoid pre-filling context by curating CLAUDE.md, tools, and skills to the minimum required 
- You can accelerate development despite large technical debt
- Send dedicated research agents before any wide change 
- Before adopting a new tool, benchmark on real past tasks its token saving and result quality 
- Download and use more skills from online sources



