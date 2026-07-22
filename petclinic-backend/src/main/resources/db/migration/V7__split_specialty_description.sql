-- Split the combined specialty knowledge into two clean columns:
--   description                      -> symptoms only (the vectorized RAG source)
--   pre_consultation_recommendations -> guidance for the owner until the visit (never vectorized)
-- Re-asserts the seed text for the three demo specialties (radiology/surgery/dentistry).
ALTER TABLE specialties ADD COLUMN pre_consultation_recommendations TEXT;

UPDATE specialties SET
  description =
'limping, limp, broken bone, fracture, suspected fracture, swollen leg, can''t bear weight, holding up a paw, joint pain after a fall, suspected internal injury, ingested a foreign object.',
  pre_consultation_recommendations =
'Keep the pet calm and restrict movement; do not apply weight to the affected limb. Avoid food before imaging in case sedation is needed. Radiology uses X-ray and imaging to diagnose bone, joint, and internal problems.'
WHERE name = 'radiology';

UPDATE specialties SET
  description =
'skin rash, itching, lump, growth, mass, wound, open wound, cut, laceration, abscess, swelling under the skin, bite wound, non-healing sore.',
  pre_consultation_recommendations =
'Keep the area clean and prevent the pet from licking or scratching it; an e-collar helps. Note any size change, discharge, or bleeding. Surgery evaluates and removes masses, abscesses, and treats wounds and lacerations.'
WHERE name = 'surgery';

UPDATE specialties SET
  description =
'bad breath, tooth pain, bleeding gums, difficulty eating, dropping food, drooling, broken tooth, loose tooth, pawing at the mouth, reluctance to chew.',
  pre_consultation_recommendations =
'Offer soft food and avoid hard chews until seen. Do not force the mouth open. Dentistry treats dental disease, broken or infected teeth, and gum problems.'
WHERE name = 'dentistry';
