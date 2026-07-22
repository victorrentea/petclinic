# Victor's Copilot CLI status line

A rich one-line status bar for **GitHub Copilot CLI**. Example:

```
🤖 opus-4.8 · high · 55K/1M | 6759 AIC (96%)↗ left | for 7d 4h
```

Three ` | `-separated segments:

1. **model · effort · context** — model name (the `claude-` prefix stripped),
   reasoning effort, and **used/limit** context tokens. The used-token count
   turns **yellow ≥65%** and **red ≥95%** of the window. The `(%)` is shown only
   when the window isn't the full 1M.
2. **AI Credits** — credits remaining + `(% left)`, followed by a colored
   **consumption-trend arrow** comparing how much credit is left against how much
   **working time** (Mon–Fri) is left in the billing month.
3. **reset** — **working** days + hours until the monthly quota resets (weekends
   excluded).

---

## TL;DR — let your Copilot CLI configure itself

From a repo that contains this file, run `copilot` and paste:

> Read `.github/victor-copilot-statusline.md` and set me up an identical Copilot
> CLI status line. Create `~/.copilot/statusline.sh` and `~/.copilot/quota-refresh.sh`
> exactly as in the doc, `chmod +x` both, prime the cache by running
> `bash ~/.copilot/quota-refresh.sh`, and add the `statusLine` block to
> `~/.copilot/settings.json` (merge with existing JSON, don't clobber it).
> Then verify by piping a sample JSON payload into `statusline.sh`.

**Prerequisites:** `bash`, `python3`, and the `gh` CLI authenticated
(`gh auth status`) with a Copilot subscription.

---

## Anatomy of the data

Copilot CLI feeds the status-line command a JSON payload **on stdin** each render.
The fields we use:

| Field | Used for |
|-------|----------|
| `model.display_name` (e.g. `claude-opus-4.8 · high · 1M context`) | model · effort segment |
| `context_window.current_context_tokens` | used tokens |
| `context_window.displayed_context_limit` | window size |

The **monthly AI-Credit balance and reset date are NOT in that payload.** They
come from `gh api copilot_internal/user`, cached to `~/.copilot/quota-cache.json`
and refreshed in the background (max once / 15 min) so rendering stays instant.
The relevant snapshot is `quota_snapshots.premium_interactions`
(`remaining`, `percent_remaining`) plus `reset_utc` / `reset_date`.

---

## File 1 — `~/.copilot/statusline.sh`

```bash
#!/usr/bin/env bash
# Copilot CLI status line. Example output:
#   🤖 opus-4.8 · high · 55K/1M | 6759 AIC (96%)↗ left | for 7d 4h
#
#   • model: display_name with the "claude-" prefix stripped; the " · N context"
#     tail is replaced by "<used>/<limit>" context tokens (used count coloured
#     yellow ≥65% / red ≥95% of the window; % shown only when window isn't 1M).
#   • AI Credits: remaining credits + % left, with a consumption-trend arrow
#     (↑↗ green surplus / none on-track / ↘ yellow / ↓ red burning too fast),
#     comparing AIC-left vs WORKING-time-left in the billing period.
#   • reset: WORKING days + hours until the monthly quota resets (weekends out).
#
# Copilot CLI pipes the session status as JSON on stdin; we print one line to
# stdout. The monthly AI-Credit balance and reset date are NOT in that payload,
# so they come from a small cache refreshed in the background by quota-refresh.sh
# from `gh api copilot_internal/user`. See victor-copilot-statusline.md.
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
CACHE="$HOME/.copilot/quota-cache.json"
TTL=60    # refresh the quota cache at most once per minute (keeps AIC current)

INPUT="$(cat 2>/dev/null)"

# --- refresh the monthly-quota cache in the background when stale (non-blocking) --
now=$(date +%s 2>/dev/null || echo 0)
file_mtime() { stat -f %m "$1" 2>/dev/null || stat -c %Y "$1" 2>/dev/null || echo 0; }
cmtime=0; [ -f "$CACHE" ] && cmtime=$(file_mtime "$CACHE")
lock="$CACHE.lock"; lmtime=0; [ -f "$lock" ] && lmtime=$(file_mtime "$lock")
if [ "$(( now - cmtime ))" -ge "$TTL" ] && [ "$(( now - lmtime ))" -ge "$TTL" ]; then
  : > "$lock" 2>/dev/null || true           # stampede guard: one refresh per TTL
  [ -f "$DIR/quota-refresh.sh" ] && nohup bash "$DIR/quota-refresh.sh" "$CACHE" >/dev/null 2>&1 &
fi

python3 - "$INPUT" "$CACHE" <<'PY'
import sys, json

raw   = sys.argv[1] if len(sys.argv) > 1 else ""
cache = sys.argv[2] if len(sys.argv) > 2 else ""
try:
    d = json.loads(raw) if raw.strip() else {}
except Exception:
    print("🤖 copilot"); sys.exit(0)

def find(obj, *names):
    """First value (by NAME priority) for any of `names`, searched recursively."""
    for name in names:
        stack = [obj]
        while stack:
            cur = stack.pop()
            if isinstance(cur, dict):
                if name in cur and not isinstance(cur[name], (dict, list)):
                    return cur[name]
                stack.extend(cur.values())
            elif isinstance(cur, list):
                stack.extend(cur)
    return None

def human(n):
    try: n = float(n)
    except (TypeError, ValueError): return None
    if n >= 1_000_000: return f"{n/1_000_000:.0f}M" if n % 1_000_000 == 0 else f"{n/1_000_000:.1f}M"
    if n >= 1_000:     return f"{n/1_000:.0f}K"
    return f"{n:.0f}"

# ANSI colours (used-token count, consumption-trend arrow) — mirrors victor-claude-statusline.md
CLR_RESET = "\033[0m"
CLR_RED   = "\033[31m"
CLR_YEL   = "\033[38;5;208m"
CLR_GRN   = "\033[38;5;78m"

parts = []

# --- model · effort · context-usage --------------------------------------
# display_name looks like "claude-opus-4.8 · high · 1M context"; we strip the
# "claude-" prefix and replace the " · <N> context" tail with used/limit tokens.
model = find(d, "display_name", "displayName") or find(d, "id", "model") or "copilot"
if isinstance(model, str):
    if model.lower().startswith("claude-"):
        model = model[len("claude-"):]
    used  = find(d, "current_context_tokens", "currentContextTokens")
    limit = find(d, "displayed_context_limit", "displayedContextLimit",
                 "context_window_size", "contextWindowSize")
    if used is not None and limit is not None:
        try: upct = 100.0 * float(used) / float(limit)
        except (TypeError, ValueError, ZeroDivisionError): upct = None
        used_lbl = human(used)
        if upct is not None:            # colour the used-token count as the window fills
            if   upct >= 95: used_lbl = f"{CLR_RED}{used_lbl}{CLR_RESET}"
            elif upct >= 65: used_lbl = f"{CLR_YEL}{used_lbl}{CLR_RESET}"
        ctx = f"{used_lbl}/{human(limit)}"
        if human(limit) != "1M" and upct is not None:  # show % only when window isn't the full 1M
            ctx += f" ({upct:.0f}%)"
        kept = [p for p in model.split(" · ") if "context" not in p.lower()]
        model = " · ".join(kept + [ctx])
parts.append(f"🤖 {model}")

# --- AI Credits remaining, consumption-trend arrow, working-days to reset --
q = {}
try:
    with open(cache) as f:
        q = json.load(f)
except Exception:
    q = {}

from datetime import datetime, timezone, timedelta

reset = q.get("reset_utc") or q.get("reset_date")
reset_dt = None
if reset:
    try:
        reset_dt = datetime.fromisoformat(str(reset).replace("Z", "+00:00"))
        if reset_dt.tzinfo is None:
            reset_dt = reset_dt.replace(tzinfo=timezone.utc)
    except Exception:
        reset_dt = None

def working_seconds(a, b):
    """Seconds in [a, b) that fall on weekdays (Sat/Sun excluded)."""
    total, cur = 0.0, a
    while cur < b:
        nxt = datetime(cur.year, cur.month, cur.day, tzinfo=timezone.utc) + timedelta(days=1)
        seg = min(nxt, b)
        if cur.weekday() < 5:
            total += (seg - cur).total_seconds()
        cur = seg
    return total

snaps = q.get("quota_snapshots") or {}
snap = snaps.get("premium_interactions")
if not snap:
    for s in snaps.values():
        if isinstance(s, dict) and s.get("has_quota") and not s.get("unlimited") \
           and (s.get("entitlement") or 0) > 0:
            snap = s
            break

if isinstance(snap, dict):
    if snap.get("unlimited"):
        parts.append("∞ AIC left")
    else:
        rem = snap.get("remaining")
        pr  = snap.get("percent_remaining")
        seg = f"{int(rem)} AIC" if rem is not None else "AIC"
        if pr is not None:
            seg += f" ({pr:.0f}%)"
        # consumption-trend arrow: AIC-remaining fraction vs working-time-remaining
        # fraction over the billing period (bands mirror victor-claude-statusline.md).
        arrow, now = "", datetime.now(timezone.utc)
        if pr is not None and reset_dt and reset_dt > now:
            ps = datetime(reset_dt.year if reset_dt.month > 1 else reset_dt.year - 1,
                          reset_dt.month - 1 if reset_dt.month > 1 else 12, 1,
                          tzinfo=timezone.utc)
            total_w, left_w = working_seconds(ps, reset_dt), working_seconds(now, reset_dt)
            if total_w > 0 and left_w > 0:
                r = (pr / 100.0) / (left_w / total_w)
                if   r >= 1.5:  arrow, c = "↑", CLR_GRN
                elif r >= 1.15: arrow, c = "↗", CLR_GRN
                elif r >= 0.87: arrow, c = "",  ""
                elif r >= 0.67: arrow, c = "↘", CLR_YEL
                else:           arrow, c = "↓", CLR_RED
                if arrow:
                    arrow = f"{c}{arrow}{CLR_RESET}"
        parts.append(f"{seg}{arrow} left")

# --- working days + hours until the reset (weekends excluded) -------------
if reset_dt:
    now  = datetime.now(timezone.utc)
    secs = int((reset_dt - now).total_seconds())
    if secs > 0:
        dd, hh = secs // 86400, (secs % 86400) // 3600
        wd = sum(1 for i in range(dd) if (now + timedelta(days=i)).weekday() < 5)
        parts.append(f"for {wd}d {hh}h" if wd else f"for {hh}h")

print(" | ".join(parts))
PY
```

## File 2 — `~/.copilot/quota-refresh.sh`

Fetches the monthly quota snapshot into the cache the status line reads. Called
detached by `statusline.sh`, and safe to run standalone to prime the cache.

```bash
#!/usr/bin/env bash
# Fetch the user's Copilot monthly-quota snapshot into a small cache file that
# statusline.sh reads. Called detached (in the background) by statusline.sh, and
# safe to run standalone:  bash quota-refresh.sh [cache-path]
#
# Source: the `copilot_internal/user` endpoint the Copilot CLI itself uses for
# the footer budget. It is undocumented — field names may change across versions.
# We store only the quota-relevant fields (no account identifiers).
set -u
CACHE="${1:-$HOME/.copilot/quota-cache.json}"

command -v gh >/dev/null 2>&1 || exit 0

tmp="$CACHE.$$.tmp"
if gh api copilot_internal/user \
     --jq '{plan: .copilot_plan, reset_utc: .quota_reset_date_utc, reset_date: .quota_reset_date, quota_snapshots: .quota_snapshots}' \
     >"$tmp" 2>/dev/null && [ -s "$tmp" ]; then
  mv "$tmp" "$CACHE"
else
  rm -f "$tmp" 2>/dev/null || true
fi
```

## File 3 — wire it into `~/.copilot/settings.json`

Merge this key into your existing `settings.json` (keep your other settings):

```json
{
  "statusLine": {
    "type": "command",
    "command": "bash ~/.copilot/statusline.sh"
  }
}
```

---

## Manual install (if you'd rather not delegate)

```sh
# 1. Save File 1 and File 2 to ~/.copilot/, then:
chmod +x ~/.copilot/statusline.sh ~/.copilot/quota-refresh.sh

# 2. Prime the AI-Credit cache (needs `gh` logged in):
bash ~/.copilot/quota-refresh.sh

# 3. Add the statusLine block to ~/.copilot/settings.json (see File 3).

# 4. Smoke-test the renderer with a fake payload:
echo '{"model":{"display_name":"claude-opus-4.8 · high · 1M context"},
       "context_window":{"current_context_tokens":54546,"displayed_context_limit":1000000}}' \
  | bash ~/.copilot/statusline.sh
```

Restart Copilot CLI (or start a new session) to see the bar.

---

## Design notes

### Consumption-trend arrow

`r = (aic_percent_remaining / 100) / (working_time_left / working_time_total)`
over the current billing month (period start = 1st of the reset month's previous
month; weekends contribute zero time). Bands are reciprocal-symmetric:

| ratio `r` | meaning | arrow | color |
|-----------|---------|-------|-------|
| ≥ 1.5 | far more credit than time — big surplus | `↑` | green |
| 1.15 – 1.5 | more credit than time | `↗` | green |
| 0.87 – 1.15 | on track | *(none)* | — |
| 0.67 – 0.87 | less credit than time | `↘` | yellow |
| < 0.67 | burning too fast | `↓` | red |

### Used-token color thresholds

Based on `used/limit`: **≥95% → red**, **≥65% → yellow**, else default.

### Working-days countdown

`for Nd Hh` counts only Mon–Fri days between now and the reset instant; the `Hh`
is the leftover hours of the partial day.

---

## Customizing

- **Colors:** edit the `CLR_*` ANSI codes near the top of the Python block.
- **Thresholds:** change `65`/`95` (token colors) or the arrow ratio bands.
- **Emojis / labels:** the `parts.append(...)` calls build each segment.
- **Not on AI-Credit billing?** The `premium_interactions` snapshot still carries
  `remaining`/`percent_remaining`; the same code renders premium-request quotas.

## Troubleshooting

- **You see raw escape codes** (`^[[38;5;...`) instead of colors → your terminal
  or CLI build isn't rendering ANSI in the status line; delete the `CLR_*` usages
  (or set them to `""`) for a plain bar.
- **AIC segment missing** → run `gh auth status`; then `bash ~/.copilot/quota-refresh.sh`
  and inspect `~/.copilot/quota-cache.json`.
- **Nothing shows at all** → confirm `settings.json` has the `statusLine` block and
  that `python3` is on PATH.

> Companion doc: `.claude/victor-claude-statusline.md` (the Claude Code original
> this Copilot port is inspired by).
