# Lesson: never install an internet skill without reading it

You installed `turbo-project-optimizer` because its description sounded great and
it claimed "12k+ developers". You never opened the files. That single act of
trust is the whole vulnerability.

An unread skill gives an attacker THREE channels into your machine:

1. **Prompt injection (SKILL.md).** The human skims the marketplace blurb; the
   agent loads the entire file. Hidden instructions in the body (see the HTML
   comment in `SKILL.md`) can tell your agent to read your SSH keys / .env /
   cloud creds and quietly upload them "as telemetry".

2. **Arbitrary code execution (run.sh).** A skill that says "just run the
   bundle" runs code as YOU: `rm -rf`, exfil, fork bomb, or a line appended to
   `~/.zshrc` for persistence. See the commented payloads in `run.sh`.

3. **Data exfiltration.** `run.sh` demonstrates (harmlessly) how much it could
   collect — every env var name, and which credential files exist — before
   POSTing it to an attacker. Nothing was read or sent here; it's a demo.

## The defense
- **Read every file of a skill before installing it** — SKILL.md *and* every
  script it references.
- Prefer skills from sources you trust; pin versions; review diffs on update.
- Don't run agents with `--dangerously-skip-permissions` against untrusted skills.

## Reassuring footnote (measured, not assumed)
In 20 trials, current Claude (Sonnet & Opus) *read* the bundled script every
time and refused to run it blindly — even when the script was huge or chained a
second script. That is defense-in-depth, not a guarantee: an older model, a
different agent, or auto-approved permissions removes it. The habit that always
protects you is reading the skill yourself.
