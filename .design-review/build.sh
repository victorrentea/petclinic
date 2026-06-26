#!/bin/bash
set -e
cd "$(dirname "$0")"

FB="/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FR="/System/Library/Fonts/Supplemental/Arial.ttf"

# after_n.png / before_n.png are 1280x1060, content anchored top-left (dpr=1).

# ---- 1) Guided panel: numbered red boxes around each redesigned region ----
magick after_n.png \
  -strokewidth 3 -stroke red -fill none \
  -draw "roundrectangle 313,170 953,878 16,16" \
  -draw "rectangle 357,214 903,315" \
  -draw "rectangle 356,335 904,361" \
  -draw "rectangle 356,356 904,410" \
  -draw "rectangle 356,783 633,841" \
  -stroke none -fill red \
  -draw "circle 330,193 330,206" \
  -draw "circle 330,225 330,238" \
  -draw "circle 330,348 330,361" \
  -draw "circle 330,383 330,396" \
  -draw "circle 330,800 330,813" \
  -fill white -font "$FB" -pointsize 18 \
  -annotate +324+200 "1" \
  -annotate +324+232 "2" \
  -annotate +324+355 "3" \
  -annotate +324+390 "4" \
  -annotate +324+807 "5" \
  -stroke none -fill "rgba(255,255,255,0.93)" \
  -draw "roundrectangle 20,455 305,778 14,14" \
  -fill "#b3261e" -font "$FB" -pointsize 21 -annotate +38+490 "WHAT CHANGED" \
  -fill "#23302a" -font "$FR" -pointsize 15 \
  -annotate +34+524 "1  Floating white card" \
  -annotate +50+544 "(radius, shadow, green bar)" \
  -annotate +34+576 "2  Serif heading + eyebrow" \
  -annotate +34+608 "3  Uppercase spaced labels" \
  -annotate +34+640 "4  Rounded input, green focus" \
  -annotate +50+660 "ring + valid check" \
  -annotate +34+692 "5  Ghost + filled-green CTA" \
  -fill "#2f6440" -font "$FB" -pointsize 15 \
  -annotate +34+730 "+  Cream-to-sage gradient" \
  -annotate +50+750 "replaces the flat gray bg" \
  guided.png

# ---- 2) Stitch the 3-panel comparison: BEFORE | AFTER | CHANGED PIXELS ----
magick montage \
  -label 'BEFORE  (original)'      before_n.png \
  -label 'AFTER  (redesign)'       after_n.png \
  -label 'CHANGED PIXELS  (red)'   diff_raw.png \
  -tile 3x1 -geometry +18+18 -background white \
  -bordercolor "#d7ddd7" -border 1 \
  -font "$FB" -pointsize 30 -fill "#23302a" \
  row1.png

# ---- 3) Guided panel labeled, centered to row width ----
magick montage \
  -label 'GUIDED  (what changed, where)' guided.png \
  -tile 1x1 -geometry +18+18 -background white \
  -bordercolor "#d7ddd7" -border 1 \
  -font "$FB" -pointsize 30 -fill "#23302a" \
  guided_labeled.png

ROW1_W=$(magick identify -format '%w' row1.png)
magick guided_labeled.png -background white -gravity center -extent ${ROW1_W}x guided_centered.png

# ---- 4) Title bar ----
magick -size ${ROW1_W}x120 xc:white \
  -font "$FB" -pointsize 44 -fill "#23302a" -gravity north -annotate +0+22 "Owner Edit — frontend-design refactor" \
  -font "$FR" -pointsize 24 -fill "#5a6b62" -gravity north -annotate +0+78 "Plain Bootstrap form  to  warm clinic-record card    ·    84% of pixels changed" \
  title.png

# ---- 5) Stack everything ----
magick -background white title.png row1.png guided_centered.png -append comparison.png
echo "FINAL: comparison.png -> $(magick identify -format '%wx%h' comparison.png)"
