package victor.training.petclinic.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import victor.training.petclinic.model.Vet;
import victor.training.petclinic.model.Visit;
import victor.training.petclinic.rest.dto.VisitDto;
import victor.training.petclinic.rest.dto.VisitFieldsDto;

import java.util.List;

@Mapper(componentModel = "spring", uses = PetMapper.class)
public interface VisitMapper {

    @Mapping(source = "petId", target = "pet.id")
    @Mapping(target = "pet.name", ignore = true)
    @Mapping(target = "pet.owner", ignore = true)
    @Mapping(source = "vetId", target = "vet.id")
    @Mapping(target = "vet.firstName", ignore = true)
    @Mapping(target = "vet.lastName", ignore = true)
    @Mapping(target = "vet.specialties", ignore = true)
    Visit toVisit(VisitDto visitDto);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "pet", ignore = true)
    @Mapping(source = "vetId", target = "vet.id")
    @Mapping(target = "vet.firstName", ignore = true)
    @Mapping(target = "vet.lastName", ignore = true)
    @Mapping(target = "vet.specialties", ignore = true)
    Visit toVisit(VisitFieldsDto visitFieldsDto);

    @Mapping(source = "pet.id", target = "petId")
    @Mapping(source = "pet.name", target = "petName")
    @Mapping(source = "pet.owner.id", target = "ownerId")
    @Mapping(source = "pet.owner.firstName", target = "ownerFirstName")
    @Mapping(source = "pet.owner.lastName", target = "ownerLastName")
    @Mapping(source = "vet.id", target = "vetId")
    @Mapping(source = "vet", target = "vetName")
    VisitDto toVisitDto(Visit visit);

    List<VisitDto> toVisitsDto(List<Visit> visits);

    default String mapVetName(Vet vet) {
        if (vet == null) {
            return null;
        }
        return vet.getFirstName() + " " + vet.getLastName();
    }
}
