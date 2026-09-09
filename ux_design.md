# UX design

House style for the PetClinic UI. Written because these decisions were made once, at
a screen, and would otherwise have to be re-argued at every screen after it.

Everything here is **binding for new UI**. If a screen needs to break one of these,
that is fine — say why in the code, next to the exception.

## Data grids

### Column widths are fixed, never content-derived

`table-layout: fixed`, with an explicit percentage per column summing to 100.

The browser's default auto layout sizes each column from the content of the page
currently shown. Sorting or paging then changes the content, which changes the
widths, and **every column boundary jumps sideways on each click**. The reader
loses the shape of the table between one click and the next.

Percentages rather than pixels, so the grid still adapts to the viewport. Derive
them from the widest real value observed across sorts, not from a guess.

Fixed layout also removes the need for a horizontal scroll container — which
matters, see the sticky header below.

### A value too long for its column is truncated, not wrapped

```css
white-space: nowrap;
overflow: hidden;
text-overflow: ellipsis;
```

Wrapping makes rows different heights and the grid stops being scannable. The
ellipsis keeps every row the same height, and the full value stays one hover away
via a tooltip (below). Where a cell stacks several values one per line, truncate
each line rather than the block.

### The header sticks to the top while the rows scroll

`position: sticky; top: 0` on the header cells, with an opaque background so rows
cannot show through as they pass underneath.

⚠️ **`position: sticky` only works if no ancestor is a scroll container.** Bootstrap's
`.table-responsive` sets `overflow-x: auto`, which makes the wrapper exactly that:
the header then pins to the wrapper rather than to the viewport, and appears not to
stick at all. Because the columns are fixed-width percentages the table always fits,
so that wrapper's overflow can simply be turned off.

### Sortable columns say so without being hovered

Material hides the sort arrow until hover, so the reader has to go looking for which
columns are sortable. Show every sortable column's arrow at all times:

| State | Arrow |
|---|---|
| sortable, not the current sort | **grey** — `rgba(255, 255, 255, 0.4)` on a dark header |
| the current sort | **bright white**, and it points the way it sorts |

Three rules and no more. Override `opacity`, the idle arrow's `color`, and the idle
arrow's `transform`. Leave everything else to Material:

- **Never override `transform` on the active arrow.** That rotation is what
  distinguishes ascending from descending — remove it and the arrow stops meaning
  anything.
- **Do freeze `transform` on idle arrows.** Material slides the arrow in on hover,
  which reads as a graceful reveal when it starts invisible and as a twitch once it
  is permanently visible.
- The arrow's parts are drawn with `background: currentColor`, so **`color` tints it**.
  Setting their `background-color` directly loses to Material's own rule.
- Target `th[aria-sort='ascending']` / `[aria-sort='descending']`, never bare
  `th[aria-sort]` — Material writes `aria-sort="none"` on idle headers, so the bare
  selector matches every sortable column and nothing reads as active.

### The primary action shares the pager's row

The pager's own controls sit right; the empty left half is where the action belongs.
Put both in one flex row with `justify-content: space-between`, and **move the white
background off the paginator and onto that row** so the strip runs the full table
width with the button inside it, rather than the button sitting on the page behind.

## Tooltips

**One tooltip for the whole app**: `design-system/tooltip.service.ts`, opted into with
a `data-tip` attribute (`data-tip="text"`, or `[data-tip]="expression"`).

### Never use the native `title`

It cannot be styled, cannot be resized, and appears after roughly 500ms — long enough
that the reader has already given up. Both spellings are banned:

```html
<button title="Copy link">     <!-- no -->
```
```ts
btn.title = 'Copy link';       // no — and this is the one that survives audits,
                               // because people grep for title=" and never for .title =
```

`petclinic-frontend/scripts/check-no-native-title.js` fails the build on either. It
runs from `prebuild`, so the existing strict frontend build in CI enforces it with no
extra workflow wiring.

### How it behaves

Listeners are delegated on `document`, so anything rendered later — a new row, a new
page, a component that did not exist yet — works with no registration step. One bubble
element, appended to `<body>`, `position: fixed`, `pointer-events: none`.

| Token | Value |
|---|---|
| background | `rgba(20, 20, 22, 0.96)` — dark in both themes |
| color | `#fff` |
| font-size | `1.25rem` (~2× a native tooltip) |
| font-weight | `600` |
| padding | `0.6rem 0.9rem` |
| border-radius | `0.6rem` |
| max-width | `22rem`, wrapping — never `nowrap` |
| box-shadow | `0 10px 30px rgba(0, 0, 0, 0.35)` |
| show delay | `150ms` |
| transition | `120ms ease` on opacity and transform |

**The peek-in**: fade from `opacity: 0; translateY(4px)` to `opacity: 1; translateY(0)`.
Sliding up four pixels while fading reads as the tooltip *arriving*; a pure fade reads
as a rendering artifact. It is four pixels and it is the whole effect.

Positioned centred above the trigger with a ~10px gap, flipped below when there is no
room above, clamped ~8px from the viewport edges. A CSS-only `::after` tooltip cannot
flip or clamp, which is why it gets cut off at the edges of the screen — that is the
reason for the few lines of JS.

### A tooltip that repeats visible text is suppressed

If the trigger is not clipping its content and the tip is identical to its own text,
nothing is shown. Otherwise every truncated-cell tooltip would also fire on the short
cells, where it says nothing the reader cannot already see.

### Don't forget

- **Keyboard**: show on `focusin`, hide on `focusout` and `Escape` (`focus`/`blur` do
  not bubble, so they cannot be delegated).
- **Scroll**: hide. A fixed bubble positioned once floats away from its trigger.
- **Touch**: hide on `touchstart`, or a tap leaves it stuck open.
- **Empty tips** show nothing — conditional call sites render `''` all the time.
- **Accessibility**: set `aria-label` from the tip only when the element has no
  accessible name already. Overwriting a button that already reads correctly makes it
  worse.

### Not tooltips

Guided-tour popovers, onboarding bubbles and coach marks share the word but not the
behaviour — they have their own lifecycle, dismissal and persistence. Keep them out of
the tooltip component; they drag state into something that should stay stateless.

## Forms

Every single-select in a form goes through `<app-combo>` — see the design-system note
in [CLAUDE.md](CLAUDE.md). A raw `<select>` in a form template is a bug, not a shortcut.
