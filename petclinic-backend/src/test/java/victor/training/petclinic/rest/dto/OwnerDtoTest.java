package victor.training.petclinic.rest.dto;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class OwnerDtoTest {

    @Test
    void addPetsItem_appends_and_returns_self() {
        OwnerDto owner = new OwnerDto();
        PetDto pet = new PetDto();
        pet.setName("Leo");

        OwnerDto returned = owner.addPetsItem(pet);

        assertThat(returned).isSameAs(owner);
        assertThat(owner.getPets()).containsExactly(pet);
    }
}
