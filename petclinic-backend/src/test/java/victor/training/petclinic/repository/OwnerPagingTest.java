package victor.training.petclinic.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.transaction.Transactional;
import victor.training.petclinic.domain.Owner;

/**
 * The database does the limiting: a page request never materialises the whole table, and the
 * ordering is total, so walking every page yields each owner exactly once.
 */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@Transactional
class OwnerPagingTest {

    private static final Sort BY_NAME = Sort.by("lastName", "firstName", "id");

    @Autowired
    OwnerRepository ownerRepository;

    @Test
    void firstPageHoldsOnlyItsOwnRowsButCountsThemAll() {
        long seeded = ownerRepository.count();
        assertThat(seeded).as("seed dataset").isGreaterThan(10);

        Page<Owner> page = ownerRepository.findByLastNameStartingWith("", PageRequest.of(0, 10, BY_NAME));

        assertThat(page.getContent()).hasSize(10);
        assertThat(page.getTotalElements()).isEqualTo(seeded);
        assertThat(page.getNumber()).isZero();
        assertThat(page.getSize()).isEqualTo(10);
    }

    // Postgres may return equal-key rows in any order per query, so under LIMIT/OFFSET a duplicate
    // last name can land on two pages or none unless the id closes the ordering.
    @Test
    void everyOwnerAppearsOnExactlyOnePageDespiteDuplicateLastNames() {
        Sort byLastNameThenId = Sort.by("lastName", "id");

        List<Owner> walked = walkAllPages(5, byLastNameThenId);

        assertThat(walked).hasSize((int) ownerRepository.count());
        assertThat(walked).extracting(Owner::getId).doesNotHaveDuplicates();
        assertThat(walked).extracting(Owner::getLastName).filteredOn("Potter"::equals).hasSize(2);
        assertThat(walked).extracting(Owner::getLastName).filteredOn("Darling"::equals).hasSize(2);
    }

    // The seed's one non-ASCII surname (Śliwiński) is where a paged ORDER BY goes wrong quietly:
    // the collation that decides where it lands is the server's, and it differs between a dev
    // machine (en_US.UTF-8) and the CI runner (C.UTF-8). Asserting a position would pin the
    // locale, not the code. What is ours is that LIMIT/OFFSET must not reorder anything — so the
    // paged walk is compared against the same query run in one go.
    @Test
    void pagingPreservesTheOrderTheDatabaseItselfProduces() {
        List<Integer> unpaged = ownerRepository
                .findByLastNameStartingWith("", PageRequest.of(0, 1000, BY_NAME))
                .getContent().stream().map(Owner::getId).toList();

        List<Integer> walked = walkAllPages(3, BY_NAME).stream().map(Owner::getId).toList();

        assertThat(walked)
                .as("a 3-row page walk must yield the same sequence as one unpaged query")
                .containsExactlyElementsOf(unpaged);
    }

    private List<Owner> walkAllPages(int pageSize, Sort sort) {
        List<Owner> all = new ArrayList<>();
        Page<Owner> page = ownerRepository.findByLastNameStartingWith("", PageRequest.of(0, pageSize, sort));
        all.addAll(page.getContent());
        while (page.hasNext()) {
            page = ownerRepository.findByLastNameStartingWith("", page.nextPageable());
            all.addAll(page.getContent());
        }
        return all;
    }
}
