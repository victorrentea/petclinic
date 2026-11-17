# Proposal

## Why

Clinic staff need to find the right owner easily, even as the register grows to an
estimated 100,000 owners within a year. A manageable, sortable list will make daily
lookup easier without losing the user's place.

## What Changes

- Show 10 owners at a time by default, with a choice of 5, 10, or 20.
- Let staff sort the full matching list by Name, Address, City, or Telephone.
  Names appear as "Last name, First name", initially in alphabetical order.
  Pets remain visible but cannot be used for sorting.
- Use Romanian alphabetical order, including letters with diacritics, for names,
  addresses, and cities, without distinguishing uppercase from lowercase.
- Keep the familiar last-name search and Find Owner button. Searching or changing
  the order or page size returns to the first page.
- Show how many owners match and which ones are currently displayed.
- Keep the same list position and search when refreshing, sharing a link,
  or returning from an owner's details with Back.
- Clearly distinguish loading, no matches, and a problem that can be retried.
  Add Owner stays available.

## Screen Preview

Illustrative names and totals; this example shows the first page.

```text
Owners
Last name [________________] [Find Owner]

+------------------+----------------+----------+------------+------+
| Name ^           | Address        | City     | Telephone  | Pets |
+------------------+----------------+----------+------------+------+
| Adams, Alex      | 12 Oak Street  | Madison  | 6085550101 | Max  |
| Brown, Sam       | 8 Pine Road    | Madison  | 6085550102 | Luna |
| Clark, Jo        | 3 Elm Lane     | Windsor  | 6085550103 |      |
| ...              (10 owners on this page)                       |
+----------------------------------------------------------------+

Rows per page [10 v]   1-10 of 100,000
[First] [Previous]                     [Next] [Last]

[Add Owner]
```

Click a column heading to change the order; click an owner's name to open their record.

## Capabilities

### New Capabilities

- `owners-browsing`: Find owners, choose their order, move between pages, and
  return to the same list.

### Modified Capabilities

None.

## Impact

- Changes are limited to browsing the Owners list. Owner records, pets, visits,
  and chatbot behavior remain unchanged.
- The Owners user guide will explain the new controls.
- No existing owner data needs to be changed.

Technical scope, compatibility, and rollout are covered in [design.md](design.md).
The agreed business decisions are recorded in [Q&A.md](../../../Q&A.md).
