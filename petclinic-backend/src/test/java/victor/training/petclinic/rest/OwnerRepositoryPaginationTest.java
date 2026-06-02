package victor.training.petclinic.rest;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import victor.training.petclinic.model.Owner;
import victor.training.petclinic.repository.OwnerRepository;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
class OwnerRepositoryPaginationTest {

    @Autowired
    OwnerRepository ownerRepository;

    @Test
    void findByLastNameStartingWith_paginatesAndSortsByFirstName() {
          ownerRepository.save(TestData.anOwner().setLastName("Davis").setFirstName("Betty"));
        ownerRepository.save(TestData.anOwner().setLastName("Davis").setFirstName("Alice"));
        ownerRepository.save(TestData.anOwner().setLastName("Holmes").setFirstName("Sherlock"));
        org.springframework.data.domain.Page<Owner> page = ownerRepository.findByLastNameStartingWith(
                "Davis",
                PageRequest.of(0, 10, Sort.by("firstName").ascending())
        );

        assertThat(page.getTotalElements()).isEqualTo(2);

        List<Owner> content = page.getContent();
        assertThat(content).allMatch(o -> o.getLastName().startsWith("Davis"));
        assertThat(content.get(0).getFirstName()).isLessThan(content.get(1).getFirstName());
    }
}
