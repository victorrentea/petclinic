-- Dropping the pre-consultation recommendations: the chatbot now keeps a single specialty knowledge
-- field (description = the symptoms that identify the specialty), vectorized into RAG. The separate
-- guidance column added in V7 added more complexity than value, so it goes away.
ALTER TABLE specialties DROP COLUMN pre_consultation_recommendations;
