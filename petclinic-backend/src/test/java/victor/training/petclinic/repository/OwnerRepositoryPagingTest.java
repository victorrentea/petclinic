package victor.training.petclinic.repository;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.rest.TestData;

import jakarta.persistence.EntityManagerFactory;
import jakarta.transaction.Transactional;
import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@Transactional
class OwnerRepositoryPagingTest {

    @Autowired
    OwnerRepository ownerRepository;

    @Autowired
    PetRepository petRepository;

    @Autowired
    EntityManagerFactory entityManagerFactory;

    @Autowired
    DataSource dataSource;

    @Test
    void pageOfFive_issuesExactlyOneSelectAndOneCount() {
        Statistics stats = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        stats.clear();

        Page<Owner> page = ownerRepository.findByLastNameStartingWith("",
                PageRequest.of(0, 5, Sort.by("lastName", "firstName", "id")));

        assertThat(page.getContent()).hasSize(5);
        assertThat(page.getTotalElements()).isEqualTo(28);
        assertThat(stats.getPrepareStatementCount()).isEqualTo(2);
    }

    @Test
    void findOwnerIdAndNameByOwnerIdIn_returnsOnlyThoseOwnersPetsInOneQuery() {
        Statistics stats = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        stats.clear();

        // seed id 6 = Roger Radcliff (Pongo, Perdita), seed id 13 = Hercule Poirot (no pets)
        List<PetRepository.OwnerPetName> petNames = petRepository.findOwnerIdAndNameByOwnerIdIn(List.of(6, 13));

        assertThat(petNames).extracting(PetRepository.OwnerPetName::getName)
                .containsExactlyInAnyOrder("Pongo", "Perdita");
        assertThat(stats.getPrepareStatementCount()).isEqualTo(1);
    }

    @Test
    void nameSort_placesDiacriticsNextToTheirBaseLetter_whenIcuAvailable() throws Exception {
        assumeTrue(icuCollationApplied(), "V9 fell back to default collation on this Postgres");

        ownerRepository.save(anOwnerNamed("Ann", "Smith"));
        ownerRepository.save(anOwnerNamed("Zoe", "Śliwiński"));
        ownerRepository.save(anOwnerNamed("Bob", "Taylor"));

        Page<Owner> all = ownerRepository.findByLastNameStartingWith("",
                PageRequest.of(0, 100, Sort.by("lastName", "firstName", "id")));
        List<String> lastNames = all.getContent().stream().map(Owner::getLastName).toList();

        // ICU compares base letters position by position: "Sliwinski" vs "Smith" — 'l' < 'm'
        // at the second letter — so the diacritic sorts *before* Smith, not after.
        assertThat(lastNames.indexOf("Śliwiński"))
                .isLessThan(lastNames.indexOf("Smith"));
        assertThat(lastNames.indexOf("Smith"))
                .isLessThan(lastNames.indexOf("Taylor"));
    }

    private boolean icuCollationApplied() throws Exception {
        try (Connection c = dataSource.getConnection();
                Statement s = c.createStatement();
                ResultSet rs = s.executeQuery("SELECT 1 FROM pg_collation WHERE collname = 'owner_name'")) {
            return rs.next();
        }
    }

    private static Owner anOwnerNamed(String firstName, String lastName) {
        Owner owner = TestData.anOwner();
        owner.setFirstName(firstName);
        owner.setLastName(lastName);
        return owner;
    }
}
