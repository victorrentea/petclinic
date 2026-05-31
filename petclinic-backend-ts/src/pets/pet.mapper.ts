import { Pet } from './pet.entity';
import { PetType } from '../pet-types/pet-type.entity';
import { Owner } from '../owners/owner.entity';
import { PetDto } from './dto/pet.dto';
import { PetFieldsDto } from './dto/pet-fields.dto';
import { PetTypeDto } from '../pet-types/dto/pet-type.dto';
import { toVisitsDto } from '../visits/visit.mapper';

/**
 * Maps Pet entities to/from PetDto (delegates visit mapping to visit.mapper).
 *
 * Stateless plain functions (no Nest DI, no @Injectable), which avoids circular
 * DI between the Owner/Pet/Visit mappers. Controllers import them directly.
 */

/**
 * Maps a Pet entity to a PetDto.
 *
 * Visits are emitted sorted by date DESCENDING via Pet.getVisitsSortedByDate();
 * the owner id is projected to `ownerId`. PetType is mapped via toPetTypeDto.
 */
export function toPetDto(pet: Pet): PetDto {
  const dto = new PetDto();
  dto.id = pet.id;
  dto.name = pet.name as string;
  dto.birthDate = pet.birthDate as string;
  dto.type = pet.type ? toPetTypeDto(pet.type) : (undefined as unknown as PetTypeDto);
  dto.ownerId = pet.owner?.id;
  const sortedVisits = pet.getVisitsSortedByDate();
  for (const visit of sortedVisits) {
    // Stitch the back-reference so the visit mapper can project the denormalized
    // petId/petName/owner* fields. TypeORM does not populate `visit.pet` on a
    // visit loaded as a child via owner->pets->visits, so set it here.
    visit.pet = visit.pet ?? pet;
  }
  dto.visits = toVisitsDto(sortedVisits);
  return dto;
}

/** Maps a list of Pet entities to a list of PetDto. */
export function toPetsDto(pets: Pet[]): PetDto[] {
  return pets.map((pet) => toPetDto(pet));
}

/**
 * Maps a PetDto to a Pet entity.
 *
 * The owner relation is reconstructed as a stub carrying only the id (from
 * `ownerId`).
 */
export function toPet(petDto: PetDto): Pet {
  const pet = new Pet();
  pet.id = petDto.id;
  pet.name = petDto.name;
  pet.birthDate = petDto.birthDate;
  pet.type = petDto.type ? toPetType(petDto.type) : undefined;
  if (petDto.ownerId !== undefined && petDto.ownerId !== null) {
    const owner = new Owner();
    owner.id = petDto.ownerId;
    pet.owner = owner;
  }
  return pet;
}

/** Maps a list of PetDto to a list of Pet entities. */
export function toPets(petDtos: PetDto[]): Pet[] {
  return petDtos.map((petDto) => toPet(petDto));
}

/**
 * Maps a PetFieldsDto to a Pet entity, leaving id, owner and visits unset.
 */
export function toPetFromFields(fieldsDto: PetFieldsDto): Pet {
  const pet = new Pet();
  pet.name = fieldsDto.name;
  pet.birthDate = fieldsDto.birthDate;
  pet.type = fieldsDto.type ? toPetType(fieldsDto.type) : undefined;
  return pet;
}

/** Maps a PetType entity to a PetTypeDto. */
export function toPetTypeDto(petType: PetType): PetTypeDto {
  const dto = new PetTypeDto();
  dto.id = petType.id;
  dto.name = petType.name ?? '';
  return dto;
}

/** Maps a PetTypeDto to a PetType entity. */
export function toPetType(petTypeDto: PetTypeDto): PetType {
  const petType = new PetType();
  petType.id = petTypeDto.id;
  petType.name = petTypeDto.name;
  return petType;
}

/** Maps a list of PetType entities to a list of PetTypeDto. */
export function toPetTypeDtos(petTypes: PetType[]): PetTypeDto[] {
  return petTypes.map((petType) => toPetTypeDto(petType));
}
