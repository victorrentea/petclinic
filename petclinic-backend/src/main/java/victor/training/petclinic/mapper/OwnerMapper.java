package victor.training.petclinic.mapper;

import org.springframework.data.domain.Page;
import org.springframework.stereotype.Component;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.rest.dto.OwnerDto;
import victor.training.petclinic.rest.dto.OwnerFieldsDto;
import victor.training.petclinic.rest.dto.OwnerListItemDto;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Component
public class OwnerMapper {
    private final PetMapper petMapper;

    public OwnerMapper(PetMapper petMapper) {
        this.petMapper = petMapper;
    }

    public OwnerDto toOwnerDto(Owner owner) {
        OwnerDto ownerDto = new OwnerDto();
        ownerDto.setId(owner.getId());
        ownerDto.setFirstName(owner.getFirstName());
        ownerDto.setLastName(owner.getLastName());
        ownerDto.setAddress(owner.getAddress());
        ownerDto.setCity(owner.getCity());
        ownerDto.setTelephone(owner.getTelephone());
        ownerDto.setPets(petMapper.toPetsDto(owner.getPets()));
        return ownerDto;
    }

    public Owner toOwner(OwnerFieldsDto ownerDto) {
        Owner owner = new Owner();
        owner.setFirstName(ownerDto.getFirstName());
        owner.setLastName(ownerDto.getLastName());
        owner.setAddress(ownerDto.getAddress());
        owner.setCity(ownerDto.getCity());
        owner.setTelephone(ownerDto.getTelephone());
        return owner;
    }

    public List<OwnerListItemDto> toListItems(Page<Owner> ownerPage, List<PetRepository.OwnerPetName> petNames) {
        Map<Integer, List<String>> petNamesByOwnerId = groupSortedPetNamesByOwnerId(petNames);

        List<OwnerListItemDto> items = new ArrayList<>(ownerPage.getNumberOfElements());
        for (Owner owner : ownerPage.getContent()) {
            OwnerListItemDto dto = new OwnerListItemDto();
            dto.setId(owner.getId());
            dto.setFirstName(owner.getFirstName());
            dto.setLastName(owner.getLastName());
            dto.setAddress(owner.getAddress());
            dto.setCity(owner.getCity());
            dto.setTelephone(owner.getTelephone());
            dto.setPetNames(petNamesByOwnerId.getOrDefault(owner.getId(), List.of()));
            items.add(dto);
        }
        return items;
    }

    private Map<Integer, List<String>> groupSortedPetNamesByOwnerId(List<PetRepository.OwnerPetName> petNames) {
        Map<Integer, List<String>> petNamesByOwnerId = petNames.stream()
                .collect(Collectors.groupingBy(PetRepository.OwnerPetName::getOwnerId,
                        Collectors.mapping(PetRepository.OwnerPetName::getName, Collectors.toList())));
        petNamesByOwnerId.values().forEach(Collections::sort);
        return petNamesByOwnerId;
    }

    public List<OwnerDto> toOwnerDtoCollection(List<Owner> ownerCollection) {
        if (ownerCollection == null) {
            return List.of();
        }
        List<OwnerDto> dtos = new ArrayList<>(ownerCollection.size());
        for (Owner owner : ownerCollection) {
            dtos.add(toOwnerDto(owner));
        }
        return dtos;
    }
}
