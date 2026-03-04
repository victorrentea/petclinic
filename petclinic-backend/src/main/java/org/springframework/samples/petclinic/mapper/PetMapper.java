package org.springframework.samples.petclinic.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.springframework.samples.petclinic.model.Pet;
import org.springframework.samples.petclinic.model.PetType;
import org.springframework.samples.petclinic.rest.dto.PetDto;
import org.springframework.samples.petclinic.rest.dto.PetFieldsDto;
import org.springframework.samples.petclinic.rest.dto.PetTypeDto;

import java.util.List;

@Mapper(componentModel = "spring", uses = VisitMapper.class)
public interface PetMapper {

    @Mapping(source = "owner.id", target = "ownerId")
    @Mapping(source = "visitsSortedByDate", target = "visits")
    PetDto toPetDto(Pet pet);

    List<PetDto> toPetsDto(List<Pet> pets);

    List<Pet> toPets(List<PetDto> pets);

    @Mapping(source = "ownerId", target = "owner.id")
    Pet toPet(PetDto petDto);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "owner", ignore = true)
    @Mapping(target = "visits", ignore = true)
    Pet toPet(PetFieldsDto petFieldsDto);

    PetTypeDto toPetTypeDto(PetType petType);

    PetType toPetType(PetTypeDto petTypeDto);

    List<PetTypeDto> toPetTypeDtos(List<PetType> petTypes);
}
