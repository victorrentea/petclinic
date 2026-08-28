package victor.training.petclinic.mapper;

import org.springframework.stereotype.Component;
import victor.training.petclinic.domain.Vet;
import victor.training.petclinic.rest.dto.VetDto;
import victor.training.petclinic.rest.dto.VetFieldsDto;

import java.util.ArrayList;
import java.util.List;

@Component
public class VetMapper {
    private final SpecialtyMapper specialtyMapper;

    public VetMapper(SpecialtyMapper specialtyMapper) {
        this.specialtyMapper = specialtyMapper;
    }

    public Vet toVet(VetDto vetDto) {
        if (vetDto == null) {
            return null;
        }
        Vet vet = new Vet();
        vet.setId(vetDto.getId());
        vet.setFirstName(vetDto.getFirstName());
        vet.setLastName(vetDto.getLastName());
        vet.setSpecialties(specialtyMapper.toSpecialty(vetDto.getSpecialties()));
        return vet;
    }

    public Vet toVet(VetFieldsDto vetFieldsDto) {
        if (vetFieldsDto == null) {
            return null;
        }
        Vet vet = new Vet();
        vet.setFirstName(vetFieldsDto.getFirstName());
        vet.setLastName(vetFieldsDto.getLastName());
        vet.setSpecialties(specialtyMapper.toSpecialty(vetFieldsDto.getSpecialties()));
        return vet;
    }

    public VetDto toVetDto(Vet vet) {
        if (vet == null) {
            return null;
        }
        VetDto vetDto = new VetDto();
        vetDto.setFirstName(vet.getFirstName());
        vetDto.setLastName(vet.getLastName());
        vetDto.setSpecialties(specialtyMapper.toSpecialtyDtos(vet.getSpecialties()));
        vetDto.setId(vet.getId());
        return vetDto;
    }

    public List<VetDto> toVetDtos(List<Vet> vets) {
        if (vets == null) {
            return null;
        }
        List<VetDto> dtos = new ArrayList<>(vets.size());
        for (Vet vet : vets) {
            dtos.add(toVetDto(vet));
        }
        return dtos;
    }
}
