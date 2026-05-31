import { Specialty } from './specialty.entity';
import { SpecialtyDto } from './dto/specialty.dto';

/**
 * Stateless mapper ported from victor.training.petclinic.mapper.SpecialtyMapper
 * (MapStruct, componentModel = "spring").
 *
 * Plain functions — NO Nest DI, NO @Injectable — mirroring MapStruct's
 * stateless nature. Controllers import these functions directly.
 *
 * MapStruct maps matching properties by name; here both `id` and `name`.
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
 * Mirrors MapStruct's `List<Specialty> toSpecialty(List<SpecialtyDto>)`.
 * Named distinctly because TS has no method overloading.
 */
export function toSpecialties(dtos: SpecialtyDto[]): Specialty[] {
  return dtos.map(toSpecialty);
}
