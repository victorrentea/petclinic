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

    // Pins the database's collation: under en_US.UTF-8 'S' sorts as 'S', under the C locale it
    // sorts after every ASCII letter. An index built under the other collation cannot serve this
    // ORDER BY at all, so this must fail loudly rather than quietly reorder pages.
    @Test
    void nonAsciiLastNameSortsWhereTheDeclaredCollationPutsIt() {
        List<String> lastNames = walkAllPages(10, BY_NAME).stream().map(Owner::getLastName).toList();

        assertThat(lastNames.indexOf("\u015aliwi\u0144ski"))
                .as("'Sliwinski' must sort between 'Silver' and 'Tremaine'; if it does not, the "
                        + "database was initialised with a different collation (expected en_US.UTF-8, "
                        + "not C) and the owners index cannot serve this ORDER BY")
                .isGreaterThan(lastNames.indexOf("Silver"))
                .isLessThan(lastNames.indexOf("Tremaine"));
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
