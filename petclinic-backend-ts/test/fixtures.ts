import { DataSource } from 'typeorm';

import { Owner } from '../src/owners/owner.entity';
import { Pet } from '../src/pets/pet.entity';
import { PetType } from '../src/pet-types/pet-type.entity';
import { Visit } from '../src/visits/visit.entity';
import { Vet } from '../src/vets/vet.entity';
import { Specialty } from '../src/specialties/specialty.entity';

/**
 * Test fixture builders. Rows are inserted directly via the TypeORM
 * repositories, independent of the controllers under test.
 */

/** Builds a sample owner — Sherlock Holmes. */
export async function saveOwner(
  ds: DataSource,
  overrides: Partial<Owner> = {},
): Promise<Owner> {
  const repo = ds.getRepository(Owner);
  const owner = repo.create({
    firstName: 'Sherlock',
    lastName: 'Holmes',
    address: 'Baker St 221B',
    city: 'London',
    telephone: '1234567890',
    ...overrides,
  });
  return repo.save(owner);
}

export async function savePetType(ds: DataSource, name: string): Promise<PetType> {
  const repo = ds.getRepository(PetType);
  return repo.save(repo.create({ name }));
}

/** Builds a sample pet — Leo, born 2010-10-10 — linked to the given owner + type. */
export async function savePet(
  ds: DataSource,
  owner: Owner,
  type: PetType,
  overrides: Partial<Pet> = {},
): Promise<Pet> {
  const repo = ds.getRepository(Pet);
  const pet = repo.create({
    name: 'Leo',
    birthDate: '2010-10-10',
    owner,
    type,
    ...overrides,
  });
  return repo.save(pet);
}

export async function saveVisit(
  ds: DataSource,
  pet: Pet,
  overrides: Partial<Visit> = {},
): Promise<Visit> {
  const repo = ds.getRepository(Visit);
  const visit = repo.create({
    date: todayIso(),
    description: 'rabies shot',
    pet,
    ...overrides,
  });
  return repo.save(visit);
}

export async function saveVet(
  ds: DataSource,
  firstName: string,
  lastName: string,
): Promise<Vet> {
  const repo = ds.getRepository(Vet);
  return repo.save(repo.create({ firstName, lastName }));
}

export async function saveSpecialty(ds: DataSource, name: string): Promise<Specialty> {
  const repo = ds.getRepository(Specialty);
  return repo.save(repo.create({ name }));
}

/** Today as 'YYYY-MM-DD' (matches the Visit entity's date column type). */
export function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
