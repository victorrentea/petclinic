package victor.training.petclinic.mapper;

import org.mapstruct.Mapper;
import victor.training.petclinic.model.Specialty;
import victor.training.petclinic.rest.dto.SpecialtyDto;

import java.util.List;

@Mapper(componentModel = "spring")
public interface SpecialtyMapper {
    Specialty toSpecialty(SpecialtyDto specialtyDto);

    SpecialtyDto toSpecialtyDto(Specialty specialty);

    List<SpecialtyDto> toSpecialtyDtos(List<Specialty> specialties);

    List<Specialty> toSpecialty(List<SpecialtyDto> specialties);

}
