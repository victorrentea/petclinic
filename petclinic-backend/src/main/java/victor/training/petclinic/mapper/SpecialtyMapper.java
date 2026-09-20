package victor.training.petclinic.mapper;

import org.springframework.stereotype.Component;
import victor.training.petclinic.domain.Specialty;
import victor.training.petclinic.rest.dto.SpecialtyDto;

import java.util.ArrayList;
import java.util.List;

@Component
public class SpecialtyMapper {

    public Specialty toSpecialty(SpecialtyDto specialtyDto) {
        Specialty specialty = new Specialty();
        specialty.setId(specialtyDto.getId());
        specialty.setName(specialtyDto.getName());
        specialty.setDescription(specialtyDto.getDescription());
        return specialty;
    }

    public SpecialtyDto toSpecialtyDto(Specialty specialty) {
        return new SpecialtyDto()
                .setId(specialty.getId())
                .setName(specialty.getName())
                .setDescription(specialty.getDescription());
    }

    public List<SpecialtyDto> toSpecialtyDtos(List<Specialty> specialties) {
        if (specialties == null) {
            return List.of();
        }
        List<SpecialtyDto> dtos = new ArrayList<>(specialties.size());
        for (Specialty specialty : specialties) {
            dtos.add(toSpecialtyDto(specialty));
        }
        return dtos;
    }

    public List<Specialty> toSpecialty(List<SpecialtyDto> specialties) {
        if (specialties == null) {
            return new ArrayList<>();
        }
        List<Specialty> entities = new ArrayList<>(specialties.size());
        for (SpecialtyDto specialtyDto : specialties) {
            entities.add(toSpecialty(specialtyDto));
        }
        return entities;
    }
}
