package victor.training.petclinic.rest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import jakarta.transaction.Transactional;
import org.hibernate.SessionFactory;
import org.hibernate.resource.jdbc.spi.StatementInspector;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.PetType;
import victor.training.petclinic.domain.Visit;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.jpa.properties.hibernate.generate_statistics=true",
        "spring.jpa.properties.hibernate.session_factory.statement_inspector="
                + "victor.training.petclinic.rest.OwnerListTest$SqlCapture",
        "spring.jpa.properties.hibernate.query.fail_on_pagination_over_collection_fetch=true",
        "spring.jpa.properties.hibernate.cache.use_second_level_cache=false",
        "spring.jpa.properties.hibernate.cache.use_query_cache=false"
})
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerListTest {
    @Autowired
    MockMvc mockMvc;
    @Autowired
    ObjectMapper mapper;
    @Autowired
    EntityManager entityManager;
    @Autowired
    EntityManagerFactory entityManagerFactory;

    @Test
    void defaultsReturnOnlyThePageEnvelope() throws Exception {
        JsonNode page = page("/api/owners");
        List<String> fields = new ArrayList<>();
        page.fieldNames().forEachRemaining(fields::add);
        assertThat(fields).containsExactlyInAnyOrder("content", "totalElements");
        assertThat(page.path("content").size()).isEqualTo(10);
        assertThat(page.path("totalElements").asLong()).isEqualTo(26);
        assertThat(ids(page)).isEqualTo(ids(page("/api/owners?page=0&size=10&sort=name,asc")));
    }

    @ParameterizedTest
    @ValueSource(ints = {5, 10, 20})
    void permittedPageSizes(int size) throws Exception {
        assertThat(page("/api/owners?size=" + size).path("content").size()).isEqualTo(size);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "size=", "page=", "sort=",
            "size=7", "size=0", "size=-1", "size=abc", "size=21", "size=2147483648",
            "page=-1", "page=abc", "page=1.5", "page=2147483648", "page=2147483647",
            "sort=telephone,asc", "sort=lastName,asc", "sort=name", "sort=name,up",
            "sort=name,asc,id", "sort=NAME,asc"
    })
    void rejectsInvalidParameters(String parameters) throws Exception {
        mockMvc.perform(get("/api/owners?" + parameters)).andExpect(status().isBadRequest());
    }

    @Test
    void nameSortUsesFirstNameAndIdInBothDirections() throws Exception {
        List<Integer> expected = new ArrayList<>();
        expected.add(owner("PageTies", "Alice", "York").getId());
        for (int i = 0; i < 6; i++) {
            expected.add(owner("PageTies", "Bob", "York").getId());
        }
        assertThat(allIds("PageTies", "name,asc")).isEqualTo(expected);
        Collections.reverse(expected);
        assertThat(allIds("PageTies", "name,desc")).isEqualTo(expected);
    }

    @Test
    void citySortUsesTheFullTieChain() throws Exception {
        int alice = owner("PageCityA", "Alice", "York").getId();
        int bob = owner("PageCityA", "Bob", "York").getId();
        int laterBob = owner("PageCityA", "Bob", "York").getId();
        int otherName = owner("PageCityZ", "Alice", "York").getId();
        int bristol = owner("PageCityZ", "Alice", "Bristol").getId();
        assertThat(ids(page("/api/owners?lastName=PageCity&sort=city,desc")))
                .containsExactly(otherName, laterBob, bob, alice, bristol);
        assertThat(ids(page("/api/owners?lastName=PageCity&sort=city,asc")))
                .containsExactly(bristol, alice, bob, laterBob, otherName);
    }

    @Test
    void countsFilteredOwnersBeforePaging() throws Exception {
        for (int i = 0; i < 7; i++) {
            owner("PageFilter" + i, "Alice", "London");
        }
        JsonNode page = page("/api/owners?lastName=PageFilter&page=1&size=5");
        assertThat(page.path("totalElements").asLong()).isEqualTo(7);
        assertThat(page.path("content").size()).isEqualTo(2);
        JsonNode pastEnd = page("/api/owners?lastName=PageFilter&page=99&size=5");
        assertThat(pastEnd.path("totalElements").asLong()).isEqualTo(7);
        assertThat(pastEnd.path("content")).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"otter", "Harry", "potter", "Zzzz"})
    void preservesCaseSensitiveLastNamePrefix(String prefix) throws Exception {
        JsonNode page = page("/api/owners?lastName=" + prefix);
        assertThat(page.path("content")).isEmpty();
        assertThat(page.path("totalElements").asLong()).isZero();
    }

    @Test
    void prefixMatchesAndEscapesWildcards() throws Exception {
        assertThat(page("/api/owners?lastName=Pot").path("totalElements").asLong()).isEqualTo(2);
        owner("Page%Literal", "Alice", "York");
        owner("Page_Literal", "Bob", "York");
        owner("PageOther", "Carol", "York");
        for (String prefix : List.of("Page%", "Page_")) {
            String response = mockMvc.perform(get("/api/owners").param("lastName", prefix))
                    .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
            assertThat(mapper.readTree(response).path("totalElements").asLong()).isEqualTo(1);
        }
        assertThat(ids(page("/api/owners?lastName="))).isEqualTo(ids(page("/api/owners")));
    }

    @ParameterizedTest
    @ValueSource(ints = {5, 20})
    void loadsOnlyPageOwnersWithCompleteGraphInThreeQueries(int size) throws Exception {

        List<Integer> ownerIds = populateGraph();
        Statistics statistics = coldStatistics();
        JsonNode page = page("/api/owners?lastName=PageGraph&page=1&size=" + size);
        assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(3);
        assertThat(statistics.getEntityStatistics(Owner.class.getName()).getLoadCount()).isEqualTo(size);
        assertThat(statistics.getEntityStatistics(Pet.class.getName()).getLoadCount()).isEqualTo(size * 2);
        assertThat(statistics.getEntityStatistics(Visit.class.getName()).getLoadCount()).isEqualTo(size * 4);
        assertDatabasePaginationBeforeGraph(size);
        assertThat(ids(page)).isEqualTo(ownerIds.subList(size, size * 2));
        assertThat(page.path("totalElements").asLong()).isEqualTo(42);
        assertThat(page.path("content").size()).isEqualTo(size);
        for (JsonNode owner : page.path("content")) {
            assertThat(owner.path("pets").size()).isEqualTo(2);
            for (JsonNode pet : owner.path("pets")) {
                assertThat(pet.path("type").path("name").asText()).isEqualTo("PageType");
                assertThat(pet.path("visits").size()).isEqualTo(2);
            }
        }
    }

    private void assertDatabasePaginationBeforeGraph(int size) {

        List<String> sql = SqlCapture.STATEMENTS.get();
        assertThat(sql).hasSize(3).allMatch(statement -> statement.startsWith("select "));
        assertThat(sql.get(0)).contains("from owners", "offset ? rows fetch first ? rows only")
                .doesNotContain("join");
        assertThat(sql.get(1)).contains("count(", "from owners").doesNotContain("join");
        assertThat(sql.get(2)).contains("join pets", "join visits", "join types", " in (")
                .doesNotContain("offset", "fetch first");
        String placeholders = String.join(",", Collections.nCopies(size, "?"));
        assertThat(sql.get(2)).contains(" in (" + placeholders + ")");
    }

    @Test
    void includesOwnersWithoutPetsAndSkipsGraphForEmptyPage() throws Exception {
        owner("PageEmpty", "Alice", "York");
        assertThat(page("/api/owners?lastName=PageEmpty").path("content").get(0).path("pets")).isEmpty();
        Statistics statistics = coldStatistics();
        JsonNode page = page("/api/owners?lastName=PageEmpty&page=99");
        assertThat(page.path("totalElements").asLong()).isEqualTo(1);
        assertThat(statistics.getPrepareStatementCount()).isLessThanOrEqualTo(2);
        assertThat(statistics.getEntityLoadCount()).isZero();
    }

    private JsonNode page(String uri) throws Exception {
        String json = mockMvc.perform(get(uri)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(json);
    }

    private List<Integer> ids(JsonNode page) {
        List<Integer> ids = new ArrayList<>();
        page.path("content").forEach(owner -> ids.add(owner.path("id").asInt()));
        return ids;
    }

    private List<Integer> allIds(String prefix, String sort) throws Exception {
        List<Integer> ids = new ArrayList<>();
        for (int index = 0;; index++) {
            JsonNode page = page("/api/owners?lastName=" + prefix + "&size=5&page=" + index + "&sort=" + sort);
            ids.addAll(ids(page));
            if (ids.size() == page.path("totalElements").asLong()) {
                return ids;
            }
            assertThat(page.path("content")).isNotEmpty();
        }
    }

    private Owner owner(String lastName, String firstName, String city) {
        Owner owner = TestData.anOwner();
        owner.setLastName(lastName);
        owner.setFirstName(firstName);
        owner.setCity(city);
        entityManager.persist(owner);
        return owner;
    }

    private Statistics coldStatistics() {

        entityManager.flush();
        entityManager.clear();
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();
        SqlCapture.STATEMENTS.get().clear();
        return statistics;
    }

    private List<Integer> populateGraph() {

        List<Integer> ownerIds = new ArrayList<>();
        PetType type = TestData.aPetType("PageType");
        entityManager.persist(type);
        for (int i = 0; i < 42; i++) {
            Owner owner = owner("PageGraph%02d".formatted(i), "Alice", "York");
            ownerIds.add(owner.getId());
            for (int p = 0; p < 2; p++) {
                Pet pet = new Pet();
                pet.setName("Pet" + p);
                pet.setBirthDate(LocalDate.of(2000, 1, 1));
                pet.setType(type);
                owner.addPet(pet);
                for (int v = 0; v < 2; v++) {
                    Visit visit = new Visit();
                    visit.setDescription("Checkup" + v);
                    pet.addVisit(visit);
                }
                entityManager.persist(pet);
            }
        }
        return ownerIds;
    }

    public static class SqlCapture implements StatementInspector {
        private static final ThreadLocal<List<String>> STATEMENTS = ThreadLocal.withInitial(ArrayList::new);

        @Override
        public String inspect(String sql) {

            STATEMENTS.get().add(sql.replaceAll("(?s)/\\*.*?\\*/\\s*", "")
                    .toLowerCase(Locale.ROOT));
            return sql;
        }
    }
}
