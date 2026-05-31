import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ported from Flyway V3__sample_data.sql.
 * Seed rows are preserved VERBATIM, including the bcrypt admin hash and the
 * literary owners / pets / visits. Insertion order is significant: the
 * IDENTITY-generated pet ids referenced by the visits rows depend on it.
 */
export class SampleData1700000000003 implements MigrationInterface {
  name = 'SampleData1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO vets (first_name, last_name) VALUES
        ('James',  'Carter'),
        ('Helen',  'Leary'),
        ('Linda',  'Douglas'),
        ('Rafael', 'Ortega'),
        ('Henry',  'Stevens'),
        ('Sharon', 'Jenkins')
    `);

    await queryRunner.query(`
      INSERT INTO specialties (name) VALUES ('radiology'), ('surgery'), ('dentistry')
    `);

    // Pairs preserved from upstream petclinic data; column order matches
    // the original ON CONFLICT (specialty_id, vet_id) hint.
    await queryRunner.query(`
      INSERT INTO vet_specialties (specialty_id, vet_id) VALUES
        (1, 2), (2, 3), (3, 3), (2, 4), (1, 5)
    `);

    await queryRunner.query(`
      INSERT INTO types (name) VALUES
        ('cat'), ('dog'), ('lizard'), ('snake'), ('bird'), ('hamster'), ('horse')
    `);

    // Owners and pets drawn from European literature, film, and science.
    await queryRunner.query(`
      INSERT INTO owners (first_name, last_name, address, city, telephone) VALUES
        ('Kevin',     'McCallister',  '671 Lincoln Boulevard',     'Winnetka',         '0017085550199'),
        ('Harry',     'Potter',       '4 Privet Drive',            'Little Whinging',  '0119084455'),
        ('Erwin',     'Schroedinger', 'Boltzmanngasse 5',          'Vienna',           '0131914920'),
        ('Tom',       'Riddle',       'Malfoy Manor',              'Wiltshire',        '0119844321'),
        ('Ronald',    'Weasley',      'The Burrow',                'Ottery St Catchpole','0119544321'),
        ('Roger',     'Radcliff',     '27 Outer Circle',           'London',           '0442074860707'),
        ('Newt',      'Scamander',    'Diagon Alley',              'London',           '0442079460001'),
        ('Alice',     'Liddell',      'Christ Church',             'Oxford',           '0441865276150'),
        ('Henry',     'Baskerville',  'Baskerville Hall',          'Dartmoor',         '0441626832093'),
        ('John',      'Dolittle',     'Oxenthorpe Road',           'Puddleby',         '0441803712345'),
        ('George',    'Darling',      '14 Kensington Gardens',     'London',           '0442079372121'),
        ('James',     'Bond',         '30 Wellington Square',      'London',           '0442073527070'),
        ('Hercule',   'Poirot',       'Whitehaven Mansions',       'London',           '0442079241221')
    `);

    await queryRunner.query(`
      INSERT INTO pets (name, birth_date, type_id, owner_id) VALUES
        ('Axel',            DATE '2018-12-24', 6, 1),
        ('Hedwig',          DATE '2018-08-06', 5, 2),
        ('Milton',          DATE '2020-09-07', 1, 3),
        ('Nagini',          DATE '2017-01-20', 4, 4),
        ('Scabbers',        DATE '2019-08-06', 6, 5),
        ('Pongo',           DATE '2018-04-17', 2, 6),
        ('Perdita',         DATE '2018-03-07', 2, 6),
        ('Pickett',         DATE '2020-11-30', 3, 7),
        ('Dinah',           DATE '2019-09-04', 1, 8),
        ('Cheshire',        DATE '2019-09-04', 1, 8),
        ('Baskerville',     DATE '2017-02-24', 2, 9),
        ('Polynesia',       DATE '2016-03-09', 5, 10),
        ('Nana',            DATE '2018-06-24', 2, 11),
        ('Liza',            DATE '2019-06-08', 1, 11)
    `);

    await queryRunner.query(`
      INSERT INTO visits (pet_id, visit_date, description) VALUES
        (9,  DATE '2024-03-04', 'rabies shot'),
        (10, DATE '2024-03-04', 'rabies shot'),
        (10, DATE '2023-06-04', 'neutered'),
        (9,  DATE '2022-09-04', 'spayed')
    `);

    await queryRunner.query(`
      INSERT INTO owners (first_name, last_name, address, city, telephone) VALUES
        ('Sam',       'Carraclough',  'Greenall Bridge',           'Yorkshire',        '0441943876543'),
        ('Beatrix',   'Potter',       'Hill Top Farm',             'Near Sawrey',      '0441539436269'),
        ('Long',      'Silver',       'Admiral Benbow Inn',        'Bristol',          '0441179293000'),
        ('Argus',     'Filch',        'Hogwarts Castle',           'Inverness',        '0441463245678'),
        ('Wallace',   'Wensleydale',  '62 West Wallaby Street',    'Wigan',            '0441942244466'),
        ('Wendy',     'Darling',      '14 Kensington Gardens',     'London',           '0442079372122'),
        ('Rubeus',   'Hagrid',        'Gamekeepers Hut',           'Hogsmeade',        '0441463555111'),
        ('Hermione', 'Granger',       'Gryffindor Tower',          'Hogsmeade',        '0441463555112'),
        ('Salazar',  'Slytherin',     'Hogwarts Dungeons',         'Hogsmeade',        '0441463555113'),
        ('Tintin',   'Reporter',      '26 Rue du Labrador',        'Brussels',         '0032225112233'),
        ('Lady',     'Tremaine',      'Chateau Tremaine',          'Ile-de-France',    '0146203030'),
        ('Mister',   'Geppetto',      'Via dei Tessitori 7',       'Florence',         '0039055290383'),
        ('Alonso',   'Quixano',       'Campo de Montiel',          'La Mancha',        '0034926215566'),
        ('Charles',  'Dickens',       'Gad''s Hill Place',         'Higham',           '0441634406030'),
        ('Sherlock', 'Holmes',        '221B Baker Street',         'London',           '0442079351269')
    `);

    await queryRunner.query(`
      INSERT INTO pets (name, birth_date, type_id, owner_id) VALUES
        ('Lassie',          DATE '2020-05-12', 2, 14),
        ('Mittens',         DATE '2019-08-03', 1, 15),
        ('Pickles',         DATE '2021-02-18', 2, 15),
        ('Captain Flint',   DATE '2022-06-25', 5, 16),
        ('Mrs Norris',      DATE '2018-11-10', 1, 17),
        ('Gromit',          DATE '2017-04-07', 2, 18),
        ('Hutch',           DATE '2023-01-30', 6, 18),
        ('Toby',            DATE '2020-09-14', 2, 19),
        ('Norbert',         DATE '2021-07-22', 3, 20),
        ('Crookshanks',     DATE '2019-03-15', 1, 21),
        ('Basilisk',        DATE '2022-10-05', 4, 22),
        ('Snowy',           DATE '2018-06-20', 2, 23),
        ('Lucifer',         DATE '2021-12-01', 1, 24),
        ('Jaq',             DATE '2024-02-11', 6, 24),
        ('Figaro',          DATE '2019-09-09', 1, 25),
        ('Rocinante',       DATE '2015-05-05', 7, 26),
        ('Grip',            DATE '2023-08-19', 5, 27),
        ('Toby of Lambeth', DATE '2020-11-27', 2, 28)
    `);

    await queryRunner.query(`
      INSERT INTO visits (pet_id, visit_date, description) VALUES
        (15, DATE '2025-11-12', 'rabies vaccine'),
        (16, DATE '2025-12-03', 'annual checkup'),
        (17, DATE '2026-01-15', 'internal deworming'),
        (18, DATE '2026-02-20', 'beak and nail trim'),
        (19, DATE '2026-03-05', 'trivalent vaccine'),
        (20, DATE '2026-03-18', 'hind leg surgery'),
        (21, DATE '2026-04-02', 'general checkup'),
        (22, DATE '2026-04-10', 'spay/neuter'),
        (23, DATE '2025-10-22', 'skin and scale check'),
        (24, DATE '2025-11-30', 'trivalent vaccine'),
        (25, DATE '2026-02-14', 'habitat check'),
        (26, DATE '2026-03-22', 'allergy treatment'),
        (27, DATE '2026-04-15', 'checkup'),
        (28, DATE '2026-04-20', 'dental exam'),
        (29, DATE '2026-04-25', 'rabies vaccine'),
        (30, DATE '2026-04-28', 'horseshoeing'),
        (31, DATE '2026-05-01', 'plumage check'),
        (32, DATE '2026-05-02', 'wound on front paw'),
        (15, DATE '2026-05-02', 'post-vaccine follow-up'),
        (20, DATE '2026-05-03', 'surgical suture removal'),
        (3,  DATE '2026-05-03', 'annual general checkup'),
        (3,  DATE '2025-06-12', 'patient arrived in sealed box; simultaneously alive and dead — diagnosis deferred until observation'),
        (3,  DATE '2025-08-21', 'wave function collapsed during auscultation; patient definitively purring')
    `);

    await queryRunner.query(`
      INSERT INTO users (username, password, enabled) VALUES
        ('admin', '$2a$10$ymaklWBnpBKlgdMgkjWVF.GMGyvH8aDuTK.glFOaKw712LHtRRymS', TRUE)
    `);

    await queryRunner.query(`
      INSERT INTO roles (username, role) VALUES
        ('admin', 'ROLE_OWNER_ADMIN'),
        ('admin', 'ROLE_VET_ADMIN'),
        ('admin', 'ROLE_ADMIN')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM roles`);
    await queryRunner.query(`DELETE FROM users`);
    await queryRunner.query(`DELETE FROM visits`);
    await queryRunner.query(`DELETE FROM pets`);
    await queryRunner.query(`DELETE FROM owners`);
    await queryRunner.query(`DELETE FROM types`);
    await queryRunner.query(`DELETE FROM vet_specialties`);
    await queryRunner.query(`DELETE FROM specialties`);
    await queryRunner.query(`DELETE FROM vets`);
  }
}
