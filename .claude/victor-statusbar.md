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

*Maintained by Victor. The script is global (`~/.claude/`), not part of this
repo — this file is documentation only.*
