#!/usr/bin/env bash
# Screenshot the Code City with this branch's change set lit up.
#
# codecity.html opens in "show everything" mode, which is the right default for
# exploring but the wrong one for a review: the reviewer wants the branch's
# buildings to jump out of the skyline. This drives the page headlessly, flips the
# Changes knob to "highlight changed", waits for the WebGL frame to settle, and
# saves the initial render as a PNG for the review guide to embed — the image is
# the map, the click-through to codecity.html is the territory.
#
# Regenerate the city first if the branch moved: petclinic-backend/generate-codecity.sh
#
# Usage:
#   scripts/capture-codecity.sh [out.png] [mode]
#     mode: highlight (default) | hide | off
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"

OUT="${1:-$ROOT/review/assets/codecity.png}"
MODE="${2:-highlight}"

CITY="$ROOT/petclinic-backend/docs/generated/codecity/codecity.html"
NODE_PATHS="$ROOT/petclinic-test/node_modules"

[ -f "$CITY" ] || { echo "[codecity] $CITY missing — run petclinic-backend/generate-codecity.sh" >&2; exit 2; }
[ -d "$NODE_PATHS/playwright" ] || { echo "[codecity] playwright not installed (cd petclinic-test && npm install)" >&2; exit 2; }

mkdir -p "$(dirname "$OUT")"

NODE_PATH="$NODE_PATHS" node -e '
const {chromium} = require("playwright");
const [city, out, mode] = process.argv.slice(1);

(async () => {
  // WebGL in headless Chromium needs the SwiftShader fallback, otherwise the
  // canvas comes back blank and the screenshot is an empty grey rectangle.
  const browser = await chromium.launch({args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"]});
  const page = await browser.newPage({viewport: {width: 1600, height: 1000}, deviceScaleFactor: 2});
  const problems = [];
  page.on("pageerror", e => problems.push(String(e)));

  await page.goto("file://" + city, {waitUntil: "load"});
  await page.waitForSelector("#changeMode");

  const changed = await page.evaluate((mode) => {
    const sel = document.getElementById("changeMode");
    sel.value = mode;
    sel.dispatchEvent(new Event("change", {bubbles: true}));
    // Dismiss the first-run intro card so it does not sit on top of the skyline.
    document.querySelector(".intro-dismiss")?.click();
    return document.getElementById("changeCount")?.textContent?.trim() || "";
  }, mode);

  // Two rAF-worth of settle time for the layout animation plus the label pass.
  await page.waitForTimeout(2500);
  await page.screenshot({path: out});
  await browser.close();

  if (problems.length) console.error("[codecity] page errors: " + problems.join(" | "));
  console.error(`[codecity] ${changed || "?"} — wrote ${out}`);
})().catch(e => { console.error("[codecity] " + e.message); process.exit(1); });
' "$CITY" "$OUT" "$MODE"
