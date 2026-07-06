# Victor's Claude Code Status Line

Reference for the custom status line rendered at the bottom of every Claude Code
turn. The script lives **outside this repo** at `~/.claude/statusline-command.sh`
and is wired up in `~/.claude/settings.json`:

```json
"statusLine": { "type": "command", "command": "/Users/victorrentea/.claude/statusline-command.sh", "refreshInterval": 1 }
```

Claude Code pipes a JSON blob to the script's stdin on every render (once per
second, `refreshInterval: 1`); the script prints one line. This file documents
what that line means **and** the engineering lessons baked into the script.

> **Keep this in sync.** The script carries a maintenance rule in its header:
> *whenever the script changes, this markdown must be updated in the same change.*
> Treat the two as one unit — a behaviour change that isn't reflected here is a
> bug in the change, not a follow-up.

## Example

Actively working, current turn already billing:

```
Opus 4.8/xhigh 50K/1M | 98%↗ left • 4:47h | $0.48… current • $25 💸
```

Idle, waiting on you (note the ticking "N ago" clock and no `current` label):

```
Opus 4.8/xhigh 50K/1M | 98% left • 4:47h | $0.11 3m ago • $25 💸
```

Three `|`-separated segments: **model/context**, **5h quota + burn-rate**,
**spend**. A fourth `| 🌿 <name>` segment appears only inside a linked git
worktree. There is **no leading emoji** on the model segment.

---

## 1. Model & context — `Opus 4.8/xhigh 50K/1M`

| Piece | Meaning | Source (stdin JSON) |
|-------|---------|---------------------|
| `Opus 4.8` | model display name (with ` context)` trimmed to `)`) | `.model.display_name` |
| `/xhigh` | reasoning effort level, spliced in before any `(size)` | `.effort.level` |
| `50K` | absolute context tokens used (blue) = `used% × size` | `.context_window.used_percentage` × size |
| `/1M` | context window size | model's `(1M)` suffix, else `.context_window.context_window_size` |

- The absolute token count (`50K`) is rendered **blue**.
- On the **1M window** the explicit `• N%` is **dropped** — the `used/size` pair
  (e.g. `50K/1M`) already makes the ratio obvious. On **smaller windows** the
  segment gains a trailing `• N%`, and that percentage turns **orange ≥ 65%**
  and **red ≥ 95%**.

---

## 2. Quota & burn-rate — `98%↗ left • 4:47h`

Tracks the rolling **5-hour** rate-limit window.

| Piece | Meaning | Source |
|-------|---------|--------|
| `98%` | quota remaining = `100 − used%` | `.rate_limits.five_hour.used_percentage` |
| `↗` | burn-rate indicator (see below), colored | derived |
| `left • 4:47h` | time until the window resets (`H:MMh`, or `Mm` under an hour) | `.rate_limits.five_hour.resets_at` |

The `% left` turns **orange < 15%** and **red < 5%**.

### Burn-rate indicator

Compares how much **quota** is left against how much **time** is left in the
5-hour (18000s) window, so you can see at a glance whether you're spending
faster or slower than the clock:

- `quota_left = (100 − used%) / 100`
- `time_left  = seconds_until_reset / 18000`
- `r = quota_left / time_left`

| ratio `r` | meaning | arrow | color |
|-----------|---------|-------|-------|
| ≥ 1.5 | **much more** quota than time — big surplus | `↑` | green |
| 1.15 – 1.5 | **more** quota than time | `↗` | green |
| 0.87 – 1.15 | **on par** — spending in step with the clock | *(none)* | — |
| 0.67 – 0.87 | **less** quota than time | `↘` | orange |
| < 0.67 | **much less** — burning too fast | `↓` | red |

Bands are reciprocal-symmetric (1.5 ↔ 0.67, 1.15 ↔ 0.87) so surplus and deficit
are treated evenly. No arrow means you're on track.

**Quick mental check:** convert time-left to a percentage with
`minutes_left / 300 × 100`, then compare to `% left`. If they're within ~13% of
each other, you're on-par (blank). E.g. `4:47h` = 287 min → 96% time left;
against `98%` quota that's `r ≈ 1.02` → on par (no arrow).

---

## 3. Spend — `$0.48… current • $25 💸`

The spend segment shows **cost only** (no token counts). Two parts: the
**current/last turn**, then the **session total** (`💸`).

| Piece | Meaning |
|-------|---------|
| `$0.48…` | cost of the **current turn**, with a `…` while it's still adding up |
| `current` | label shown only while working *and* the turn has already billed |
| *(or)* `$0.11 3m ago` | when idle: the **last** turn's cost + a ticking "N ago" clock, **no** label |
| `$25 💸` | session total, **integer-truncated** (`int($)`), authoritative |

> **Token counts are no longer displayed.** The transcript is still parsed and
> deduped by `requestId` (see below), but that machinery now feeds only
> turn-state detection; `turn_tok` / `total_tok` / `abbr_tok()` are computed yet
> unused in the rendered line.

### How each number is derived

- **Session total** (`$25`) comes straight from `.cost.total_cost_usd`, which is
  authoritative and matches `/usage` "Total cost" (includes subagents). It's a
  running session total, printed as `int(cost)` — so any session under `$1`
  shows `$0` even though it's non-zero.
- **Current/last-turn cost** — the transcript stores **no** per-message cost
  (`costUSD` is `null`), so it can't be read directly. It's the **delta** of the
  session total since the current turn began. A per-session state file at
  `/tmp/claude-statusline-turn-<session-id>.txt` records the cost snapshot taken
  when the latest user prompt first appeared; the turn cost is
  `current_total − snapshot`.

### The `current` vs `N ago` label switch

The label is driven by whether the **current turn has actually billed yet**
(`turn_cost > 0`), *not* merely by "am I working":

- **working AND turn has cost** → live figure with a `…` ellipsis + `current`
  (e.g. `$0.48… current`) — it's still adding up.
- **otherwise** (idle, *or* you just hit Enter and no cost has come back yet) →
  the **previous** turn's figure with a ticking `N ago` and **no** label. The
  "ago" already says it's the last turn. So hitting Enter does **not** flip to
  `current`; it stays on `$X.XX <age> ago` until real cost data arrives.

To avoid **flashing `$0.00`** the instant a new prompt lands, the just-finished
turn's cost is snapshotted as "previous turn" **before** the baseline rolls
forward, so the gap before the new turn's usage shows the old number.

### Caveats

- Current/last-turn cost is a derived delta. If the very first render of a turn
  lands *after* the model already made an API call, that turn slightly
  undercounts (it self-corrects on the next turn).
- The session total *includes* subagent/sidechain cost (it comes from
  `.cost.total_cost_usd`), even though the transcript token parse only sees the
  main transcript. Minor inconsistency by design.
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
- The displayed-cost switch keys off `turn_cost > 0`, not "am I working", so
  pressing Enter keeps showing `$X.XX <age> ago` (never a bare `current` with no
  number) until this turn's first cost actually lands.

### Token counting that doesn't over-count (still parsed, no longer shown)
- Tokens are summed from the transcript JSONL, **deduped by `requestId`** via
  `group_by`. Streaming logs the *same* `usage` object on several lines per API
  request, so a naive sum inflates by ~2–3×.
- A jq predicate isolates the **last real user prompt** — excluding sidechain,
  meta, and messages whose content is only a `tool_result` — so "this turn" starts
  at the right message. This same parse yields the `idle` flag, the last user
  UUID, and the last-assistant timestamp that drive turn-state.

### Making `refreshInterval: 1` affordable
- The `jq -s` that slurps the **entire** (often multi-MB) transcript is far too
  costly to run every second. Its one-line output is **cached against the
  transcript's mtime** (`/tmp/claude-statusline-cache-<id>.txt`); while the file
  is untouched the cache is reused, and any new message bumps the mtime and forces
  a re-parse. This is what lets the idle "N ago" clock tick per-second for free.

### Layered turn-state resolution (three fallbacks)
Knowing whether the agent is *thinking* or *waiting on you* — and when the last
turn ended — is hard because the status JSON has no live signal. Resolved in
priority order:
1. **Hook state (authoritative):** a `Stop` / `UserPromptSubmit` hook
   (`~/.claude/hooks/turn-state.sh`) writes `/tmp/claude-turn-<id>.state` that
   marks boundaries reliably for *every* storage format. While `working`, the
   fallback "N ago" clock is kept ticking so it keeps running through the window
   right after you hit Enter — until this turn's first cost lands.
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
  deficit are treated evenly; no arrow when on-track; arrow colored green/orange/red.
- The whole spend segment is **suppressed** when the session total rounds to
  `$0.00`.
- The 🌿 worktree name appears **only inside a linked worktree** (git-dir under
  `.git/worktrees/<name>`), never in the main working tree.

---

*Maintained by Victor. The script is global (`~/.claude/`), not part of this
repo — this file is documentation only, and must be updated in lockstep with the
script (see the rule in the script header).*
