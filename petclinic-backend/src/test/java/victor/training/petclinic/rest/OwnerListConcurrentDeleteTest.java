package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.mapper.OwnerMapper;
import victor.training.petclinic.mapper.PetMapper;
import victor.training.petclinic.mapper.VisitMapper;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.rest.dto.OwnerDto;
import victor.training.petclinic.rest.dto.OwnerPageDto;

/** The race no database fixture can stage: an owner deleted between the page query and the graph fetch. */
class OwnerListConcurrentDeleteTest {
    private final OwnerRepository ownerRepository = mock(OwnerRepository.class);
    private final OwnerRestController controller = new OwnerRestController(ownerRepository, null, null, null,
            new OwnerMapper(new PetMapper(new VisitMapper())), null, null, null, null);

    @Test
    void anOwnerDeletedAfterThePageQueryIsLeftOutOfThePage() {
        Owner first = owner(1, "Adams");
        Owner deleted = owner(2, "Brown");
        Owner third = owner(3, "Clark");
        when(ownerRepository.findByLastNameStartingWith(anyString(), any()))
                .thenReturn(new PageImpl<>(List.of(first, deleted, third), PageRequest.of(0, 10), 3));
        when(ownerRepository.findAllByIdFetchingPetsAndVisits(List.of(1, 2, 3))).thenReturn(List.of(third, first));

        OwnerPageDto page = controller.listOwners("", null, null, null);

        assertThat(page.content()).extracting(OwnerDto::getId).containsExactly(1, 3);
        assertThat(page.totalElements()).isEqualTo(3);
    }

    private static Owner owner(int id, String lastName) {
        Owner owner = TestData.anOwner();
        owner.setId(id);
        owner.setLastName(lastName);
        return owner;
    }
}
