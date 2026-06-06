import { Owner } from './owner.entity';
import { toOwnerDto } from './owner.mapper';
import { Pet } from '../pets/pet.entity';
import { toPetDto } from '../pets/pet.mapper';
import { PetType } from '../pets/pet-type.entity';
import { Visit } from '../visits/visit.entity';
import { toVisitDto } from '../visits/visit.mapper';

/**
 * Database-free unit tests for the stateless mapper functions:
 *   - pet.mapper: visits emitted sorted by date DESCENDING (Pet.getVisitsSortedByDate)
 *   - owner.mapper: pets emitted sorted by name ASCENDING (Owner.getPets)
 *   - visit.mapper: VisitDto populated from pet + pet.owner (petId/petName/ownerId/...)
 *
 * These run without a DB: entities are constructed in-memory; no @InjectRepository
 * or TypeORM connection is touched.
 */

function buildVisit(id: number, date: string, description = `visit-${id}`): Visit {
  const v = new Visit();
  v.id = id;
  v.date = date;
  v.description = description;
  return v;
}

function buildPet(id: number, name: string, birthDate = '2010-01-01'): Pet {
  const p = new Pet();
  p.id = id;
  p.name = name;
  p.birthDate = new Date(birthDate);
  const type = new PetType();
  type.id = 1;
  type.name = 'dog';
  p.type = type;
  return p;
}

describe('PetMapper - toPetDto', () => {
  it('emits visits sorted by date DESCENDING (most recent first)', () => {
    const pet = buildPet(7, 'Leo');
    // intentionally unsorted insertion order
    pet.visits = [
      buildVisit(1, '2013-01-01'),
      buildVisit(2, '2020-06-15'),
      buildVisit(3, '2016-03-10'),
    ];

    const dto = toPetDto(pet);

    expect(dto.visits.map((v) => v.date)).toEqual(['2020-06-15', '2016-03-10', '2013-01-01']);
  });

  it('maps id, name, birthDate, type and ownerId, with empty visits when none', () => {
    const pet = buildPet(9, 'Basil', '2011-08-05');
    const owner = new Owner();
    owner.id = 42;
    pet.owner = owner;

    const dto = toPetDto(pet);

    expect(dto.id).toBe(9);
    expect(dto.name).toBe('Basil');
    expect(dto.birthDate).toBe('2011-08-05');
    expect(dto.type.name).toBe('dog');
    expect(dto.ownerId).toBe(42);
    expect(dto.visits).toEqual([]);
  });
});

describe('OwnerMapper - toOwnerDto', () => {
  it('emits pets sorted by name ASCENDING (case-insensitive)', () => {
    const owner = new Owner();
    owner.id = 1;
    owner.firstName = 'George';
    owner.lastName = 'Franklin';
    owner.address = '110 W. Liberty St.';
    owner.city = 'Madison';
    owner.telephone = '6085551023';
    // intentionally unsorted, mixed case to assert case-insensitive ordering
    owner.pets = [
      buildPet(1, 'zeus'),
      buildPet(2, 'Apollo'),
      buildPet(3, 'basil'),
    ];

    const dto = toOwnerDto(owner);

    expect(dto.pets.map((p) => p.name)).toEqual(['Apollo', 'basil', 'zeus']);
    expect(dto.firstName).toBe('George');
    expect(dto.telephone).toBe('6085551023');
  });

  it('cascades visit sorting through the nested pet mapping', () => {
    const owner = new Owner();
    owner.id = 1;
    const pet = buildPet(5, 'Rex');
    pet.visits = [buildVisit(1, '2015-01-01'), buildVisit(2, '2021-12-31')];
    owner.pets = [pet];

    const dto = toOwnerDto(owner);

    expect(dto.pets[0].visits.map((v) => v.date)).toEqual(['2021-12-31', '2015-01-01']);
  });
});

describe('VisitMapper - toVisitDto', () => {
  it('populates petId, petName and owner fields from pet + pet.owner', () => {
    const owner = new Owner();
    owner.id = 100;
    owner.firstName = 'George';
    owner.lastName = 'Franklin';
    const pet = buildPet(55, 'Leo');
    pet.owner = owner;
    const visit = buildVisit(3, '2019-09-09', 'rabies shot');
    visit.pet = pet;

    const dto = toVisitDto(visit);

    expect(dto.id).toBe(3);
    expect(dto.date).toBe('2019-09-09');
    expect(dto.description).toBe('rabies shot');
    expect(dto.petId).toBe(55);
    expect(dto.petName).toBe('Leo');
    expect(dto.ownerId).toBe(100);
    expect(dto.ownerFirstName).toBe('George');
    expect(dto.ownerLastName).toBe('Franklin');
  });

  it('leaves owner fields undefined when the pet has no owner', () => {
    const pet = buildPet(55, 'Leo');
    const visit = buildVisit(4, '2019-09-09');
    visit.pet = pet;

    const dto = toVisitDto(visit);

    expect(dto.petId).toBe(55);
    expect(dto.petName).toBe('Leo');
    expect(dto.ownerId).toBeUndefined();
    expect(dto.ownerFirstName).toBeUndefined();
    expect(dto.ownerLastName).toBeUndefined();
  });
});
