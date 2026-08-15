#!/usr/bin/env bash
# Film the feature working, in a real browser, for the review guide.
#
# The first version of this replayed the Playwright acceptance test and kept its video.
# That is the purer idea — the test IS the demo — but headless it finishes in ~1s and the
# retained .webm shows only the final assertion, which tells a reviewer nothing about the
# interaction. So this drives the flow through the same selectors the e2e suite uses,
# deliberately slowed, and records the whole thing: the point of the video is to be
# watched, and the test still guards the behaviour.
#
# It tours every page the change touched, not just the one where the feature is entered —
# a reviewer's next question after "does it work" is always "where else does this show up".
#
# Usage:
#   scripts/record-feature-video.sh <out.webm>
#
# Also writes <out>.cues.json: the narration, timestamped as the run happens, so the guide
# can caption the video with what is being done rather than leaving it silent.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"

OUT="${1:?usage: record-feature-video.sh <out.webm>}"
case "$OUT" in /*) ;; *) OUT="$ROOT/$OUT" ;; esac

BASE_URL="${BASE_URL:-http://localhost:4200}"
API_URL="${API_URL:-http://localhost:8080}"

curl -fsS -o /dev/null "$BASE_URL/" || { echo "[video] frontend not up at $BASE_URL" >&2; exit 2; }
curl -fsS -o /dev/null "$API_URL/api/pettypes" || { echo "[video] backend not up at $API_URL" >&2; exit 2; }

mkdir -p "$(dirname "$OUT")"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

NODE_PATH="$ROOT/petclinic-test/node_modules" node -e '
const {chromium} = require("playwright");
const [baseUrl, apiUrl, videoDir, out] = process.argv.slice(1);
const fs = require("fs");

(async () => {
  const owners = await (await fetch(apiUrl + "/api/owners")).json();
  const owner = owners.find(o => (o.pets || []).length > 0);
  if (!owner) throw new Error("no owner with a pet in the database");

  const browser = await chromium.launch({slowMo: 450});
  const context = await browser.newContext({
    baseURL: baseUrl,
    viewport: {width: 1280, height: 800},
    recordVideo: {dir: videoDir, size: {width: 1280, height: 800}},
  });
  const page = await context.newPage();

  // Recording starts with the page, so every cue is timed from here. The narration is
  // written as the run happens rather than guessed afterwards, so it can never drift
  // from what the video actually shows.
  const t0 = Date.now();
  const cues = [];
  const say = (text) => cues.push({t: (Date.now() - t0) / 1000, text});
  const pause = (ms) => page.waitForTimeout(ms);

  say("The owner’s page. Every pet lists its visits — and the list now has a Vet column.");
  await page.goto(`${baseUrl}/owners/${owner.id}`);
  await page.locator("h2:has-text(\"Owner Information\")").waitFor();
  await page.locator("th:has-text(\"Vet\")").first().scrollIntoViewIfNeeded();
  await pause(2600);

  say("Booking a new visit for the first pet.");
  await page.locator("button:has-text(\"Add Visit\"), a:has-text(\"Add Visit\")").first().click();
  await page.locator("input#description").waitFor();
  await pause(1200);

  say("Date and reason, as before — nothing here changed.");
  await page.locator("input[name=\"date\"]").fill("2026-09-15");
  const description = `Post-op check ${Date.now()}`;
  await page.locator("input#description").fill(description);
  await pause(1400);

  const vetSelect = page.locator("select#vetId");
  const realVets = vetSelect.locator("option:not([value$=\"null\"]):not([value=\"\"])");
  const vetName = (await realVets.first().textContent() || "").trim();
  say("This is the new part: a Vet dropdown. It defaults to “not assigned”, because a visit is allowed to have no vet.");
  await vetSelect.scrollIntoViewIfNeeded();
  await pause(2000);

  say(`Picking ${vetName} as the vet who attended.`);
  await vetSelect.selectOption({label: vetName});
  await pause(1800);

  say("Saving — the vet id travels with the visit and lands in the new vets column.");
  await page.locator("button[type=\"submit\"]:has-text(\"Add Visit\")").click();
  await page.locator("h2:has-text(\"Owner Information\")").waitFor();

  // Anchor on the row we just created, never on "any cell showing that vet name": the
  // sample data is full of other visits with the same vet, and matching one of those
  // would film a success the feature did not actually deliver.
  const newRow = page.locator("app-visit-list tr").filter({hasText: description}).first();
  await newRow.scrollIntoViewIfNeeded();
  await pause(2800);
  // If the vet did not come back, that is the story worth filming — narrate it rather than
  // letting the footage imply a success. The non-zero exit is what stops a broken run from
  // being embedded silently.
  const rowText = (await newRow.textContent() || "");
  const saved = rowText.includes(vetName);
  if (!saved) {
    say(`⚠ The visit came back with no vet — an em dash. Booking through the UI is NOT saving `
        + `the vet right now.`);
    await pause(3200);
  }

  if (saved) {
    say("Back on the owner’s page: the new visit is attributed to that vet. Older visits show an em dash — they never had one.");
  } else {
    say("The rows above that DO show a vet were written straight to POST /api/visits — that path still works.");
  }
  await pause(2400);

  // The Edit control lives in the per-pet visit list on the owner page, not on /visits.
  const editRow = page.locator("tr", {has: page.locator(`td:has-text("${vetName}")`)}).first();
  const editLink = editRow.locator("button:has-text(\"Edit Visit\"), a:has-text(\"Edit Visit\")").first();
  if (!(await editLink.count())) {
    throw new Error("no Edit Visit control on the owner page — the edit half went unfilmed");
  }
  say("Booking is not the only way in. Opening that visit for editing.");
  await editLink.click();
  const editSelect = page.locator("select#vetId");
  await editSelect.waitFor();
  await pause(2200);

  say("The saved vet comes back pre-selected — the read path works, not just the write path.");
  await editSelect.scrollIntoViewIfNeeded();
  await pause(2200);

  const options = (await editSelect.locator("option:not([value$=\"null\"]):not([value=\"\"])")
      .allTextContents()).map(t => t.trim());
  const other = options.find(t => t && t !== vetName);
  if (other) {
    say(`Reassigning to ${other}. Choosing “not assigned” here clears the vet again.`);
    await editSelect.selectOption({label: other});
    await pause(2600);
  }

  say("And the all-visits page, across every owner: same column, an em dash wherever no vet attended.");
  await page.goto(`${baseUrl}/visits`);
  await page.locator("th:has-text(\"Vet\")").first().waitFor();
  await pause(3000);

  say(saved ? "That is the whole feature: set a vet when booking, or change it afterwards."
            : "So: the edit path works, the booking path does not. See finding 1.");
  await pause(2600);

  await context.close();
  await browser.close();

  const webm = fs.readdirSync(videoDir).filter(f => f.endsWith(".webm"))
      .map(f => videoDir + "/" + f).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
  if (!webm) throw new Error("playwright produced no .webm");
  fs.copyFileSync(webm, out);
  fs.writeFileSync(out.replace(/\.webm$/, ".cues.json"), JSON.stringify(cues, null, 1));
  console.error(`[video] owner ${owner.id}, vet "${vetName}", ${cues.length} cues -> ${out}`);
  if (!saved) {
    console.error("[video] NOTE: booking did not persist the vet — the film says so out loud");
    process.exitCode = 3;
  }
})().catch(e => { console.error("[video] " + e.message); process.exit(1); });
' "$BASE_URL" "$API_URL" "$TMP" "$OUT"

if command -v ffprobe >/dev/null 2>&1; then
  echo "[video] $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")s, $(du -h "$OUT" | cut -f1)" >&2
fi
