import { Owner } from './owner.entity';
import { OwnerDto } from './dto/owner.dto';
import { OwnerFieldsDto } from './dto/owner-fields.dto';
import { toPetDto } from '../pets/pet.mapper';

/**
 * Maps Owner entities to/from their DTOs (delegates pet mapping to pet.mapper).
 *
 * Stateless plain functions (no Nest DI, no @Injectable), which avoids circular
 * DI between the Owner/Pet/Visit mappers. Controllers import them directly. Pet
 * mapping is delegated to src/pets/pet.mapper.ts.
 */

/**
 * Maps an Owner entity to an OwnerDto.
 *
 * Pets are emitted sorted by name ASCENDING (case-insensitive) via
 * Owner.getPets(); each pet is mapped through pet.mapper's toPetDto.
 */
export function toOwnerDto(owner: Owner): OwnerDto {
  const dto = new OwnerDto();
  dto.id = owner.id;
  dto.firstName = owner.firstName as string;
  dto.lastName = owner.lastName as string;
  dto.address = owner.address as string;
  dto.city = owner.city as string;
  dto.telephone = owner.telephone as string;
  const sortedPets = owner.getPets();
  for (const pet of sortedPets) {
    // Stitch the owner back-reference so each pet projects its `ownerId`, and so
    // the pets' nested visits can project the owner* fields (see PetMapper).
    pet.owner = pet.owner ?? owner;
  }
  dto.pets = sortedPets.map((pet) => toPetDto(pet));
  return dto;
}

/**
 * Maps an OwnerFieldsDto to an Owner entity, leaving id and pets unset.
 */
export function toOwner(ownerFieldsDto: OwnerFieldsDto): Owner {
  const owner = new Owner();
  owner.firstName = ownerFieldsDto.firstName;
  owner.lastName = ownerFieldsDto.lastName;
  owner.address = ownerFieldsDto.address;
  owner.city = ownerFieldsDto.city;
  owner.telephone = ownerFieldsDto.telephone;
  return owner;
}

/** Maps a list of Owner entities to a list of OwnerDto. */
export function toOwnerDtoCollection(owners: Owner[]): OwnerDto[] {
  return owners.map((owner) => toOwnerDto(owner));
}
