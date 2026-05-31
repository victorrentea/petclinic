import { Specialty } from './specialty.entity';
import { SpecialtyDto } from './dto/specialty.dto';

/**
 * Stateless mapper between Specialty entities and SpecialtyDto.
 *
 * Plain functions — no Nest DI, no @Injectable. Controllers import these
 * functions directly. Maps the matching `id` and `name` properties.
 */

export function toSpecialty(dto: SpecialtyDto): Specialty {
  const specialty = new Specialty();
  specialty.id = dto.id;
  specialty.name = dto.name;
  return specialty;
}

export function toSpecialtyDto(specialty: Specialty): SpecialtyDto {
  const dto = new SpecialtyDto();
  dto.id = specialty.id;
  dto.name = specialty.name as string;
  return dto;
}

export function toSpecialtyDtos(specialties: Specialty[]): SpecialtyDto[] {
  return specialties.map(toSpecialtyDto);
}

/**
 * Maps a list of SpecialtyDto to a list of Specialty entities.
 * Named distinctly because TS has no method overloading.
 */
export function toSpecialties(dtos: SpecialtyDto[]): Specialty[] {
  return dtos.map(toSpecialty);
}
