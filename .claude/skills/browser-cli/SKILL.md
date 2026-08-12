---
name: browser-cli
description: Drive a real browser from the shell with Playwright CLI - open pages, click, fill forms, read the DOM, screenshot, inspect console and network. Use whenever a task needs a live browser (reproduce a UI bug, verify a frontend change, check a page renders, log into a site, scrape a page) AND no browser MCP tools are available (no mcp__playwright__*, no mcp__claude-in-chrome__*). Also use when explicitly asked to "use the browser-cli skill".
allowed-tools: Bash(playwright-cli:*), Bash(npx:*), Bash(npm:*)
---

# Browser automation without MCP

`playwright-cli` is a stateful browser driver you call as ordinary shell commands.
One browser session stays alive **between** commands, so you drive it one step at a
time and read the page after each step — the same loop a browser MCP gives you, but
over Bash.

## 0. Make sure the CLI exists

```bash
playwright-cli --version || npm install -g @playwright/cli@latest
```

## 1. The core loop

```bash
playwright-cli open http://localhost:4200   # starts the browser + navigates
playwright-cli snapshot                     # read the page, get element refs (e12, f1e56, ...)
playwright-cli click e15                    # act, using a ref from the snapshot
playwright-cli close                        # always close when done
```

Every command prints the page URL, title, and a fresh **snapshot** — an accessibility
tree where each element carries a `[ref=...]`. **Refs are how you target elements.**
Take a `snapshot` first; never guess a ref.

Snapshots are written to `$PLAYWRIGHT_MCP_OUTPUT_DIR/page-<timestamp>.yml` — this repo
pins that to `/tmp/playwright-cli` in `.claude/settings.json` so the scratch files never
land in the working tree. Long
pages print only the file path — `cat` it, or better, search it:

```bash
playwright-cli find "Add Visit"       # grep-like search over the snapshot, with context
playwright-cli find --regex "/sign (in|up)/i"
```

## 2. Interacting

```bash
playwright-cli fill e56 "hello"            # set an input's value
playwright-cli fill e56 "hello" --submit   # fill, then press Enter
playwright-cli type "some text"            # type into the focused element
playwright-cli click e15
playwright-cli select e9 "option-value"
playwright-cli check e12                   # / uncheck
playwright-cli press Enter                 # / ArrowDown, Tab, Escape...
playwright-cli goto http://localhost:4200/some/route
playwright-cli reload                      # / go-back / go-forward
```

Besides refs, you can target with a CSS selector or a Playwright locator:

```bash
playwright-cli click "#submit-btn"
playwright-cli click "getByRole('button', { name: 'Save' })"
```

## 3. Reading state

```bash
playwright-cli --raw eval "document.title"          # run JS on the page
playwright-cli --raw eval "el => el.value" e56      # run JS on one element
playwright-cli screenshot --filename=bug.png
playwright-cli console                              # console messages
playwright-cli requests                             # network log, numbered
playwright-cli response-body 3                      # body of request #3
```

`--raw` strips the status/snapshot chrome and prints only the result — use it whenever
you want to pipe or read a single value. Reach for `eval` when the answer isn't visible
in the snapshot (an input's real value, a CSS class, a validation state).

## 4. Sessions

Commands share one session named `default`. Use `-s=<name>` for a second, independent
browser (e.g. two logged-in users). Sessions outlive your shell, so **clean up**:

```bash
playwright-cli -s=admin open http://localhost:4200
playwright-cli list          # what's running
playwright-cli close-all     # close every session
playwright-cli kill-all      # force-kill stale/zombie processes
```

## Gotchas

- **Snapshot before every interaction that follows a page change.** Refs are
  regenerated on navigation (they gain a frame prefix, e.g. `f1e56`); a stale ref fails.
- **A disabled button means the form is invalid, not that the click failed.** Check with
  `find` and diagnose with `eval` before assuming a bug.
- **Angular/React inputs**: `fill` dispatches real input events, so frameworks pick it
  up — but the value must be in the format the widget parses (e.g. `2024-07-20`, not
  `2024/07/20`, for a Material datepicker), otherwise the control silently goes invalid.
- Scratch output (snapshots, console logs, screenshots) goes to
  `$PLAYWRIGHT_MCP_OUTPUT_DIR` (`/tmp/playwright-cli` here) — never into the repo.

## Deeper reference

The full upstream skill (network mocking, storage/auth state, tracing, video, test
generation, running raw Playwright code) ships inside the package:

```bash
ls "$(npm root -g)/@playwright/cli/skills/playwright-cli/references/"
playwright-cli --help            # every command
playwright-cli --help <command>  # options for one command
```
