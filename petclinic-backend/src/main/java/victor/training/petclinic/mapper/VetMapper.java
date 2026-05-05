package victor.training.petclinic.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import victor.training.petclinic.model.Vet;
import victor.training.petclinic.rest.dto.VetDto;
import victor.training.petclinic.rest.dto.VetFieldsDto;

import java.util.List;

@Mapper(componentModel = "spring", uses = SpecialtyMapper.class)
public interface VetMapper {
    Vet toVet(VetDto vetDto);

    @Mapping(target = "id", ignore = true)
    Vet toVet(VetFieldsDto vetFieldsDto);

    VetDto toVetDto(Vet vet);

    List<VetDto> toVetDtos(List<Vet> vets);
}
