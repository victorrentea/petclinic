package victor.training.petclinic.mapper;

import org.springframework.stereotype.Component;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.rest.dto.OwnerDto;
import victor.training.petclinic.rest.dto.OwnerFieldsDto;

import java.util.ArrayList;
import java.util.List;

@Component
public class OwnerMapper {
    private final PetMapper petMapper;

    public OwnerMapper(PetMapper petMapper) {
        this.petMapper = petMapper;
    }

    public OwnerDto toOwnerDto(Owner owner) {
        return new OwnerDto()
                .setId(owner.getId())
                .setFirstName(owner.getFirstName())
                .setLastName(owner.getLastName())
                .setAddress(owner.getAddress())
                .setCity(owner.getCity())
                .setTelephone(owner.getTelephone())
                .setPets(petMapper.toPetsDto(owner.getPets()));
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
