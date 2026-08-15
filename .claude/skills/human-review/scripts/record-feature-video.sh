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
# Playwright does not record the mouse pointer, so raw footage never tells you WHERE the
# thing being narrated is. Each say() therefore takes the element it is about and stores
# its on-screen box on the cue; annotate-feature-video.py turns those into a spotlight and
# burns the narration into the frame. Coordinates are viewport-relative and the video is
# recorded at the viewport size, so they are frame pixels 1:1 — the run prints the
# devicePixelRatio and viewport it actually got, which is what makes that safe to assume.
#
# Usage:
#   .claude/skills/human-review/scripts/record-feature-video.sh <out.webm>
#
# Writes, next to <out.webm>:
#   <out>.cues.json  the narration, timestamped as the run happens (plus each cue's box),
#                    so the guide can build a transcript that seeks the player
#   <out>.raw.webm   the same film without the annotations
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"

OUT="${1:?usage: record-feature-video.sh <out.webm>}"
case "$OUT" in /*) ;; *) OUT="$ROOT/$OUT" ;; esac
RAW="${OUT%.webm}.raw.webm"
CUES="${OUT%.webm}.cues.json"

BASE_URL="${BASE_URL:-http://localhost:4200}"
API_URL="${API_URL:-http://localhost:8080}"

curl -fsS -o /dev/null "$BASE_URL/" || { echo "[video] frontend not up at $BASE_URL" >&2; exit 2; }
curl -fsS -o /dev/null "$API_URL/api/pettypes" || { echo "[video] backend not up at $API_URL" >&2; exit 2; }

mkdir -p "$(dirname "$OUT")"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

set +e
NODE_PATH="$ROOT/petclinic-test/node_modules" node -e '
const {chromium} = require("playwright");
const [baseUrl, apiUrl, videoDir, raw, cuesPath] = process.argv.slice(1);
const fs = require("fs");

(async () => {
  const owners = await (await fetch(apiUrl + "/api/owners")).json();
  const owner = owners.find(o => (o.pets || []).length > 0);
  if (!owner) throw new Error("no owner with a pet in the database");

  // The dev server answers on every path, but the Angular router only matches routes under
  // the <base href> the served index.html carries. Hardcoding "/" films an empty shell.
  const indexHtml = await (await fetch(baseUrl + "/")).text();
  const app = baseUrl + ((indexHtml.match(/<base href="([^"]*)"/) || [, "/"])[1])
      .replace(/\/$/, "");

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
  // A cue may name the element it is about. boundingBox() is viewport-relative, so it is
  // read at the moment the cue is spoken — after any scrolling — never earlier.
  const say = async (text, target) => {
    const cue = {t: (Date.now() - t0) / 1000, text};
    const box = target ? await target.boundingBox() : null;
    if (box) {
      cue.box = {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height),
      };
    }
    cues.push(cue);
  };
  const pause = (ms) => page.waitForTimeout(ms);

  await page.goto(`${app}/owners/${owner.id}`);
  await page.locator("h2:has-text(\"Owner Information\")").waitFor();
  const vetColumn = page.locator("app-visit-list th:has-text(\"Vet\")").first();
  await vetColumn.scrollIntoViewIfNeeded();
  await say("The owner’s page. Every pet lists its visits — and the list now has a Vet column.",
      vetColumn);
  await pause(2600);

  const addVisit = page.locator("button:has-text(\"Add Visit\"), a:has-text(\"Add Visit\")").first();
  await addVisit.scrollIntoViewIfNeeded();
  await say("Booking a new visit for the first pet.", addVisit);
  await pause(1500);
  await addVisit.click();
  await page.locator("input#description").waitFor();
  await pause(1200);

  await say("Date and reason, as before — nothing here changed.");
  await page.locator("input[name=\"date\"]").fill("2026-09-15");
  const description = `Post-op check ${Date.now()}`;
  await page.locator("input#description").fill(description);
  await pause(1400);

  const vetSelect = page.locator("select#vetId");
  const vetRow = page.locator("div.form-group").filter({has: page.locator("label[for=\"vetId\"]")})
      .last();
  const realVets = vetSelect.locator("option:not([value$=\"null\"]):not([value=\"\"])");
  const vetName = (await realVets.first().textContent() || "").trim();
  await vetSelect.scrollIntoViewIfNeeded();
  await say("This is the new part: a Vet dropdown. It defaults to “not assigned”, because a "
      + "visit is allowed to have no vet.", vetSelect);
  await pause(2000);

  await say(`Picking ${vetName} as the vet who attended.`, vetRow);
  await vetSelect.selectOption({label: vetName});
  await pause(1800);

  const submit = page.locator("button[type=\"submit\"]:has-text(\"Add Visit\")");
  await submit.scrollIntoViewIfNeeded();
  await say("Saving — the vet id travels with the visit and lands in the new vets column.", submit);
  await pause(1700);
  await submit.click();
  await page.locator("h2:has-text(\"Owner Information\")").waitFor();

  // Anchor on the row we just created, never on "any cell showing that vet name": the
  // sample data is full of other visits with the same vet, and matching one of those
  // would film a success the feature did not actually deliver.
  const newRow = page.locator("app-visit-list tr").filter({hasText: description}).first();
  await newRow.scrollIntoViewIfNeeded();
  await pause(1400);
  // If the vet did not come back, that is the story worth filming — narrate it rather than
  // letting the footage imply a success. The non-zero exit is what stops a broken run from
  // being embedded silently.
  const rowText = (await newRow.textContent() || "");
  const saved = rowText.includes(vetName);
  if (!saved) {
    await say(`⚠ The visit came back with no vet — an em dash. Booking through the UI is NOT `
        + `saving the vet right now.`, newRow);
    await pause(3200);
  }

  if (saved) {
    await say("Back on the owner’s page: the new visit is attributed to that vet. Older visits "
        + "show an em dash — they never had one.", newRow);
  } else {
    await say("The rows above that DO show a vet were written straight to POST /api/visits — "
        + "that path still works.");
  }
  await pause(2400);

  // The Edit control lives in the per-pet visit list on the owner page, not on /visits.
  // Match the vet CELL of a visit row, not any tr containing that text: the pet block is
  // itself a tr wrapping the whole visit table, so a looser locator opens the first visit
  // of the pet — which has no vet — under a narration promising a pre-selected one.
  const editRow = page.locator("app-visit-list tr")
      .filter({has: page.locator(`td.visit-vet:text-is("${vetName}")`)}).first();
  const editLink = editRow.locator("button:has-text(\"Edit Visit\"), a:has-text(\"Edit Visit\")")
      .first();
  if (!(await editLink.count())) {
    throw new Error("no Edit Visit control on the owner page — the edit half went unfilmed");
  }
  await editLink.scrollIntoViewIfNeeded();
  await say("Booking is not the only way in. Opening that visit for editing.", editLink);
  await pause(1600);
  await editLink.click();
  const editSelect = page.locator("select#vetId");
  await editSelect.waitFor();
  await pause(1600);

  await editSelect.scrollIntoViewIfNeeded();
  await say("The saved vet comes back pre-selected — the read path works, not just the write "
      + "path.", editSelect);
  await pause(2200);

  const options = (await editSelect.locator("option:not([value$=\"null\"]):not([value=\"\"])")
      .allTextContents()).map(t => t.trim());
  const other = options.find(t => t && t !== vetName);
  if (other) {
    await say(`Reassigning to ${other}. Choosing “not assigned” here clears the vet again.`,
        editSelect);
    await editSelect.selectOption({label: other});
    await pause(2600);
  }

  await page.goto(`${app}/visits`);
  const allVisitsVetColumn = page.locator("#visitsTable th:has-text(\"Vet\")").first();
  await allVisitsVetColumn.waitFor();
  await say("And the all-visits page, across every owner: same column, an em dash wherever no "
      + "vet attended.", allVisitsVetColumn);
  await pause(3000);

  await say(saved ? "That is the whole feature: set a vet when booking, or change it afterwards."
                  : "So: the edit path works, the booking path does not. See finding 1.");
  await pause(2600);

  // The boxes are frame pixels only if the page was rendered 1:1 at the recorded size.
  const geom = await page.evaluate(
      () => ({dpr: devicePixelRatio, w: innerWidth, h: innerHeight}));

  await context.close();
  await browser.close();

  const webm = fs.readdirSync(videoDir).filter(f => f.endsWith(".webm"))
      .map(f => videoDir + "/" + f).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
  if (!webm) throw new Error("playwright produced no .webm");
  fs.copyFileSync(webm, raw);
  fs.writeFileSync(cuesPath, JSON.stringify(cues, null, 1));
  const boxed = cues.filter(c => c.box).length;
  console.error(`[video] owner ${owner.id}, vet "${vetName}", ${cues.length} cues `
      + `(${boxed} with a box) -> ${raw}`);
  console.error(`[video] viewport ${geom.w}x${geom.h} @ dpr ${geom.dpr}`);
  if (!saved) {
    console.error("[video] NOTE: booking did not persist the vet — the film says so out loud");
    process.exitCode = 3;
  }
})().catch(e => { console.error("[video] " + e.message); process.exit(1); });
' "$BASE_URL" "$API_URL" "$TMP" "$RAW" "$CUES"
RC=$?
set -e
if [ "$RC" != 0 ] && [ "$RC" != 3 ]; then exit "$RC"; fi

python3 "$SCRIPT_DIR/annotate-feature-video.py" "$RAW" "$CUES" "$OUT"

if command -v ffprobe >/dev/null 2>&1; then
  echo "[video] $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")s, $(du -h "$OUT" | cut -f1)" >&2
fi
exit "$RC"
