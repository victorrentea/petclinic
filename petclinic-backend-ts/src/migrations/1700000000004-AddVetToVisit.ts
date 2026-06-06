import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Every visit must record the vet who served it.
 *
 * Adds visits.vet_id (FK to vets), backfills all existing rows deterministically
 * (vet = id % 6 + 1 — the six seeded vets), then enforces NOT NULL.
 */
export class AddVetToVisit1700000000004 implements MigrationInterface {
  name = 'AddVetToVisit1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE visits ADD COLUMN vet_id INT REFERENCES vets (id)`);
    await queryRunner.query(`CREATE INDEX ON visits (vet_id)`);
    await queryRunner.query(`UPDATE visits SET vet_id = (id % 6) + 1 WHERE vet_id IS NULL`);
    await queryRunner.query(`ALTER TABLE visits ALTER COLUMN vet_id SET NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE visits DROP COLUMN IF EXISTS vet_id`);
  }
}
