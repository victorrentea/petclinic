-- Collapsed from the former V4..V8, which mixed these ALTERs with seed UPDATEs and so had to
-- keep patching each other: V5 existed only to null one demo phone number, V7 only to re-assert
-- text V6 had seeded, V8 only to drop a column V7 had added. With the rows moved to
-- db/seed/R__seed.sql, what is left is two columns.

-- Exact local time of day; MCP create_visit requires it, legacy rows stay NULL.
ALTER TABLE visits ADD COLUMN visit_time TIME;

-- The symptoms that identify the specialty: single source of truth for the chatbot RAG,
-- which previously hard-coded them in petclinic-chatbot/.../specialty-knowledge.md.
ALTER TABLE specialties ADD COLUMN description TEXT;
