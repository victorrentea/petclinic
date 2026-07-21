## Why

The Owners screen shows **every** owner at once, in a plain list you cannot sort or page through. The clinic expects to reach **thousands of owners in the coming months**, and showing them all on one screen will become slow and hard to use. This change turns the list into something you browse one page at a time, that you can sort and search.

## What Changes

- The Owners list shows a fixed number of rows per page — **5, 10, or 20** (10 by default) — with next/previous page controls, instead of everything at once.
- You can **sort** the list by clicking the **Name** or **City** column heading. Address, telephone, and pets are not sortable — putting those in order wouldn't help anyone find an owner.
- The existing **"find owner by last name"** search stays and now works together with sorting and paging; starting a new search jumps back to the first page.
- The **Name** column is corrected to read **"Last name, First name"** (e.g. *"Franklin, George"*). Today it is shown the wrong way round.
- The screen **remembers where you are**: the current page, sorting, and search are kept in the web address, so refreshing the page, using the browser's back/forward buttons, or sharing the link brings you back to exactly the same view.
- Because the list now arrives one page at a time, it stays **fast even with thousands of owners**.
- **Breaking change:** since the list no longer comes back as one big block, the other places that read the owners list must be updated to expect a single page at a time.

## Capabilities

### New Capabilities
- `owners-listing`: showing owners as a sortable, searchable list that arrives one page at a time (choose how many rows per page, sort by Name or City, search by last name, and keep your place when you refresh or share the link).

### Modified Capabilities
<!-- None — there is no existing described behaviour to change. -->

## Impact

- **Who sees the difference:** anyone using the Owners screen — it now pages, sorts, and remembers your place.
- **What we touch:** the Owners screen itself, the behind-the-scenes part that supplies its data, and the automated checks (including the browser tests) that need to expect a page instead of the whole list.
- **Scale:** the list is prepared to stay fast as the clinic grows to thousands of owners.
- **Left untouched:** only the Owners screen changes — the Vets and Pets screens are not affected.
