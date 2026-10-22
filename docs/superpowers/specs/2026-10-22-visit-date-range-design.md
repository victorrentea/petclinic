# Visit date range validation

## Goal

Fix issue #40: a visit date must not be earlier than its pet's birth date or later than
one calendar year from today. Both endpoints are inclusive.

## Design

- Apply the range in both New Visit and Edit Visit using Angular Material datepicker bounds,
  derived from the loaded pet and the current date.
- Enforce the same rule at the REST boundary for visit creation and updates. Resolve the
  relevant pet (the request's pet for creation, the existing visit's pet for updates) and
  return the existing 400 validation response when the date is outside the range.
- Keep the existing controller/repository/mapper architecture; no new service layer or
  reusable validator abstraction is needed for this focused rule.

## Verification

- Add a Playwright regression scenario first and run it against the unfixed application to
  demonstrate the invalid-date submission succeeds.
- Cover the lower and upper bound failures in both Add and Edit, and bypass the UI to verify
  the API also rejects out-of-range values.
- Run the same test after the fix and verify in-range dates remain accepted.
- Record before/after Playwright videos in vertical 9:16 with burned-in captions and a generic
  local synthetic narrator. Do not call the Fish Audio service or send credentials/text to it.

## Scope

No database schema changes, API shape changes, or unrelated date validation changes.
