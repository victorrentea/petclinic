package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;

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
import jakarta.persistence.EntityManagerFactory;

/**
 * A full page of owners costs a fixed number of queries, however many owners and pets it shows.
 * Not {@code @Transactional}: the rows must be committed, so the request loads them in a session
 * of its own, as it would in production, instead of finding them already in the test's.
 */
@SpringBootTest(properties = {
        "spring.jpa.properties.hibernate.generate_statistics=true",
        "logging.level.org.hibernate.engine.internal.StatisticalLoggingSessionEventListener=WARN"})
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
class OwnerListingQueryCountTest {
    private static final int CAT = 1;

    @Autowired
    MockMvc mockMvc;
    @Autowired
    JdbcTemplate jdbc;
    @Autowired
    EntityManagerFactory entityManagerFactory;

    @Test
    void aFullPageOfOwnersWithPets_costsOneQueryEachForOwnersPetsVisitsAndTheCount() throws Exception {
        for (int i = 0; i < 25; i++) {
            givenAnOwnerWithTwoPets("Owner" + i);
        }
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();

        mockMvc.perform(get("/api/owners?size=20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[19].pets.length()").value(2));

        assertThat(statistics.getPrepareStatementCount()).as("owners + pets + visits + count").isEqualTo(4);
    }

    private void givenAnOwnerWithTwoPets(String lastName) {
        Integer ownerId = jdbc.queryForObject("""
                INSERT INTO owners (first_name, last_name, address, city, telephone)
                VALUES ('First', ?, 'addr', 'city', '0000000000') RETURNING id""", Integer.class, lastName);
        for (String pet : new String[]{"Leo", "Basil"}) {
            jdbc.update("INSERT INTO pets (name, birth_date, type_id, owner_id) VALUES (?, ?, ?, ?)",
                    pet, LocalDate.of(2020, 1, 1), CAT, ownerId);
        }
    }
}
