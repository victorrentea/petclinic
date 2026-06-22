# Prompt-cache-expiry alerts via hooks — lessons

Goal: when Claude finishes a turn and starts waiting, nudge the user before the
**5-minute prompt-cache TTL** lapses (real target ~270s / 4m30s), and cancel the
nudge if they reply in time. Built and validated this, then reverted on request.

## What worked

- **Events:** arm on `Stop` *and* `Notification` (covers "turn done", "asked a
  question", and permission prompts). Cancel on `UserPromptSubmit`.
- **Immediate message:** the `Stop` hook prints it by emitting JSON on stdout:
  `{"systemMessage":"…","suppressOutput":true}`. This renders in the TUI.
- **Detached timer:** the hook must return instantly or it blocks the turn. Run
  the delayed action in a background subshell with fds detached so Claude Code
  sees stdout EOF and doesn't wait on it:
  `( sleep "$DELAY"; … ) </dev/null >/dev/null 2>&1 & disown`
- **Cancellation via a token file, not PID-killing.** Each arm writes a fresh
  token (`$(date +%s)-$$`) to `/tmp/…token`; the timer beeps only if the token
  still matches when it wakes; `UserPromptSubmit` overwrites the token to cancel.
  Avoids fragile process-group `kill` (orphaned `sleep` children etc.).

## Gotchas

- **macOS has no `setsid`** — use `( … ) & disown` with redirected fds instead.
- **`osascript display notification` banners are silently dropped** if the
  terminal app lacks Notification permission (System Settings → Notifications).
  They no-error but never appear. **Unreliable.**
- **`osascript display dialog … giving up after N` is reliable** and
  self-dismissing — a modal that always shows and auto-closes after N seconds.
  Trade-off: it steals focus. This is what actually worked here.
- **Newly added hook *events* may not load mid-session.** The settings watcher
  picks up edits to a file that already had hooks, but adding a brand-new event
  key can need a `/hooks` reopen or restart.
- **Don't claim "verified" for sound/visual effects you can't perceive.** afplay
  exiting 0 ≠ the user heard it. Only the user can confirm a beep/dialog.
- **Sound was unwanted** here — `afplay /System/Library/Sounds/Glass.aiff` works,
  but the user disabled turn-completion sounds. Separate built-in chime is
  `preferredNotifChannel` (e.g. `terminal_bell`), not this hook.

## Recipe (settings.json `hooks`)

```jsonc
"Stop":         [{ "hooks": [{ "type":"command", "command":"~/.claude/hooks/cache-reminder-start.sh" }] }],
"Notification": [{ "hooks": [{ "type":"command", "command":"~/.claude/hooks/cache-reminder-start.sh" }] }],
"UserPromptSubmit": [{ "hooks": [{ "type":"command", "command":"~/.claude/hooks/cache-reminder-cancel.sh" }, /* …existing… */ ] }]
```

`cache-reminder-start.sh` (delay configurable; 5 to test, 270 for real):
```bash
#!/usr/bin/env bash
DELAY="${CLAUDE_CACHE_REMINDER_DELAY:-270}"
TOKENFILE="/tmp/claude-cache-reminder.token"
TOKEN="$(date +%s)-$$"; echo "$TOKEN" > "$TOKENFILE"
( sleep "$DELAY"
  if [ "$(cat "$TOKENFILE" 2>/dev/null)" = "$TOKEN" ]; then
    osascript -e 'display dialog "Prompt cache about to expire — reply to keep it warm." with title "Cache reminder" buttons {"OK"} default button "OK" giving up after 30' >/dev/null 2>&1
  fi
) </dev/null >/dev/null 2>&1 & disown
printf '{"systemMessage":"⏳ Waiting — cache reminder armed (%ss).","suppressOutput":true}\n' "$DELAY"
```

`cache-reminder-cancel.sh`:
```bash
#!/usr/bin/env bash
echo "cancelled-$(date +%s)-$$" > /tmp/claude-cache-reminder.token 2>/dev/null
```
