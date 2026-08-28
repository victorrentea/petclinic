package victor.training.petclinic.mapper;

import org.springframework.stereotype.Component;
import victor.training.petclinic.domain.Specialty;
import victor.training.petclinic.rest.dto.SpecialtyDto;

import java.util.ArrayList;
import java.util.List;

@Component
public class SpecialtyMapper {

    public Specialty toSpecialty(SpecialtyDto specialtyDto) {
        if (specialtyDto == null) {
            return null;
        }
        Specialty specialty = new Specialty();
        specialty.setId(specialtyDto.getId());
        specialty.setName(specialtyDto.getName());
        specialty.setDescription(specialtyDto.getDescription());
        return specialty;
    }

    public SpecialtyDto toSpecialtyDto(Specialty specialty) {
        if (specialty == null) {
            return null;
        }
        SpecialtyDto specialtyDto = new SpecialtyDto();
        specialtyDto.setId(specialty.getId());
        specialtyDto.setName(specialty.getName());
        specialtyDto.setDescription(specialty.getDescription());
        return specialtyDto;
    }

    public List<SpecialtyDto> toSpecialtyDtos(List<Specialty> specialties) {
        if (specialties == null) {
            return null;
        }
        List<SpecialtyDto> dtos = new ArrayList<>(specialties.size());
        for (Specialty specialty : specialties) {
            dtos.add(toSpecialtyDto(specialty));
        }
        return dtos;
    }

    public List<Specialty> toSpecialty(List<SpecialtyDto> specialties) {
        if (specialties == null) {
            return null;
        }
        List<Specialty> entities = new ArrayList<>(specialties.size());
        for (SpecialtyDto specialtyDto : specialties) {
            entities.add(toSpecialty(specialtyDto));
        }
        return entities;
    }
}
