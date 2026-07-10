# Victor's Claude Code Status Line

Reference for the custom status line rendered at the bottom of every Claude Code
turn. The canonical script lives at `~/.claude/statusline-command.sh` and is
wired up in `~/.claude/settings.json`; its **full source is embedded at the
bottom of this file** (so it ships with the course materials and students get the
exact status bar to then polish):

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

## The full script — `~/.claude/statusline-command.sh`

To reproduce this exact status line: save the script below to `~/.claude/statusline-command.sh`, make it executable (`chmod +x`), and wire it up with the `statusLine` block shown at the top of this file. It is embedded here verbatim so it ships with the course materials — this copy is a snapshot and must be re-synced whenever the canonical script changes.

```sh
#!/bin/sh
# Claude Code status line: "Model (ctx% of SIZE) | 5h% left | spend | 🌿 worktree"
#
# MAINTENANCE RULE: whenever this script changes (format, segments, colors,
# thresholds, turn-state logic — anything that alters behaviour), update its
# companion reference in the same change:
#   ~/workspace/petclinic/.claude/victor-statusbar.md   ("Victor Status Bar")
# The two are one unit; a behaviour change not reflected there is a bug in the
# change, not a follow-up.
input=$(cat)
session_id=$(echo "$input" | jq -r '.session_id // empty')
model=$(echo "$input" | jq -r '.model.display_name // "Claude"' | sed 's/ context)/)/')
effort=$(echo "$input" | jq -r '.effort.level // empty')
if [ -n "$effort" ]; then
  case "$model" in
    *" ("*) model="${model%% (*}/${effort} (${model#* (}" ;;
    *)      model="${model}/${effort}" ;;
  esac
fi
ctx=$(echo "$input" | jq -r '.context_window.used_percentage // empty')
total=$(echo "$input" | jq -r '.context_window.context_window_size // empty')
five=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
reset=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty')

ESC=$(printf '\033')
RESET="${ESC}[0m"
ORANGE="${ESC}[38;5;208m"
RED="${ESC}[31m"
BLUE="${ESC}[38;5;111m"
GREEN="${ESC}[38;5;78m"

if [ -n "$ctx" ]; then
  ctx_pct=$(printf '%.0f' "$ctx")

  # Resolve size label
  size_label=""
  if echo "$model" | grep -q '('; then
    size_label=$(echo "$model" | sed -n 's/.*(\(.*\)).*/\1/p')
    model=$(echo "$model" | sed 's/ *(.*)//')
  elif [ -n "$total" ]; then
    if [ "$total" -ge 1000000 ]; then
      size_label=$(printf '%.0fM' "$(echo "$total / 1000000" | bc -l)")
    else
      size_label=$(printf '%.0fK' "$(echo "$total / 1000" | bc -l)")
    fi
  fi

  if [ -n "$size_label" ] && [ -n "$total" ]; then
    used_tokens=$(printf '%.0f' "$(echo "$ctx * $total / 100" | bc -l)")
    if [ "$used_tokens" -ge 1000000 ]; then
      abs_label=$(printf '%.2fM' "$(echo "$used_tokens / 1000000" | bc -l)")
    elif [ "$used_tokens" -ge 1000 ]; then
      abs_label=$(printf '%.0fK' "$(echo "$used_tokens / 1000" | bc -l)")
    else
      abs_label="${used_tokens}"
    fi
    pct_str="${ctx_pct}%"
    if [ "$ctx_pct" -ge 95 ]; then
      pct_str="${RED}${pct_str}${RESET}"
    elif [ "$ctx_pct" -ge 65 ]; then
      pct_str="${ORANGE}${pct_str}${RESET}"
    fi
    # On the 1M window the "used/size" pair (e.g. 100K/1M) already makes the
    # percentage trivial to eyeball, so drop the explicit "• N%" there; keep it
    # for smaller windows where the ratio is less obvious.
    if [ "$size_label" = "1M" ]; then
      model="$model ${BLUE}${abs_label}${RESET}/${size_label}"
    else
      model="$model ${BLUE}${abs_label}${RESET}/${size_label} • ${pct_str}"
    fi
  fi
fi

out="$model"

if [ -n "$five" ]; then
  left=$(printf '%.0f' "$(echo "100 - $five" | bc -l)")
  ind=""
  dur=""
  until_time=""
  if [ -n "$reset" ]; then
    now=$(date +%s)
    diff=$((reset - now))
    if [ "$diff" -gt 0 ]; then
      h=$((diff / 3600))
      m=$(((diff % 3600) / 60))
      until_time=$(date -r "$reset" +%H:%M)
      if [ "$h" -gt 0 ]; then
        dur=$(printf '%d:%02dh' "$h" "$m")
      else
        dur="${m}m"
      fi
      # Burn-rate vs time: compare quota-remaining to time-remaining within the
      # 5h (18000s) window. ratio r = quota_left_frac / time_left_frac.
      # r>1 => more quota than time left (surplus); r<1 => burning too fast.
      ind=$(awk -v five="$five" -v diff="$diff" 'BEGIN{
        q=(100-five)/100; t=diff/18000;
        if (t<=0){ exit }
        r=q/t;
        if (r>=1.5)       print "↑";
        else if (r>=1.15) print "↗";
        else if (r>=0.87) print "";
        else if (r>=0.67) print "↘";
        else              print "↓";
      }')
      # Color the burn-rate arrow: up/surplus green, mild deficit orange, hard deficit red.
      case "$ind" in
        "↑"|"↗") ind="${GREEN}${ind}${RESET}" ;;
        "↘")     ind="${ORANGE}${ind}${RESET}" ;;
        "↓")     ind="${RED}${ind}${RESET}" ;;
      esac
    fi
  fi
  pct_part="${left}%${ind}"
  if [ -n "$dur" ]; then
    body="${pct_part} left • ${dur}"
  else
    body="${pct_part} left"
  fi
  if [ "$left" -lt 5 ]; then
    body="${RED}${body}${RESET}"
  elif [ "$left" -lt 15 ]; then
    body="${ORANGE}${body}${RESET}"
  fi
  five_str="${body}"
  out="$out | $five_str"
fi

# Session spend, broken down as: last turn + session total, each with its token count.
# cost.total_cost_usd is authoritative (matches /usage "Total cost", incl. subagents) but
# is only a running session total; the transcript has no per-message cost (costUSD is null).
# So the last turn's cost is tracked as the delta of the session total since the turn began,
# and the last turn's tokens are summed from the transcript's assistant messages after the
# most recent user prompt. Tokens are deduped by requestId (streaming logs the same usage
# on several lines per API request, so a naive sum over-counts ~2-3x).
abbr_tok() {
  t=$1
  if [ "$t" -ge 1000000 ] 2>/dev/null; then
    printf '%.2fM' "$(echo "$t / 1000000" | bc -l)"
  elif [ "$t" -ge 1000 ] 2>/dev/null; then
    printf '%.0fK' "$(echo "$t / 1000" | bc -l)"
  else
    printf '%s' "$t"
  fi
}

# Format seconds-since-the-turn-ended as " <rel> ago" (leading space included):
#   <60s -> "Ns" (ticks 1s,2s,3s...), <60m -> "Nm", <24h -> "Nh", else "Nd".
# Goes orange past the ~5min prompt-cache TTL, but ONLY when the context is big
# (>=100K tokens) — only then is the post-TTL uncached re-send of your next
# message expensive enough to warn about. Uses global $used_tokens, ORANGE, RESET.
# Echoes nothing for empty/invalid input.
fmt_age() {
  _secs=$1
  case "$_secs" in ''|*[!0-9]*) return 0 ;; esac
  _mins=$((_secs / 60))
  if [ "$_mins" -lt 1 ]; then
    _rel="${_secs}s"
  elif [ "$_mins" -lt 60 ]; then
    _rel="${_mins}m"
  else
    _h=$((_mins / 60))
    if [ "$_h" -lt 24 ]; then _rel="${_h}h"; else _rel="$((_h / 24))d"; fi
  fi
  _age="${_rel} ago"
  if [ "$_mins" -ge 5 ] && [ "${used_tokens:-0}" -ge 100000 ] 2>/dev/null; then
    _age="${ORANGE}${_age}${RESET}"
  fi
  printf ' %s' "$_age"
}

cost=$(echo "$input" | jq -r '.cost.total_cost_usd // empty')
[ -n "$cost" ] || cost=0
tp=$(echo "$input" | jq -r '.transcript_path // empty')
spend_seg=""

if [ -n "$tp" ] && [ -f "$tp" ]; then
  tok_prog='
def utoks($u): ($u // {}) | ((.input_tokens//0)+(.output_tokens//0)+(.cache_read_input_tokens//0)+(.cache_creation_input_tokens//0));
def isprompt: (.type=="user") and (.isSidechain!=true) and (.isMeta!=true)
  and (((.message.content|type)=="string")
       or (((.message.content|type)=="array") and ((.message.content|map(.type)|index("tool_result"))==null)));
. as $all
| ([ range(0; ($all|length)) as $i | select($all[$i]|isprompt) | $i ] | last) as $lu
| ([ range(0; ($all|length)) as $i | select($all[$i].type=="assistant" and ($all[$i].isSidechain != true)) | $i ] | last) as $lastA
| ($lastA != null
   and (($all[$lastA].message.stop_reason // "") != "tool_use")
   and ([ range(($lastA + 1); ($all|length)) as $j
          | select($all[$j].type=="user" and ($all[$j].isSidechain != true) and ($all[$j].isMeta != true)) ] | length) == 0
  ) as $idle
| ([ $all[] | select(.type=="assistant" and .requestId!=null) ] | group_by(.requestId) | map(utoks(.[0].message.usage)) | add // 0) as $total
| ([ ($all[ (($lu // -1)+1) : ])[] | select(.type=="assistant" and .requestId!=null) ] | group_by(.requestId) | map(utoks(.[0].message.usage)) | add // 0) as $turn
| (if $lu==null then "" else ($all[$lu].uuid // "") end) as $lu_uuid
| ([ $all[] | select(.type=="assistant" and (.isSidechain != true)) | .timestamp // empty ] | last) as $last_ts
| "\($total)\t\($turn)\t\($lu_uuid)\t\($last_ts // "")\t\(if $idle then 1 else 0 end)"'
  sid=$(basename "$tp" .jsonl)
  # The jq -s above slurps the ENTIRE transcript (often multi-MB) — far too
  # costly to re-run on every 1s idle refresh. Cache its single-line output and
  # reuse it while the transcript file is untouched (same mtime); any new
  # message bumps the mtime and forces a fresh parse. This keeps
  # refreshInterval=1 cheap so the idle "N ago" clock can tick per-second.
  cache="/tmp/claude-statusline-cache-${sid}.txt"
  mtime=$(stat -f %m "$tp" 2>/dev/null)
  cached_mtime=""; tok_line=""
  if [ -f "$cache" ]; then
    cached_mtime=$(sed -n '1p' "$cache")
    tok_line=$(sed -n '2p' "$cache")
  fi
  if [ -z "$tok_line" ] || [ "$cached_mtime" != "$mtime" ]; then
    tok_line=$(jq -s -r "$tok_prog" "$tp" 2>/dev/null)
    printf '%s\n%s\n' "$mtime" "$tok_line" > "$cache"
  fi
  total_tok=$(printf '%s' "$tok_line" | cut -f1)
  turn_tok=$(printf '%s' "$tok_line" | cut -f2)
  last_user=$(printf '%s' "$tok_line" | cut -f3)
  last_ts=$(printf '%s' "$tok_line" | cut -f4)
  idle=$(printf '%s' "$tok_line" | cut -f5)
  [ -n "$total_tok" ] || total_tok=0
  [ -n "$turn_tok" ] || turn_tok=0

  # Track the cost delta for the current turn in a per-session state file.
  state="/tmp/claude-statusline-turn-${sid}.txt"
  prev_uuid=""; base=""; prev_turn_cost=""
  if [ -f "$state" ]; then
    prev_uuid=$(sed -n '1p' "$state")
    base=$(sed -n '2p' "$state")
    prev_turn_cost=$(sed -n '3p' "$state")
  fi
  if [ "$prev_uuid" != "$last_user" ] || [ -z "$base" ]; then
    # New user prompt => the turn that just finished becomes the "previous
    # turn". Snapshot its cost (cost - old base) before rolling the baseline
    # forward, so the brief window before the new turn's usage lands can keep
    # showing the previous turn's number instead of flashing $0.00.
    if [ -n "$base" ]; then
      prev_turn_cost=$(echo "$cost - $base" | bc -l)
      [ "$(echo "$prev_turn_cost < 0" | bc -l)" = "1" ] && prev_turn_cost=0
    fi
    base="$cost"
    printf '%s\n%s\n%s\n' "$last_user" "$cost" "$prev_turn_cost" > "$state"
  fi
  turn_cost=$(echo "$cost - $base" | bc -l)
  if [ "$(echo "$turn_cost < 0" | bc -l)" = "1" ]; then turn_cost=0; fi
  [ -n "$prev_turn_cost" ] || prev_turn_cost=0

  # Fallback idle/age from the transcript's stop_reason + last-message timestamp.
  # Used only until the Stop hook has run on this session (the hook state in the
  # shared block below is authoritative once present).
  fb_idle="$idle"
  fb_age_secs=""
  if [ -n "$last_ts" ]; then
    ts_clean=${last_ts%%.*}; ts_clean=${ts_clean%Z}
    ts_epoch=$(date -j -u -f "%Y-%m-%dT%H:%M:%S" "$ts_clean" +%s 2>/dev/null)
    if [ -n "$ts_epoch" ]; then
      _now=$(date +%s); fb_age_secs=$((_now - ts_epoch)); [ "$fb_age_secs" -lt 0 ] && fb_age_secs=0
    fi
  fi
  spend_ready=1
elif [ -n "$cost" ]; then
  # === No readable transcript. Claude Code 2.1.x stores some sessions in a
  # per-session directory and still hands the status line a "<id>.jsonl" path
  # that doesn't exist, and there's no documented way to find the real one. With
  # no stop_reason we infer turn state from the COST CLOCK: total_cost_usd rises
  # while the agent works and goes flat between turns, and refreshInterval=1
  # re-runs us every second. So cost flat for >= IDLE_GRACE seconds => idle, and
  # the age is the time since cost last moved (~ when the turn ended). Only a flat
  # stretch over NEW_TURN_GAP rolls the baseline to a genuinely new turn, so a
  # tool/think pause mid-turn doesn't split one turn's cost in two.
  # Caveat (accepted): a long mid-turn step with no API billing (cost flat) can
  # briefly read as "previous turn" + a ticking age; it snaps back when cost moves.
  IDLE_GRACE=3          # seconds of flat cost before we call it idle
  NEW_TURN_GAP=30       # flat-cost gap that marks a real new user turn
  state="/tmp/claude-statusline-heur-${session_id:-default}.txt"
  now=$(date +%s)
  # State lines: 1) cost-last-changed epoch  2) turn baseline cost
  #              3) previous turn's cost      4) cost at the previous render
  change_epoch=""; turn_base=""; prev_turn_cost=""; prev_cost=""
  if [ -f "$state" ]; then
    change_epoch=$(sed -n '1p' "$state")
    turn_base=$(sed -n '2p' "$state")
    prev_turn_cost=$(sed -n '3p' "$state")
    prev_cost=$(sed -n '4p' "$state")
  fi
  case "$change_epoch" in ''|*[!0-9]*) change_epoch="" ;; esac
  if [ -z "$turn_base" ] || [ -z "$change_epoch" ] || [ -z "$prev_cost" ]; then
    # First render (or migrating from an older state file): start a turn here.
    turn_base="$cost"; change_epoch="$now"; prev_cost="$cost"
    [ -n "$prev_turn_cost" ] || prev_turn_cost=0
  elif [ "$(echo "$cost != $prev_cost" | bc -l)" = "1" ]; then
    # Cost moved. If it had been flat long enough to be a genuine new turn, roll
    # the baseline forward (the just-finished turn becomes the "previous turn").
    if [ "$((now - change_epoch))" -ge "$NEW_TURN_GAP" ]; then
      prev_turn_cost=$(echo "$prev_cost - $turn_base" | bc -l)
      [ "$(echo "$prev_turn_cost < 0" | bc -l)" = "1" ] && prev_turn_cost=0
      turn_base="$prev_cost"
    fi
    change_epoch="$now"
  fi
  [ -n "$prev_turn_cost" ] || prev_turn_cost=0
  printf '%s\n%s\n%s\n%s\n' "$change_epoch" "$turn_base" "$prev_turn_cost" "$cost" > "$state"

  turn_cost=$(echo "$cost - $turn_base" | bc -l)
  [ "$(echo "$turn_cost < 0" | bc -l)" = "1" ] && turn_cost=0
  secs_idle=$((now - change_epoch)); [ "$secs_idle" -lt 0 ] && secs_idle=0
  if [ "$secs_idle" -ge "$IDLE_GRACE" ]; then fb_idle=1; else fb_idle=0; fi
  fb_age_secs="$secs_idle"
  spend_ready=1
fi

# --- Idle + age (shared): prefer Claude Code's lifecycle hooks (Stop /
#     UserPromptSubmit, written by ~/.claude/hooks/turn-state.sh), which mark turn
#     boundaries reliably for EVERY storage format. The status-line JSON has no
#     live "is the agent thinking?" signal, and new-format sessions have no
#     readable transcript — so the hook state is authoritative whenever it exists.
#     The per-branch signal (transcript stop_reason / cost heuristic) is only a
#     fallback until this session's first Stop hook has run.
if [ -n "$spend_ready" ]; then
  now=$(date +%s)
  idle="$fb_idle"; age_secs="$fb_age_secs"
  hookstate="/tmp/claude-turn-${session_id:-default}.state"
  if [ -f "$hookstate" ]; then
    hstate=$(sed -n '1p' "$hookstate"); hts=$(sed -n '2p' "$hookstate")
    case "$hstate" in
      # Keep age_secs (the fallback "time since last activity") ticking even while
      # working, so the "<age> ago" clock keeps running through the window right
      # after you hit Enter — until this turn's first cost actually lands.
      working) idle=0 ;;
      idle)    idle=1; case "$hts" in ''|*[!0-9]*) ;; *) age_secs=$((now - hts)); [ "$age_secs" -lt 0 ] && age_secs=0 ;; esac ;;
    esac
  fi
  # Displayed cost + label. The switch is driven by whether the CURRENT turn has
  # actually billed yet (turn_cost>0), NOT merely by "am I working":
  #   working AND the current turn has cost -> live figure with a one-char
  #     ellipsis + "current" label ($0.69… current); it's still adding up.
  #   otherwise (idle, OR you just hit Enter and no cost has come back yet) ->
  #     the PREVIOUS turn's figure with a ticking "<age> ago" and NO label — the
  #     "ago" already says it's the last turn. So hitting Enter does NOT flip to
  #     "current"; it stays on "$X.XX <age> ago" until real cost data arrives.
  if [ "$idle" != "1" ] && [ "$(echo "$turn_cost > 0" | bc -l)" = "1" ]; then
    turn_money=$(printf '$%.2f…' "$turn_cost")
    turn_suffix=" current"
  else
    # idle after a finished turn -> that turn's cost is in turn_cost; just after
    # Enter (turn_cost==0) -> fall back to the previous turn's cost.
    if [ "$(echo "$turn_cost > 0" | bc -l)" = "1" ]; then disp_cost="$turn_cost"; else disp_cost="$prev_turn_cost"; fi
    turn_money=$(printf '$%.2f' "$disp_cost")
    age_str=""
    [ -n "$age_secs" ] && age_str=$(fmt_age "$age_secs")
    turn_suffix="$age_str"
  fi
  total_money=$(awk -v c="$cost" 'BEGIN{printf "$%d", int(c)}')
  spend_seg="${turn_money}${turn_suffix} • ${total_money} 💸"
fi

if [ -n "$spend_seg" ] && [ "$(printf '%.2f' "$cost")" != "0.00" ]; then
  out="$out | $spend_seg"
fi

# Optional: git worktree name. Only shown when the current dir is inside a
# *linked* worktree (git's git-dir lives under .git/worktrees/<name>), not the
# main working tree.
dir=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // empty')
if [ -n "$dir" ] && [ -d "$dir" ]; then
  gitdir=$(git -C "$dir" rev-parse --absolute-git-dir 2>/dev/null)
  case "$gitdir" in
    */worktrees/*)
      wt=$(basename "$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null)")
      [ -n "$wt" ] && out="$out | 🌿 $wt"
      ;;
  esac
fi

echo "$out"
```

---

*Maintained by Victor. The canonical script is global (`~/.claude/`); this file
documents it **and embeds a verbatim copy** (above), so the whole thing ships
with the repo. Keep them in lockstep — a behaviour change must update the script,
this documentation, and the embedded copy in the same change (see the rule in the
script header).*
