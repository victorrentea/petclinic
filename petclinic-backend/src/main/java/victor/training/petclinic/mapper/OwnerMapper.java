package victor.training.petclinic.mapper;

import org.springframework.data.domain.Page;
import org.springframework.stereotype.Component;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.rest.dto.OwnerDto;
import victor.training.petclinic.rest.dto.OwnerFieldsDto;
import victor.training.petclinic.rest.dto.OwnerListItemDto;
import victor.training.petclinic.rest.dto.OwnerPageDto;

import java.util.ArrayList;
import java.util.List;

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

    public OwnerListItemDto toOwnerListItemDto(Owner owner) {
        OwnerListItemDto dto = new OwnerListItemDto();
        dto.setId(owner.getId());
        dto.setFirstName(owner.getFirstName());
        dto.setLastName(owner.getLastName());
        dto.setAddress(owner.getAddress());
        dto.setCity(owner.getCity());
        dto.setTelephone(owner.getTelephone());
        List<String> petNames = new ArrayList<>();
        for (Pet pet : owner.getPets()) {
            petNames.add(pet.getName());
        }
        dto.setPetNames(petNames);
        return dto;
    }

    public OwnerPageDto toOwnerPageDto(Page<Owner> ownerPage) {
        OwnerPageDto pageDto = new OwnerPageDto();
        List<OwnerListItemDto> content = new ArrayList<>();
        for (Owner owner : ownerPage.getContent()) {
            content.add(toOwnerListItemDto(owner));
        }
        pageDto.setContent(content);
        pageDto.setTotalElements(ownerPage.getTotalElements());
        pageDto.setTotalPages(ownerPage.getTotalPages());
        pageDto.setNumber(ownerPage.getNumber());
        pageDto.setSize(ownerPage.getSize());
        return pageDto;
    }
}
