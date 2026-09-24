package victor.training.petclinic.mapper;

import org.springframework.data.domain.Page;
import org.springframework.stereotype.Component;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.rest.dto.OwnerDto;
import victor.training.petclinic.rest.dto.OwnerFieldsDto;
import victor.training.petclinic.rest.dto.OwnerPageDto;
import victor.training.petclinic.rest.dto.OwnerRowDto;

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

    public OwnerPageDto toOwnerPageDto(Page<Owner> page) {
        return new OwnerPageDto(
                page.map(this::toOwnerRowDto).getContent(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.getNumber(),
                page.getSize());
    }

    public OwnerRowDto toOwnerRowDto(Owner owner) {
        return new OwnerRowDto(
                owner.getId(),
                owner.getFirstName(),
                owner.getLastName(),
                owner.getAddress(),
                owner.getCity(),
                owner.getTelephone(),
                owner.getPets().stream().map(Pet::getName).toList());
    }
}
