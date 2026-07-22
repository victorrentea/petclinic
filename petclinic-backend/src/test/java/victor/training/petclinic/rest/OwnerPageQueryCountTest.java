package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;

/**
 * Guards two regressions that are invisible to a functional test:
 * an N+1 over pets (one query per owner), and Hibernate's in-memory pagination fallback
 * (HHH000104) that a JOIN FETCH combined with a Pageable would silently trigger.
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
class OwnerPageQueryCountTest {

    private static final int GENEROUS_QUERY_BUDGET = 5;

    @Autowired
    MockMvc mockMvc;

    @Autowired
    SessionFactory sessionFactory;

    @Test
    void aPageOfOwnersWithPetsCostsABoundedNumberOfQueries() throws Exception {
        Statistics statistics = sessionFactory.getStatistics();
        statistics.clear();

        mockMvc.perform(get("/api/owners?size=20&sort=name,asc"))
            .andExpect(status().isOk());

        assertThat(statistics.getPrepareStatementCount())
            .as("a 20-owner page must not issue one query per owner to load pets")
            .isLessThanOrEqualTo(GENEROUS_QUERY_BUDGET);
    }
}
