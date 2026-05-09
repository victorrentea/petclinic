package org.springframework.samples.petclinic.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.springframework.samples.petclinic.model.Owner;
import org.springframework.samples.petclinic.model.Pet;
import org.springframework.samples.petclinic.rest.dto.OwnerSummaryDto;
import org.springframework.samples.petclinic.rest.dto.PetSummaryDto;

import java.util.List;

@Mapper(componentModel = "spring")
public interface OwnerSummaryMapper {

    @Mapping(target = "displayName", expression = "java(owner.getFirstName() + \" \" + owner.getLastName())")
    OwnerSummaryDto toSummaryDto(Owner owner);

    PetSummaryDto toPetSummaryDto(Pet pet);

    List<PetSummaryDto> toPetSummaryDtos(List<Pet> pets);
}
