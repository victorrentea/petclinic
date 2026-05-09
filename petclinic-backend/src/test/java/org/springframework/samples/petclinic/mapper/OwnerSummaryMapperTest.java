package org.springframework.samples.petclinic.mapper;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.samples.petclinic.model.Owner;
import org.springframework.samples.petclinic.model.Pet;
import org.springframework.samples.petclinic.model.PetType;
import org.springframework.samples.petclinic.model.Visit;
import org.springframework.samples.petclinic.rest.dto.OwnerSummaryDto;
import org.springframework.samples.petclinic.rest.dto.PetSummaryDto;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class OwnerSummaryMapperTest {

    @Autowired
    private OwnerSummaryMapper ownerSummaryMapper;

    @Test
    void shouldMapOwnerToOwnerSummaryDto() {
        // Given
        Owner owner = new Owner();
        owner.setId(42);
        owner.setFirstName("George");
        owner.setLastName("Franklin");
        owner.setAddress("110 W. Liberty St.");
        owner.setCity("Madison");
        owner.setTelephone("6085551023");

        Pet pet = new Pet();
        pet.setId(7);
        pet.setName("Leo");
        pet.setBirthDate(LocalDate.of(2015, 3, 1));
        PetType type = new PetType();
        type.setId(1);
        type.setName("cat");
        pet.setType(type);
        pet.setOwner(owner);

        Visit visit = new Visit();
        visit.setId(100);
        visit.setDate(LocalDate.of(2023, 1, 15));
        visit.setDescription("rabies shot");
        pet.addVisit(visit);

        owner.setPets(List.of(pet));

        // When
        OwnerSummaryDto dto = ownerSummaryMapper.toSummaryDto(owner);

        // Then
        assertThat(dto.id()).isEqualTo(42);
        assertThat(dto.displayName()).isEqualTo("George Franklin");
        assertThat(dto.address()).isEqualTo("110 W. Liberty St.");
        assertThat(dto.city()).isEqualTo("Madison");
        assertThat(dto.telephone()).isEqualTo("6085551023");

        // Pets should contain only id and name — no visit data leakage
        assertThat(dto.pets()).hasSize(1);
        PetSummaryDto petDto = dto.pets().get(0);
        assertThat(petDto.id()).isEqualTo(7);
        assertThat(petDto.name()).isEqualTo("Leo");
    }

    @Test
    void shouldMapOwnerWithNoPets() {
        Owner owner = new Owner();
        owner.setId(1);
        owner.setFirstName("Jane");
        owner.setLastName("Doe");
        owner.setAddress("123 Main St.");
        owner.setCity("Springfield");
        owner.setTelephone("5551234567");

        OwnerSummaryDto dto = ownerSummaryMapper.toSummaryDto(owner);

        assertThat(dto.id()).isEqualTo(1);
        assertThat(dto.displayName()).isEqualTo("Jane Doe");
        assertThat(dto.pets()).isEmpty();
    }
}
