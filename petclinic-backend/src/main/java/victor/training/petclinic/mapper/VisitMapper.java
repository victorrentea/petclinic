package victor.training.petclinic.mapper;

import org.springframework.stereotype.Component;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.Visit;
import victor.training.petclinic.rest.dto.VisitDto;
import victor.training.petclinic.rest.dto.VisitFieldsDto;

import java.util.ArrayList;
import java.util.List;

@Component
public class VisitMapper {

    public Visit toVisit(VisitDto visitDto) {
        Visit visit = new Visit();
        visit.setPet(petOfId(visitDto.getPetId()));
        visit.setId(visitDto.getId());
        visit.setDate(visitDto.getDate());
        visit.setDescription(visitDto.getDescription());
        return visit;
    }

    public Visit toVisit(VisitFieldsDto visitFieldsDto) {
        Visit visit = new Visit();
        visit.setDate(visitFieldsDto.getDate());
        visit.setDescription(visitFieldsDto.getDescription());
        return visit;
    }

    public VisitDto toVisitDto(Visit visit) {
        Pet pet = visit.getPet();
        Owner owner = pet == null ? null : pet.getOwner();
        VisitDto visitDto = new VisitDto()
                .setDate(visit.getDate())
                .setDescription(visit.getDescription())
                .setId(visit.getId());
        if (pet != null) {
            visitDto.setPetId(pet.getId())
                    .setPetName(pet.getName());
        }
        if (owner != null) {
            visitDto.setOwnerId(owner.getId())
                    .setOwnerFirstName(owner.getFirstName())
                    .setOwnerLastName(owner.getLastName());
        }
        return visitDto;
    }

    public List<VisitDto> toVisitsDto(List<Visit> visits) {
        if (visits == null) {
            return List.of();
        }
        List<VisitDto> dtos = new ArrayList<>(visits.size());
        for (Visit visit : visits) {
            dtos.add(toVisitDto(visit));
        }
        return dtos;
    }

    private Pet petOfId(Integer petId) {
        Pet pet = new Pet();
        pet.setId(petId);
        return pet;
    }
}
