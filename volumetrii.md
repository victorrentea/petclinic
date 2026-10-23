# Volumes & non-functional requirements

## Data volumes
- **Owners:** ~50,000 in production within a year, each with their pets (business target,
  confirmed 2026-10-23). The 26 seeded owners are not representative.

Consequence: any listing of owners (and by extension pets/visits) is paged and sorted
**server-side**; never fetch all rows to page or sort them in the browser.
