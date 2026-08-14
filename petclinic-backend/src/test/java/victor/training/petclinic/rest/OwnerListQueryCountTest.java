package victor.training.petclinic.rest;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
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
import org.hibernate.SessionFactory;
import victor.training.petclinic.domain.Owner;

/**
 * D4's guardrail. A fetch join would make one page load the WHOLE result set and paginate it in
 * memory - which is faster-looking at 28 rows and fatal at 10,000, and which no functional test
 * can see. Two things give it away and both are asserted here: the number of Owner entities
 * hydrated must equal the page size, and Hibernate must not log HHH000104.
 *
 * The query count is asserted to grow by at most a constant when the page size quadruples, which
 * is what @BatchSize buys and what an un-batched N+1 would break.
 */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
class OwnerListQueryCountTest {

    private static final String IN_MEMORY_PAGINATION_WARNING = "HHH000104";

    @Autowired
    MockMvc mockMvc;

    @Autowired
    EntityManagerFactory entityManagerFactory;

    private Statistics statistics;
    private ListAppender<ILoggingEvent> hibernateLog;

    @BeforeEach
    void startRecording() {
        statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        // Switched on here rather than via @TestPropertySource: a unique property set would give
        // this class its own application context instead of the one every other @SpringBootTest
        // in this package shares.
        statistics.setStatisticsEnabled(true);
        hibernateLog = new ListAppender<>();
        hibernateLog.start();
        hibernateLogger().addAppender(hibernateLog);
    }

    @AfterEach
    void stopRecording() {
        hibernateLogger().detachAppender(hibernateLog);
    }

    @Test
    void aPageLoadCostsAFewQueriesRegardlessOfPageSize() throws Exception {
        long queriesForFive = statementsWhileListing(5);
        long queriesForTwenty = statementsWhileListing(20);

        assertThat(queriesForTwenty)
                .describedAs("quadrupling the page size must not multiply the query count")
                .isLessThanOrEqualTo(queriesForFive + 2);
    }

    @Test
    void onlyThePageIsHydratedNotTheWholeResultSet() throws Exception {
        statistics.clear();
        mockMvc.perform(get("/api/owners?size=5&sort=name,asc")).andExpect(status().isOk());

        assertThat(ownersLoaded())
                .describedAs("a fetch join would hydrate every matching owner, not just the page")
                .isEqualTo(5);
    }

    @Test
    void hibernateNeverFallsBackToPaginatingInMemory() throws Exception {
        for (String sort : new String[]{"name,asc", "city,desc", "petCount,asc"}) {
            mockMvc.perform(get("/api/owners?size=20&sort=" + sort)).andExpect(status().isOk());
        }

        assertThat(hibernateLog.list)
                .extracting(ILoggingEvent::getFormattedMessage)
                .describedAs("in-memory pagination is a warning, not a failure - only a test catches it")
                .noneMatch(message -> message.contains(IN_MEMORY_PAGINATION_WARNING));
    }

    private long statementsWhileListing(int pageSize) throws Exception {
        statistics.clear();
        mockMvc.perform(get("/api/owners?size=" + pageSize + "&sort=name,asc"))
                .andExpect(status().isOk());
        return statistics.getPrepareStatementCount();
    }

    private long ownersLoaded() {
        return statistics.getEntityStatistics(Owner.class.getName()).getLoadCount();
    }

    private static Logger hibernateLogger() {
        return (Logger) LoggerFactory.getLogger("org.hibernate");
    }
}
