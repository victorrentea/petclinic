-- Backs the default (and most common explicit) owners list sort: last name, then first name,
-- with id as the deterministic tiebreaker (see openspec/changes/owners-grid-pagination-sorting).
CREATE INDEX idx_owners_last_name_first_name_id ON owners (last_name, first_name, id);
