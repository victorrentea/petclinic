package victor.training.petclinic.mapper;

import org.springframework.stereotype.Component;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.PetType;
import victor.training.petclinic.domain.Visit;
import victor.training.petclinic.rest.dto.PetDto;
import victor.training.petclinic.rest.dto.PetFieldsDto;
import victor.training.petclinic.rest.dto.PetTypeDto;
import victor.training.petclinic.rest.dto.VisitDto;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Component
public class PetMapper {
    private final VisitMapper visitMapper;

    public PetMapper(VisitMapper visitMapper) {
        this.visitMapper = visitMapper;
    }

    public PetDto toPetDto(Pet pet) {
        PetDto petDto = new PetDto();
        Owner owner = pet.getOwner();
        if (owner != null) {
            petDto.setOwnerId(owner.getId());
        }
        petDto.setVisits(visitMapper.toVisitsDto(pet.getVisitsSortedByDate()));
        petDto.setName(pet.getName());
        petDto.setBirthDate(pet.getBirthDate());
        petDto.setType(toPetTypeDto(pet.getType()));
        petDto.setId(pet.getId());
        return petDto;
    }

    public List<PetDto> toPetsDto(List<Pet> pets) {
        if (pets == null) {
            return List.of();
        }
        List<PetDto> dtos = new ArrayList<>(pets.size());
        for (Pet pet : pets) {
            dtos.add(toPetDto(pet));
        }
        return dtos;
    }

    public List<Pet> toPets(List<PetDto> pets) {
        if (pets == null) {
            return new ArrayList<>();
        }
        List<Pet> entities = new ArrayList<>(pets.size());
        for (PetDto petDto : pets) {
            entities.add(toPet(petDto));
        }
        return entities;
    }

    public Pet toPet(PetDto petDto) {
        Pet pet = new Pet();
        pet.setOwner(ownerOfId(petDto.getOwnerId()));
        pet.setId(petDto.getId());
        pet.setName(petDto.getName());
        pet.setBirthDate(petDto.getBirthDate());
        pet.setType(toPetType(petDto.getType()));
        pet.setVisits(toVisits(petDto.getVisits()));
        return pet;
    }

    public Pet toPet(PetFieldsDto petFieldsDto) {
        Pet pet = new Pet();
        pet.setName(petFieldsDto.getName());
        pet.setBirthDate(petFieldsDto.getBirthDate());
        pet.setType(toPetType(petFieldsDto.getType()));
        return pet;
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

    public PetType toPetType(PetTypeDto petTypeDto) {
        if (petTypeDto == null) {
            return null;
        }
        PetType petType = new PetType();
        petType.setId(petTypeDto.getId());
        petType.setName(petTypeDto.getName());
        return petType;
    }

    public List<PetTypeDto> toPetTypeDtos(List<PetType> petTypes) {
        if (petTypes == null) {
            return List.of();
        }
        List<PetTypeDto> dtos = new ArrayList<>(petTypes.size());
        for (PetType petType : petTypes) {
            dtos.add(toPetTypeDto(petType));
        }
        return dtos;
    }

    private Owner ownerOfId(Integer ownerId) {
        Owner owner = new Owner();
        owner.setId(ownerId);
        return owner;
    }

    private Set<Visit> toVisits(List<VisitDto> visitDtos) {
        if (visitDtos == null) {
            return new LinkedHashSet<>();
        }
        Set<Visit> visits = LinkedHashSet.newLinkedHashSet(visitDtos.size());
        for (VisitDto visitDto : visitDtos) {
            visits.add(visitMapper.toVisit(visitDto));
        }
        return visits;
    }
}
