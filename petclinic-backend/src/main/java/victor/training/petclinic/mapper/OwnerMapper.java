package victor.training.petclinic.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.rest.dto.OwnerDto;
import victor.training.petclinic.rest.dto.OwnerFieldsDto;

@Mapper(componentModel = "spring", uses = PetMapper.class)
public interface OwnerMapper {

    OwnerDto toOwnerDto(Owner owner);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "pets", ignore = true)
    Owner toOwner(OwnerFieldsDto ownerDto);

}
