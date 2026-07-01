# Victor's Claude Code Status Line

Reference for the custom status line rendered at the bottom of every Claude Code
turn. The script lives **outside this repo** at `~/.claude/statusline-command.sh`
and is wired up in `~/.claude/settings.json`:

```json
"statusLine": { "type": "command", "command": "/Users/victorrentea/.claude/statusline-command.sh" }
```

Claude Code pipes a JSON blob to the script's stdin on every render; the script
prints one line. This file documents what that line means.

## Example

```
🤖 Opus 4.8/xhigh 60K/1M (6%) | ⏳ 97%🔼 left / 4:09h | 💵 194K=0.11$ · $25.74 ∑
```

Three `|`-separated segments: **model/context**, **5h quota + burn-rate**, **spend**.

---

## 1. Model & context — `🤖 Opus 4.8/xhigh 60K/1M (6%)`

| Piece | Meaning | Source (stdin JSON) |
|-------|---------|---------------------|
| `Opus 4.8` | model display name | `.model.display_name` |
| `/xhigh` | reasoning effort level | `.effort.level` |
| `60K` | absolute context tokens used | `.context_window.used_percentage` × size |
| `/1M` | context window size | `.context_window.context_window_size` |
| `(6%)` | context used as a percentage | `.context_window.used_percentage` |

The `(6%)` turns **orange ≥ 65%** and **red ≥ 95%**.

---

## 2. Quota & burn-rate — `⏳ 97%🔼 left / 4:09h`

Tracks the rolling **5-hour** rate-limit window.

| Piece | Meaning | Source |
|-------|---------|--------|
| `97% left` | quota remaining = `100 − used%` | `.rate_limits.five_hour.used_percentage` |
| `🔼` | burn-rate indicator (see below) | derived |
| `/ 4:09h` | time until the window resets | `.rate_limits.five_hour.resets_at` |

The `% left` turns **orange < 15%** and **red < 5%**.

### Burn-rate indicator

Compares how much **quota** is left against how much **time** is left in the
5-hour (18000s) window, so you can see at a glance whether you're spending
faster or slower than the clock:

- `quota_left = (100 − used%) / 100`
- `time_left  = seconds_until_reset / 18000`
- `r = quota_left / time_left`

| ratio `r` | meaning | emoji |
|-----------|---------|-------|
| ≥ 1.5 | **much more** quota than time — big surplus | ⏫ |
| 1.15 – 1.5 | **more** quota than time | 🔼 |
| 0.87 – 1.15 | **on par** — spending in step with the clock | *(none)* |
| 0.67 – 0.87 | **less** quota than time | 🔽 |
| < 0.67 | **much less** — burning too fast | ⏬ |

Bands are reciprocal-symmetric (1.5 ↔ 0.67, 1.15 ↔ 0.87) so surplus and deficit
are treated evenly. No emoji means you're on track.

**Quick mental check:** convert time-left to a percentage with
`minutes_left / 300 × 100`, then compare to `% left`. If they're within ~13% of
each other, you're on-par (blank). E.g. `4:09h` = 249 min → 83% time left;
against `97%` quota that's `r ≈ 1.17` → 🔼.

---

## 3. Spend — `💵 194K=0.11$ · $25.74 ∑`

Two parts: **last turn**, then **session total** (`∑`).

| Piece | Meaning |
|-------|---------|
| `194K` | tokens consumed by the **last turn** |
| `=0.11$` | USD cost of the **last turn** |
| `$25.74 ∑` | total USD cost for the **whole session** |

### How each number is derived

- **Session cost** (`$25.74`) comes straight from `.cost.total_cost_usd`, which
  is authoritative and matches `/usage` "Total cost" (includes subagents). It is
  a running session total only.
- **Last-turn cost** (`0.11$`) — the transcript stores **no** per-message cost
  (`costUSD` is `null`), so it can't be read directly. Instead it's the **delta**
  of the session total since the current turn began. A per-session state file at
  `/tmp/claude-statusline-turn-<session-id>.txt` records the cost snapshot taken
  when the latest user prompt first appeared; the turn cost is
  `current_total − snapshot`. It resets to ~$0 at the start of each new turn.
- **Tokens** (`194K`) are summed from the session transcript JSONL
  (`input + output + cache_read + cache_creation`), **deduped by `requestId`**.
  This dedup matters: streaming logs the *same* `usage` object on several lines
  per API request, so a naive sum over-counts by ~2–3×. Last-turn tokens count
  only the assistant messages after the most recent real user prompt (tool
  results excluded).

### Caveats

- Last-turn cost is a derived delta. If the very first render of a turn lands
  *after* the model already made an API call, that turn slightly undercounts
  (it self-corrects on the next turn).
- Token counts come from the **main transcript only**, so subagent/sidechain
  tokens aren't included — but their cost *is* in the session total (it comes
  from `.cost.total_cost_usd`). Minor inconsistency by design.
- The window length is hardcoded to 5h (18000s); the status input only provides
  `resets_at`, not the window size.

---

## Implementation tricks

The interesting engineering isn't in *what* is shown but in squeezing accurate,
per-turn numbers out of an input that only ever gives a running **session**
total, and doing it cheaply enough to re-render every second. Highlights:

### Deriving a *per-turn* cost from a session-total-only input
- `.cost.total_cost_usd` is authoritative (matches `/usage`, includes subagents)
  but is a **monotonic session total**. The transcript stores no per-message cost
  (`costUSD` is `null`), so the turn cost can't be read — it's computed as the
  **delta** of the total since the turn began, with the baseline snapshotted in a
  per-session `/tmp` state file keyed by the last user prompt's UUID.
- When a new prompt appears, the just-finished turn's cost is snapshotted as
  "previous turn" **before** rolling the baseline forward — so the gap before the
  new turn's usage lands shows the old number instead of **flashing $0.00**.

### Token counting that doesn't over-count
- Tokens are summed from the transcript JSONL, **deduped by `requestId`** via
  `group_by`. Streaming logs the *same* `usage` object on several lines per API
  request, so a naive sum inflates by ~2–3×.
- A jq predicate isolates the **last real user prompt** — excluding sidechain,
  meta, and messages whose content is only a `tool_result` — so "this turn" starts
  at the right message.

### Making `refreshInterval: 1` affordable
- The `jq -s` that slurps the **entire** (often multi-MB) transcript is far too
  costly to run every second. Its one-line output is **cached against the
  transcript's mtime**; while the file is untouched the cache is reused, and any
  new message bumps the mtime and forces a re-parse. This is what lets the idle
  "N ago" clock tick per-second for free.

### Layered turn-state resolution (three fallbacks)
Knowing whether the agent is *thinking* or *waiting on you* — and when the last
turn ended — is hard because the status JSON has no live signal. Resolved in
priority order:
1. **Hook state (authoritative):** a `Stop` / `UserPromptSubmit` hook
   (`~/.claude/hooks/turn-state.sh`) writes a state file that marks boundaries
   reliably for *every* storage format.
2. **Transcript fallback:** `stop_reason != "tool_use"` + no trailing user
   message ⇒ idle; age from the last assistant `timestamp`.
3. **Cost-clock heuristic:** for Claude Code 2.1.x sessions whose `<id>.jsonl`
   path doesn't exist, turn state is inferred purely from the **cost clock** —
   cost rises while working, flat between turns. Flat ≥ `IDLE_GRACE` (3s) ⇒ idle;
   flat ≥ `NEW_TURN_GAP` (30s) ⇒ genuinely new turn (so a mid-turn tool pause
   doesn't split one turn in two).

### Context-aware idle warning
- The "N ago" clock turns **orange only past the ~5-min prompt-cache TTL** *and*
  only when context ≥ 100K tokens — because only then is the post-TTL uncached
  re-send of your next message expensive enough to be worth flagging.

### Cheap shell/rendering touches
- ANSI colors are built once from `printf '\033'`; thresholds recolor each field
  (context %, quota left, burn arrow, idle age) inline.
- The `/effort` suffix is spliced **around** the model's `(context)` label using
  pure shell parameter expansion (`${model%% (*}` / `${model#* (}`) — no subshell.
- Size label comes from either the model's `(1M)` suffix (sed) or is computed from
  `context_window_size` (bc), then abbreviated K/M.
- **Burn-rate arrow** (`↑↗↘↓`): awk ratio `r = quota_left_frac / time_left_frac`
  over the hardcoded 18000s window, with reciprocal-symmetric bands so surplus and
  deficit are treated evenly; no arrow when on-track.
- The whole spend segment is **suppressed** when the session total rounds to
  `$0.00`.
- The 🌿 worktree name appears **only inside a linked worktree** (git-dir under
  `.git/worktrees/<name>`), never in the main working tree.

> **Note:** the *Example* and format details in §2–§3 above predate the current
> script — live output now uses `↑↗↘↓` arrows, `•` separators, a `💸` total, an
> idle "N ago" clock, and the worktree segment. The tricks below reflect the
> script as it stands.

---

*Maintained by Victor. The script is global (`~/.claude/`), not part of this
repo — this file is documentation only.*
