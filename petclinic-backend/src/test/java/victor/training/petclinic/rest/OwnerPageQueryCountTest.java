package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.persistence.EntityManagerFactory;

/**
 * Guards decision D10. Owners → pets → visits are all LAZY, so before batch fetching one 10-row page
 * cost roughly one query per owner plus one per pet (~46); at the planned 10,000 owners that shape
 * is the production incident this change exists to prevent.
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
class OwnerPageQueryCountTest {

    /** count + owners + batched pets + batched visits, with headroom — the point is ~3, not ~46. */
    private static final int GENEROUS_UPPER_BOUND = 8;

    @Autowired
    MockMvc mockMvc;

    @Autowired
    EntityManagerFactory entityManagerFactory;

    @Test
    void onePageCostsAHandfulOfQueriesNotOnePerOwner() throws Exception {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();

        mockMvc.perform(get("/api/owners?page=0&size=10")).andExpect(status().isOk());

        assertThat(statistics.getPrepareStatementCount())
            .as("a query per owner means ~46 statements for one page, and ~22,000 at 10k owners")
            .isBetween(1L, (long) GENEROUS_UPPER_BOUND);
    }

    /**
     * {@code HHH000104} is Hibernate announcing that it gave up on paginating in SQL and loaded
     * every matching row into memory instead — which a collection {@code JOIN FETCH} on the paged
     * query would trigger silently.
     */
    @Test
    void pagingHappensInSqlNotInMemory() throws Exception {
        Logger hibernateQueryLog = (Logger) LoggerFactory.getLogger("org.hibernate.orm.query");
        ListAppender<ILoggingEvent> captured = new ListAppender<>();
        captured.start();
        hibernateQueryLog.addAppender(captured);
        try {
            mockMvc.perform(get("/api/owners?page=0&size=10")).andExpect(status().isOk());

            assertThat(captured.list)
                .as("HHH000104 = firstResult/maxResults applied in memory")
                .noneMatch(event -> event.getFormattedMessage().contains("HHH000104"));
        } finally {
            hibernateQueryLog.detachAppender(captured);
        }
    }
}
