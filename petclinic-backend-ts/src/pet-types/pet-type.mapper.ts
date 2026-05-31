import { PetType } from './pet-type.entity';
import { PetTypeDto } from './dto/pet-type.dto';
import { PetTypeFieldsDto } from './dto/pet-type-fields.dto';

/**
 * Maps PetType entities to/from their DTOs.
 *
 * Stateless plain functions — no Nest DI, no @Injectable. Controllers import
 * these directly.
 */

/** Maps fields to a PetType — `id` is left undefined for INSERT. */
export function toPetType(fieldsDto: PetTypeFieldsDto): PetType {
  const petType = new PetType();
  petType.name = fieldsDto.name;
  return petType;
}

/** Maps a PetType entity to a PetTypeDto. */
export function toPetTypeDto(petType: PetType): PetTypeDto {
  const dto = new PetTypeDto();
  dto.id = petType.id;
  dto.name = petType.name ?? '';
  return dto;
}

/** Maps a PetType entity to a PetTypeFieldsDto. */
export function toPetTypeFieldsDto(petType: PetType): PetTypeFieldsDto {
  const dto = new PetTypeFieldsDto();
  dto.name = petType.name ?? '';
  return dto;
}

/** Maps a list of PetType entities to a list of PetTypeDto. */
export function toPetTypeDtos(petTypes: PetType[]): PetTypeDto[] {
  return petTypes.map(toPetTypeDto);
}
