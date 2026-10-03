package victor.training.petclinic.rest;

import static java.util.Comparator.comparing;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.StreamSupport;

import org.hibernate.resource.jdbc.spi.StatementInspector;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.PetType;
import victor.training.petclinic.domain.Visit;

/**
 * Ordering and data access of GET /api/owners against a fixture with name/city ties, owners without pets
 * and pets with several visits. Every request starts cold: the fixture is flushed and evicted, and
 * second-level/query caches are off, so a statement count reflects what a fresh request costs.
 */
@SpringBootTest(properties = {
        "spring.jpa.properties.hibernate.cache.use_second_level_cache=false",
        "spring.jpa.properties.hibernate.cache.use_query_cache=false",
        // Hibernate's default for LIMIT over a JOIN FETCH-ed collection is to page in memory with a warning
        "spring.jpa.properties.hibernate.query.fail_on_pagination_over_collection_fetch=true",
})
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
@Import(OwnerListQueryTest.SqlRecorderConfig.class)
class OwnerListQueryTest {
    private static final String PREFIX = "Qpage";
    private static final int OWNERS = 25;
    private static final int PETS_PER_OWNER = 2;
    private static final int VISITS_PER_PET = 2;
    private static final String LIMIT = "(?i)\\b(limit|fetch first|fetch next)\\b";

    @TestConfiguration
    static class SqlRecorderConfig {
        @Bean
        SqlRecorder sqlRecorder() {
            return new SqlRecorder();
        }

        @Bean
        HibernatePropertiesCustomizer recordSql(SqlRecorder recorder) {
            return props -> props.put("hibernate.session_factory.statement_inspector", recorder);
        }
    }

    static class SqlRecorder implements StatementInspector {
        private final List<String> statements = new CopyOnWriteArrayList<>();

        @Override
        public String inspect(String sql) {
            statements.add(sql);
            return sql;
        }
    }

    @Autowired
    MockMvc mockMvc;

    @Autowired
    EntityManager entityManager;

    @Autowired
    SqlRecorder sqlRecorder;

    private final ObjectMapper mapper = new ObjectMapper();
    private final List<Owner> fixture = new ArrayList<>();

    /**
     * 25 owners over 5 last names x 3 first names (so full-name ties), 4 shared cities;
     * every 5th owner has no pets, the rest 2 pets of different types with 2 visits each.
     */
    @BeforeEach
    void persistFixture() {
        PetType cat = petType("qcat");
        PetType dog = petType("qdog");
        for (int i = 0; i < OWNERS; i++) {
            Owner owner = TestData.anOwner();
            owner.setLastName(PREFIX + letter(i * 7 % 5));
            owner.setFirstName("F" + letter(i % 3));
            owner.setCity("C" + letter(i % 4));
            entityManager.persist(owner);
            if (i % 5 != 0) {
                addPet(owner, "Pa" + i, cat);
                addPet(owner, "Pb" + i, dog);
            }
            fixture.add(owner);
        }
        entityManager.flush();
        entityManager.clear();
        sqlRecorder.statements.clear();
    }

    @ParameterizedTest
    @ValueSource(strings = {"name,asc", "name,desc", "city,asc", "city,desc"})
    void traversingAllPages_visitsEveryOwnerOnceInOrder(String sort) throws Exception {
        assertThat(traverse(sort)).containsExactlyElementsOf(expectedIds(sort));
    }

    @Test
    void sameFullName_tiesAreBrokenById() throws Exception {
        List<Integer> ascending = traverse("name,asc");
        List<Integer> descending = traverse("name,desc");

        List<Owner> sameName = fixture.stream()
                .filter(o -> o.getLastName().equals(PREFIX + "a") && o.getFirstName().equals("Fa"))
                .toList();
        assertThat(sameName).hasSizeGreaterThan(1);
        List<Integer> sameNameIds = sameName.stream().map(Owner::getId).toList();
        assertThat(ascending.stream().filter(sameNameIds::contains).toList())
                .hasSameSizeAs(sameNameIds).isSorted();
        assertThat(descending.stream().filter(sameNameIds::contains).toList())
                .hasSameSizeAs(sameNameIds).isSortedAccordingTo(Comparator.reverseOrder());
    }

    @ParameterizedTest
    @ValueSource(strings = {"5", "20"})
    void fullPage_costsAtMostThreeSelects_pagingInTheDatabase(String size) throws Exception {
        JsonNode response = list(size, "0", "name,asc");

        assertThat(response.path("content").size()).isEqualTo(Integer.parseInt(size));
        List<String> sql = sqlRecorder.statements;
        assertThat(sql).hasSizeLessThanOrEqualTo(3).allMatch(OwnerListQueryTest::isSelect);
        assertThat(sql.get(0)).as("the owner page is cut by the database").containsPattern(LIMIT);
        assertThat(sql).filteredOn(s -> s.contains(" pets ")).singleElement()
                .as("pets are loaded once, unpaged, for the selected owners only")
                .satisfies(s -> assertThat(s).doesNotContainPattern(LIMIT));
    }

    @Test
    void fullPage_hasEveryPetTypeAndVisit() throws Exception {
        JsonNode content = list("20", "0", "name,asc").path("content");

        for (JsonNode owner : content) {
            Owner expected = fixture.stream().filter(o -> o.getId() == owner.path("id").asInt()).findFirst()
                    .orElseThrow();
            int expectedPets = expected.getPets().size();
            assertThat(owner.path("pets").size()).as("pets of " + expected).isEqualTo(expectedPets);
            for (JsonNode pet : owner.path("pets")) {
                assertThat(pet.path("type").path("name").asText()).isIn("qcat", "qdog");
                assertThat(pet.path("visits").size()).isEqualTo(VISITS_PER_PET);
            }
        }
        assertThat(content).anyMatch(o -> o.path("pets").isEmpty());
        assertThat(content).anyMatch(o -> o.path("pets").size() == PETS_PER_OWNER);
    }

    @Test
    void emptyPage_loadsNoPets() throws Exception {
        JsonNode response = list("20", "9", "name,asc");

        assertThat(response.path("content").isEmpty()).isTrue();
        assertThat(sqlRecorder.statements).noneMatch(s -> s.contains(" pets "));
    }

    private static boolean isSelect(String sql) {
        return sql.replaceAll("(?s)/\\*.*?\\*/", "").stripLeading().toLowerCase().startsWith("select");
    }

    private List<Integer> expectedIds(String sort) {
        Comparator<Owner> byName = comparing(Owner::getLastName).thenComparing(Owner::getFirstName);
        Comparator<Owner> chain = sort.startsWith("city") ? comparing(Owner::getCity).thenComparing(byName) : byName;
        chain = chain.thenComparing(Owner::getId);
        if (sort.endsWith("desc")) {
            chain = chain.reversed();
        }
        return fixture.stream().sorted(chain).map(Owner::getId).toList();
    }

    private void addPet(Owner owner, String name, PetType type) {
        Pet pet = TestData.aPet();
        pet.setName(name);
        pet.setType(type);
        owner.addPet(pet);
        entityManager.persist(pet);
        for (int v = 0; v < VISITS_PER_PET; v++) {
            Visit visit = new Visit();
            visit.setDate(LocalDate.of(2024, 1, 1 + v));
            visit.setDescription("checkup " + v);
            pet.addVisit(visit);
            entityManager.persist(visit);
        }
    }

    private PetType petType(String name) {
        PetType type = TestData.aPetType(name);
        entityManager.persist(type);
        return type;
    }

    private static String letter(int index) {
        return String.valueOf((char) ('a' + index));
    }

    private List<Integer> traverse(String sort) throws Exception {
        List<Integer> traversed = new ArrayList<>();
        for (int page = 0; page < OWNERS / 5; page++) {
            JsonNode response = list("5", "" + page, sort);
            assertThat(response.path("totalElements").asLong()).isEqualTo(OWNERS);
            traversed.addAll(ids(response));
        }
        return traversed;
    }

    private JsonNode list(String size, String page, String sort) throws Exception {
        String json = mockMvc.perform(get("/api/owners").param("lastName", PREFIX)
                .param("size", size).param("page", page).param("sort", sort))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(json);
    }

    private static List<Integer> ids(JsonNode page) {
        return StreamSupport.stream(page.path("content").spliterator(), false)
                .map(o -> o.path("id").asInt())
                .toList();
    }
}
