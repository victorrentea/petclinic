package victor.training.petclinic.mapper;

import org.springframework.stereotype.Component;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.rest.dto.OwnerDto;
import victor.training.petclinic.rest.dto.OwnerFieldsDto;
import victor.training.petclinic.rest.dto.OwnerRowDto;

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

    public OwnerRowDto toOwnerRowDto(Owner owner) {
        return new OwnerRowDto(
                owner.getId(),
                owner.getFirstName(),
                owner.getLastName(),
                owner.getAddress(),
                owner.getCity(),
                owner.getTelephone());
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
}
