import { Vet } from './vet.entity';
import { VetDto } from './dto/vet.dto';
import {
  toSpecialties,
  toSpecialtyDtos,
} from '../specialties/specialty.mapper';

/**
 * Maps Vet entities to/from VetDto (delegates specialty mapping to
 * specialty.mapper).
 *
 * Stateless plain functions (no Nest DI, no @Injectable). Specialty conversion
 * is delegated to the stateless functions in `../specialties/specialty.mapper`.
 *
 * Note: a fields-only mapping that ignores `id` is NOT provided here because no
 * controller needs it — the Vet controller only ever maps `VetDto`.
 */

/** Maps a VetDto to a Vet entity. */
export function toVet(vetDto: VetDto): Vet {
  const vet = new Vet();
  // Do NOT copy the client-supplied id on create: the IDENTITY column ignores
  // any incoming id and the DB generates it. (toVet is only used by addVet;
  // updateVet mutates the loaded entity directly.)
  vet.firstName = vetDto.firstName;
  vet.lastName = vetDto.lastName;
  vet.specialties = toSpecialties(vetDto.specialties ?? []);
  return vet;
}

/** Maps a Vet entity to a VetDto. */
export function toVetDto(vet: Vet): VetDto {
  const dto = new VetDto();
  dto.id = vet.id;
  dto.firstName = vet.firstName as string;
  dto.lastName = vet.lastName as string;
  dto.specialties = toSpecialtyDtos(vet.specialties ?? []);
  return dto;
}

/** Maps a list of Vet entities to a list of VetDto. */
export function toVetDtos(vets: Vet[]): VetDto[] {
  return vets.map(toVetDto);
}
