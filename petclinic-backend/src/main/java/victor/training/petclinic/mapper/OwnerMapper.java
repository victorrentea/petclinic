package victor.training.petclinic.mapper;

import org.springframework.data.domain.Page;
import org.springframework.stereotype.Component;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.rest.dto.OwnerDto;
import victor.training.petclinic.rest.dto.OwnerFieldsDto;
import victor.training.petclinic.rest.dto.OwnerPageDto;

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
        return new OwnerPageDto()
                .setContent(page.map(this::toOwnerDto).getContent())
                .setTotalElements(page.getTotalElements())
                .setTotalPages(page.getTotalPages())
                .setNumber(page.getNumber())
                .setSize(page.getSize());
    }
}
