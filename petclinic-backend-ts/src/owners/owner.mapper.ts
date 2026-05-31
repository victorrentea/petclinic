import { Owner } from './owner.entity';
import { OwnerDto } from './dto/owner.dto';
import { OwnerFieldsDto } from './dto/owner-fields.dto';
import { toPetDto } from '../pets/pet.mapper';

/**
 * Ported from victor.training.petclinic.mapper.OwnerMapper (MapStruct,
 * `uses = PetMapper.class`).
 *
 * STATELESS plain functions (no Nest DI, no @Injectable) mirroring MapStruct's
 * stateless nature and avoiding circular DI between the Owner/Pet/Visit mappers.
 * Controllers import these functions directly. Pet mapping is delegated to
 * src/pets/pet.mapper.ts (the `uses = PetMapper.class` equivalent).
 */

/**
 * Mirrors `OwnerDto toOwnerDto(Owner)`.
 *
 * Pets are emitted sorted by name ASCENDING (case-insensitive) via
 * Owner.getPets(), matching Java's PropertyComparator output; each pet is
 * mapped through PetMapper.toPetDto.
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
 * Mirrors `Owner toOwner(OwnerFieldsDto)`:
 *   @Mapping(target = "id", ignore = true)
 *   @Mapping(target = "pets", ignore = true)
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

/** Mirrors `List<OwnerDto> toOwnerDtoCollection(List<Owner>)`. */
export function toOwnerDtoCollection(owners: Owner[]): OwnerDto[] {
  return owners.map((owner) => toOwnerDto(owner));
}
