import { PetType } from './pet-type.entity';
import { PetTypeDto } from './dto/pet-type.dto';
import { PetTypeFieldsDto } from './dto/pet-type-fields.dto';

/**
 * Ported from victor.training.petclinic.mapper.PetTypeMapper (MapStruct).
 *
 * STATELESS plain functions — no Nest DI, no @Injectable — mirroring
 * MapStruct's stateless mappers. Controllers import these directly.
 */

/** MapStruct: toPetType — `id` is ignored (left undefined for INSERT). */
export function toPetType(fieldsDto: PetTypeFieldsDto): PetType {
  const petType = new PetType();
  petType.name = fieldsDto.name;
  return petType;
}

/** MapStruct: toPetTypeDto. */
export function toPetTypeDto(petType: PetType): PetTypeDto {
  const dto = new PetTypeDto();
  dto.id = petType.id;
  dto.name = petType.name ?? '';
  return dto;
}

/** MapStruct: toPetTypeFieldsDto. */
export function toPetTypeFieldsDto(petType: PetType): PetTypeFieldsDto {
  const dto = new PetTypeFieldsDto();
  dto.name = petType.name ?? '';
  return dto;
}

/** MapStruct: toPetTypeDtos. */
export function toPetTypeDtos(petTypes: PetType[]): PetTypeDto[] {
  return petTypes.map(toPetTypeDto);
}
