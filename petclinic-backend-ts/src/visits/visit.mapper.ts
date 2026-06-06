import { Visit } from './visit.entity';
import { Pet } from '../pets/pet.entity';
import { Vet } from '../vets/vet.entity';
import { VisitDto } from './dto/visit.dto';
import { VisitFieldsDto } from './dto/visit-fields.dto';

/**
 * Maps Visit entities to/from their DTOs.
 *
 * Stateless plain functions (no Nest DI, no @Injectable), which avoids circular
 * DI between the Owner/Pet/Visit mappers. Controllers import them directly.
 */

/** Builds a Vet stub carrying only the id, for FK assignment. */
export function vetStub(vetId: number): Vet {
  const vet = new Vet();
  vet.id = vetId;
  return vet;
}

/**
 * Maps a VisitDto to a Visit entity. The `petId` and `vetId` become stubs
 * carrying only the id.
 *
 * The Visit's `date` defaults to today when the DTO omits it (see Visit.create
 * / CONVENTIONS "Dates").
 */
export function toVisit(visitDto: VisitDto): Visit {
  const visit = Visit.create();
  if (visitDto.date) {
    visit.date = visitDto.date;
  }
  visit.description = visitDto.description;
  const pet = new Pet();
  pet.id = visitDto.petId;
  visit.pet = pet;
  visit.vet = vetStub(visitDto.vetId);
  return visit;
}

/**
 * Maps a VisitFieldsDto to a Visit entity, leaving id and pet unset.
 */
export function toVisitFromFields(visitFieldsDto: VisitFieldsDto): Visit {
  const visit = Visit.create();
  if (visitFieldsDto.date) {
    visit.date = visitFieldsDto.date;
  }
  visit.description = visitFieldsDto.description;
  visit.vet = vetStub(visitFieldsDto.vetId);
  return visit;
}

/**
 * Maps a Visit entity to a VisitDto, flattening the pet and its owner into the
 * denormalized petId/petName/owner* fields and the vet into the vet* fields.
 */
export function toVisitDto(visit: Visit): VisitDto {
  const dto = new VisitDto();
  dto.id = visit.id;
  dto.date = visit.date;
  dto.description = visit.description as string;
  const pet = visit.pet;
  if (pet) {
    dto.petId = pet.id;
    dto.petName = pet.name;
    const owner = pet.owner;
    if (owner) {
      dto.ownerId = owner.id;
      dto.ownerFirstName = owner.firstName;
      dto.ownerLastName = owner.lastName;
    }
  }
  const vet = visit.vet;
  if (vet) {
    dto.vetId = vet.id;
    dto.vetFirstName = vet.firstName;
    dto.vetLastName = vet.lastName;
  }
  return dto;
}

/** Maps a list of Visit entities to a list of VisitDto. */
export function toVisitsDto(visits: Visit[]): VisitDto[] {
  return visits.map((visit) => toVisitDto(visit));
}
