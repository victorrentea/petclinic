import { Vet } from './vet.entity';
import { VetDto } from './dto/vet.dto';
import {
  toSpecialties,
  toSpecialtyDtos,
} from '../specialties/specialty.mapper';

/**
 * Ported from victor.training.petclinic.mapper.VetMapper
 * (MapStruct `@Mapper(componentModel = "spring", uses = SpecialtyMapper.class)`).
 *
 * STATELESS plain functions (no Nest DI, no @Injectable), mirroring MapStruct's
 * stateless nature. Specialty conversion is delegated to the stateless functions
 * in `../specialties/specialty.mapper`.
 *
 * Note: the Java `toVet(VetFieldsDto)` overload (which ignores `id`) is NOT
 * reproduced here because no controller uses it — the Vet controller only ever
 * maps `VetDto`.
 */

/** MapStruct `Vet toVet(VetDto vetDto)`. */
export function toVet(vetDto: VetDto): Vet {
  const vet = new Vet();
  // Do NOT copy the client-supplied id on create: mirror Java, where the
  // IDENTITY column ignores any incoming id and the DB generates it. (toVet is
  // only used by addVet; updateVet mutates the loaded entity directly.)
  vet.firstName = vetDto.firstName;
  vet.lastName = vetDto.lastName;
  vet.specialties = toSpecialties(vetDto.specialties ?? []);
  return vet;
}

/** MapStruct `VetDto toVetDto(Vet vet)`. */
export function toVetDto(vet: Vet): VetDto {
  const dto = new VetDto();
  dto.id = vet.id;
  dto.firstName = vet.firstName as string;
  dto.lastName = vet.lastName as string;
  dto.specialties = toSpecialtyDtos(vet.specialties ?? []);
  return dto;
}

/** MapStruct `List<VetDto> toVetDtos(List<Vet> vets)`. */
export function toVetDtos(vets: Vet[]): VetDto[] {
  return vets.map(toVetDto);
}
