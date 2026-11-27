package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.List;

import org.assertj.core.api.SoftAssertions;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import jakarta.transaction.Transactional;

/** GH #25: the product owner expects ~100,000 owners within a year. */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerListAtScaleTest {
    @Autowired
    JdbcTemplate jdbc;
    @Autowired
    MockMvc mockMvc;
    @Autowired
    EntityManager entityManager;
    @Autowired
    EntityManagerFactory entityManagerFactory;

    /** Seeded once: each test method gets a fresh database copy, so 100k inserts per query would be waste. */
    @Test
    void everyPageQueryUsesAnIndex_with100kOwners() {
        jdbc.execute("""
                INSERT INTO owners (first_name, last_name, address, city, telephone)
                SELECT 'First' || g, 'L' || md5(g::text), 'Street ' || g, 'City ' || (g % 700), '0123456789'
                FROM generate_series(1, 100000) g""");
        jdbc.execute("ANALYZE owners");

        SoftAssertions.assertSoftly(softly -> List.of(
                "ORDER BY last_name, first_name, id LIMIT 20 OFFSET 20000",
                "ORDER BY city DESC, last_name DESC, first_name DESC, id DESC LIMIT 20 OFFSET 20000",
                "WHERE last_name LIKE 'Lab%' ORDER BY last_name, first_name, id LIMIT 20",
                "WHERE last_name LIKE 'Lab%' ORDER BY city, last_name, first_name, id LIMIT 20").forEach(pageQuery -> {
                    List<String> plan = jdbc.queryForList("EXPLAIN SELECT * FROM owners " + pageQuery, String.class);
                    softly.assertThat(String.join("\n", plan)).as(pageQuery).doesNotContain("Seq Scan on owners");
                }));
    }

    @Test
    void aPageCostsTheSameNumberOfQueries_whateverItsSize() throws Exception {
        jdbc.execute("""
                INSERT INTO owners (first_name, last_name, address, city, telephone)
                SELECT 'First' || g, 'Last' || g, 'Street', 'City', '0123456789' FROM generate_series(1, 20) g""");
        jdbc.execute("""
                INSERT INTO pets (name, birth_date, type_id, owner_id)
                SELECT 'Pet' || o.id || '-' || n, DATE '2020-01-01', (SELECT min(id) FROM types), o.id
                FROM owners o CROSS JOIN generate_series(1, 2) n""");
        jdbc.update("INSERT INTO visits (pet_id, visit_date, description) SELECT id, ?, 'check-up' FROM pets",
                LocalDate.of(2024, 1, 1));

        assertThat(statementsToList(5)).isEqualTo(statementsToList(20));
    }

    private long statementsToList(int pageSize) throws Exception {
        entityManager.clear();
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
        mockMvc.perform(get("/api/owners?size=" + pageSize)).andExpect(status().isOk());
        return statistics.getPrepareStatementCount();
    }
}
