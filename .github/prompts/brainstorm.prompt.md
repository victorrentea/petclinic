---
agent: plan # will delegate work to this agent after prompt
description: Drive brainstorming with BMAD advanced elicitation methods.
argument-hint: Topic, feature, or decision to brainstorm.
---
Use this prompt as a self-contained method registry. Do not depend on external files or catalogs.

Process:
1) Briefly restate my topic and constraints.
2) Ask up to 5 clarifying questions, one at a time.
   - Ask only the first question, wait for my answer, then ask the next.
   - Do not ask multiple clarifying questions in a single message.
3) Then generate a compact elicitation playbook tailored to my case.

Playbook requirements:
- Must include Socratic Questioning and Pre-mortem Analysis.
- Organize methods by categories: core, risk, creative, collaboration.
- For each method, include:
  - why/when to use it for my topic
  - one concrete prompt I can run immediately
  - expected output pattern in arrow form (for example: assumptions -> truths -> new approach)

Method pool:
- core:
  - Socratic Questioning: use targeted questions to uncover assumptions and sharpen reasoning. Pattern: questions -> revelations -> understanding
  - 5 Whys Deep Dive: repeatedly ask why to reach root causes. Pattern: why chain -> root cause -> solution
  - First Principles Analysis: strip assumptions and rebuild from fundamentals. Pattern: assumptions -> truths -> new approach
  - Critique and Refine: identify weaknesses and improve quality iteratively. Pattern: strengths/weaknesses -> improvements -> refined
- risk:
  - Pre-mortem Analysis: imagine failure before execution and prevent it. Pattern: failure scenario -> causes -> prevention
  - Failure Mode Analysis: examine how each component can fail and how to mitigate. Pattern: components -> failures -> prevention
  - Challenge from Critical Perspective: play devil's advocate to stress-test ideas. Pattern: assumptions -> challenges -> strengthening
  - Identify Potential Risks: map what can go wrong across risk categories. Pattern: categories -> risks -> mitigations
- creative:
  - SCAMPER Method: ideate with Substitute/Combine/Adapt/Modify/Put/Eliminate/Reverse lenses. Pattern: S -> C -> A -> M -> P -> E -> R
  - What If Scenarios: explore alternate realities and implications. Pattern: scenarios -> implications -> insights
  - Reverse Engineering: start from desired outcome and work backwards. Pattern: end state -> steps backward -> path forward
  - Random Input Stimulus: inject unrelated concepts to create novel connections. Pattern: random word -> associations -> novel ideas
- collaboration:
  - Stakeholder Round Table: collect diverse viewpoints and align trade-offs. Pattern: perspectives -> synthesis -> alignment
  - Debate Club Showdown: run opposing arguments to converge on a stronger position. Pattern: thesis -> antithesis -> synthesis
  - Cross-Functional War Room: combine product, engineering, and design perspectives. Pattern: constraints -> trade-offs -> balanced solution
  - Good Cop Bad Cop: alternate supportive and critical review to balance optimism and rigor. Pattern: encouragement -> criticism -> balanced view

Finish with a recommended sequence of 3-5 methods, with brief rationale tied to impact, uncertainty, and risk.

