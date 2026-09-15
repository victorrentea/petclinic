package victor.training.petclinic.mapper;

import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.rest.dto.OwnerListItemDto;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class OwnerMapperTest {
    private final OwnerMapper mapper = new OwnerMapper(new PetMapper(new VisitMapper()));

    @Test
    void toListItems_copiesFieldsAndGroupsSortedPetNamesPerOwner() {
        Owner radcliff = ownerOf(6, "Roger", "Radcliff", "London");
        Owner poirot = ownerOf(13, "Hercule", "Poirot", "London");
        Page<Owner> page = new PageImpl<>(List.of(radcliff, poirot), PageRequest.of(0, 10), 2);

        // insertion order is Pongo, Perdita — deliberately not alphabetical
        List<PetRepository.OwnerPetName> petNames = List.of(petNameOf(6, "Pongo"), petNameOf(6, "Perdita"));

        List<OwnerListItemDto> items = mapper.toListItems(page, petNames);

        assertThat(items).hasSize(2);
        OwnerListItemDto radcliffItem = items.get(0);
        assertThat(radcliffItem.getId()).isEqualTo(6);
        assertThat(radcliffItem.getFirstName()).isEqualTo("Roger");
        assertThat(radcliffItem.getLastName()).isEqualTo("Radcliff");
        assertThat(radcliffItem.getPetNames()).containsExactly("Perdita", "Pongo");

        OwnerListItemDto poirotItem = items.get(1);
        assertThat(poirotItem.getId()).isEqualTo(13);
        assertThat(poirotItem.getPetNames()).isEmpty();
    }

    private static Owner ownerOf(int id, String firstName, String lastName, String city) {
        Owner owner = new Owner();
        owner.setId(id);
        owner.setFirstName(firstName);
        owner.setLastName(lastName);
        owner.setCity(city);
        owner.setAddress("some address");
        owner.setTelephone("0000000000");
        return owner;
    }

    private static PetRepository.OwnerPetName petNameOf(int ownerId, String name) {
        return new PetRepository.OwnerPetName() {
            @Override
            public Integer getOwnerId() {
                return ownerId;
            }

            @Override
            public String getName() {
                return name;
            }
        };
    }
}
