import { Pet } from './pet.entity';
import { PetType } from '../pet-types/pet-type.entity';
import { Owner } from '../owners/owner.entity';
import { PetDto } from './dto/pet.dto';
import { PetFieldsDto } from './dto/pet-fields.dto';
import { PetTypeDto } from '../pet-types/dto/pet-type.dto';
import { toVisitsDto } from '../visits/visit.mapper';

/**
 * Ported from victor.training.petclinic.mapper.PetMapper (MapStruct,
 * `uses = VisitMapper.class`).
 *
 * STATELESS plain functions (no Nest DI, no @Injectable) mirroring MapStruct's
 * stateless nature and avoiding circular DI between the Owner/Pet/Visit mappers.
 * Controllers import these functions directly.
 */

/**
 * Mirrors `PetDto toPetDto(Pet)`:
 *   @Mapping(source = "owner.id", target = "ownerId")
 *   @Mapping(source = "visitsSortedByDate", target = "visits")
 *
 * Visits are emitted sorted by date DESCENDING via Pet.getVisitsSortedByDate(),
 * matching Java's PropertyComparator output. PetType is mapped via toPetTypeDto.
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
    // petId/petName/owner* fields. Java's managed entities carry these
    // bidirectional links for free; TypeORM does not populate `visit.pet` on a
    // visit loaded as a child via owner->pets->visits, so set it here.
    visit.pet = visit.pet ?? pet;
  }
  dto.visits = toVisitsDto(sortedVisits);
  return dto;
}

/** Mirrors `List<PetDto> toPetsDto(List<Pet>)`. */
export function toPetsDto(pets: Pet[]): PetDto[] {
  return pets.map((pet) => toPetDto(pet));
}

/**
 * Mirrors `Pet toPet(PetDto)`:
 *   @Mapping(source = "ownerId", target = "owner.id")
 *
 * The owner relation is reconstructed as a stub carrying only the id, exactly
 * like MapStruct populating a nested `owner.id`.
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

/** Mirrors `List<Pet> toPets(List<PetDto>)`. */
export function toPets(petDtos: PetDto[]): Pet[] {
  return petDtos.map((petDto) => toPet(petDto));
}

/**
 * Mirrors `Pet toPet(PetFieldsDto)`:
 *   @Mapping(target = "id", ignore = true)
 *   @Mapping(target = "owner", ignore = true)
 *   @Mapping(target = "visits", ignore = true)
 */
export function toPetFromFields(fieldsDto: PetFieldsDto): Pet {
  const pet = new Pet();
  pet.name = fieldsDto.name;
  pet.birthDate = fieldsDto.birthDate;
  pet.type = fieldsDto.type ? toPetType(fieldsDto.type) : undefined;
  return pet;
}

/** Mirrors `PetTypeDto toPetTypeDto(PetType)`. */
export function toPetTypeDto(petType: PetType): PetTypeDto {
  const dto = new PetTypeDto();
  dto.id = petType.id;
  dto.name = petType.name ?? '';
  return dto;
}

/** Mirrors `PetType toPetType(PetTypeDto)`. */
export function toPetType(petTypeDto: PetTypeDto): PetType {
  const petType = new PetType();
  petType.id = petTypeDto.id;
  petType.name = petTypeDto.name;
  return petType;
}

/** Mirrors `List<PetTypeDto> toPetTypeDtos(List<PetType>)`. */
export function toPetTypeDtos(petTypes: PetType[]): PetTypeDto[] {
  return petTypes.map((petType) => toPetTypeDto(petType));
}
