import { Visit } from './visit.entity';
import { Pet } from '../pets/pet.entity';
import { VisitDto } from './dto/visit.dto';
import { VisitFieldsDto } from './dto/visit-fields.dto';

/**
 * Ported from victor.training.petclinic.mapper.VisitMapper (MapStruct).
 *
 * STATELESS plain functions (no Nest DI, no @Injectable) mirroring MapStruct's
 * stateless nature and avoiding circular DI between the Owner/Pet/Visit mappers.
 * Controllers import these functions directly.
 */

/**
 * Mirrors `Visit toVisit(VisitDto)`:
 *   @Mapping(source = "petId", target = "pet.id")
 *   @Mapping(target = "pet.name", ignore = true)
 *   @Mapping(target = "pet.owner", ignore = true)
 *
 * The Visit's `date` defaults to today when the DTO omits it, reproducing the
 * Java entity field initializer `LocalDate date = LocalDate.now()` (see
 * Visit.create / CONVENTIONS "Dates").
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
  return visit;
}

/**
 * Mirrors `Visit toVisit(VisitFieldsDto)`:
 *   @Mapping(target = "id", ignore = true)
 *   @Mapping(target = "pet", ignore = true)
 */
export function toVisitFromFields(visitFieldsDto: VisitFieldsDto): Visit {
  const visit = Visit.create();
  if (visitFieldsDto.date) {
    visit.date = visitFieldsDto.date;
  }
  visit.description = visitFieldsDto.description;
  return visit;
}

/**
 * Mirrors `VisitDto toVisitDto(Visit)`:
 *   @Mapping(source = "pet.id", target = "petId")
 *   @Mapping(source = "pet.name", target = "petName")
 *   @Mapping(source = "pet.owner.id", target = "ownerId")
 *   @Mapping(source = "pet.owner.firstName", target = "ownerFirstName")
 *   @Mapping(source = "pet.owner.lastName", target = "ownerLastName")
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
  return dto;
}

/** Mirrors `List<VisitDto> toVisitsDto(List<Visit>)`. */
export function toVisitsDto(visits: Visit[]): VisitDto[] {
  return visits.map((visit) => toVisitDto(visit));
}
