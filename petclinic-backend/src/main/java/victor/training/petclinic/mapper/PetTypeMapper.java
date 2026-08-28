package victor.training.petclinic.mapper;

import org.springframework.stereotype.Component;
import victor.training.petclinic.domain.PetType;
import victor.training.petclinic.rest.dto.PetTypeDto;
import victor.training.petclinic.rest.dto.PetTypeFieldsDto;

import java.util.ArrayList;
import java.util.List;

@Component
public class PetTypeMapper {

    public PetType toPetType(PetTypeFieldsDto petTypeFieldsDto) {
        if (petTypeFieldsDto == null) {
            return null;
        }
        PetType petType = new PetType();
        petType.setName(petTypeFieldsDto.getName());
        return petType;
    }

    public PetTypeDto toPetTypeDto(PetType petType) {
        if (petType == null) {
            return null;
        }
        PetTypeDto petTypeDto = new PetTypeDto();
        petTypeDto.setName(petType.getName());
        petTypeDto.setId(petType.getId());
        return petTypeDto;
    }

    public PetTypeFieldsDto toPetTypeFieldsDto(PetType petType) {
        if (petType == null) {
            return null;
        }
        PetTypeFieldsDto petTypeFieldsDto = new PetTypeFieldsDto();
        petTypeFieldsDto.setName(petType.getName());
        return petTypeFieldsDto;
    }

    public List<PetTypeDto> toPetTypeDtos(List<PetType> petTypes) {
        if (petTypes == null) {
            return null;
        }
        List<PetTypeDto> dtos = new ArrayList<>(petTypes.size());
        for (PetType petType : petTypes) {
            dtos.add(toPetTypeDto(petType));
        }
        return dtos;
    }
}
