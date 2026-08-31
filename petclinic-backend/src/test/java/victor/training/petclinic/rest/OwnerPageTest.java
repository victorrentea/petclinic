package victor.training.petclinic.rest;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import org.hibernate.cfg.AvailableSettings;
import org.hibernate.resource.jdbc.spi.StatementInspector;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.repository.OwnerRepository;

/**
 * The server-side page/sort/filter contract of {@code GET /api/owners} — see
 * {@code openspec/changes/paginate-owners-grid}. The clinic grows to ~100.000 owners, so the
 * endpoint must never be able to return the whole table, and consecutive pages must partition
 * the collection instead of overlapping.
 */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
public class OwnerPageTest {

    private static final List<String> recordedSql = Collections.synchronizedList(new ArrayList<>());

    @TestConfiguration
    static class SqlCaptureConfig {
        @Bean
        HibernatePropertiesCustomizer captureSql() {
            StatementInspector inspector = OwnerPageTest::record;
            return properties -> properties.put(AvailableSettings.STATEMENT_INSPECTOR, inspector);
        }
    }

    static String record(String sql) {
        recordedSql.add(sql);
        return sql;
    }

    @Autowired
    MockMvc mockMvc;

    @Autowired
    OwnerRepository ownerRepository;

    @Autowired
    EntityManager entityManager;

    ObjectMapper mapper = new ObjectMapper();

    @Test
    void defaultPage_holds10OwnersAndReportsTheTrueTotal() throws Exception {
        int totalOwners = (int) ownerRepository.count();

        mockMvc.perform(get("/api/owners"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(10))
                .andExpect(jsonPath("$.page.size").value(10))
                .andExpect(jsonPath("$.page.number").value(0))
                .andExpect(jsonPath("$.page.totalElements").value(totalOwners))
                .andExpect(jsonPath("$.page.totalPages").value((totalOwners + 9) / 10));
    }

    @Test
    void defaultPage_isOrderedByLastNameAscending() throws Exception {
        List<String> lastNames = stringsAt("/api/owners", "lastName");

        assertThat(lastNames).isSorted();
    }

    @Test
    void walkingEveryPageOfACitySort_coversEachOwnerExactlyOnce() throws Exception {
        seedOwnersSharingOneCity(20);
        int totalOwners = (int) ownerRepository.count();
        int lastPage = (totalOwners + 4) / 5;

        List<Integer> idsSeen = new ArrayList<>();
        for (int page = 0; page < lastPage; page++) {
            idsSeen.addAll(idsAt("/api/owners?sort=city,asc&size=5&page=" + page));
        }

        assertThat(idsSeen).doesNotHaveDuplicates().hasSize(totalOwners);
        assertThat(idsSeen).containsExactlyInAnyOrderElementsOf(allOwnerIds());
    }

    @Test
    void sortingByANonWhitelistedColumn_isRejected() throws Exception {
        mockMvc.perform(get("/api/owners?sort=address"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void sortingThroughARelation_isRejected() throws Exception {
        mockMvc.perform(get("/api/owners?sort=pets.visits.description"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void anOversizedPage_isRejected() throws Exception {
        mockMvc.perform(get("/api/owners?size=100000"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void anArbitraryPageSize_isRejected() throws Exception {
        mockMvc.perform(get("/api/owners?size=7"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aPageBeyondTheLastOne_isEmptyButStillCountsEverything() throws Exception {
        int totalOwners = (int) ownerRepository.count();

        mockMvc.perform(get("/api/owners?size=10&page=999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0))
                .andExpect(jsonPath("$.page.totalElements").value(totalOwners))
                .andExpect(jsonPath("$.page.totalPages").value((totalOwners + 9) / 10));
    }

    @Test
    void aFilteredPage_countsOnlyTheMatchingOwners() throws Exception {
        int totalOwners = (int) ownerRepository.count();

        String json = getJson("/api/owners?lastName=Pot");
        JsonNode page = mapper.readTree(json);

        assertThat(stringsIn(page, "lastName")).isNotEmpty().allMatch(name -> name.startsWith("Pot"));
        assertThat(page.at("/page/totalElements").asInt())
                .isEqualTo(page.at("/content").size())
                .isLessThan(totalOwners);
    }

    @Test
    void aFilterMatchingNothing_isAnEmptyPageOfZero() throws Exception {
        mockMvc.perform(get("/api/owners?lastName=NoSuchFamily"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0))
                .andExpect(jsonPath("$.page.totalElements").value(0));
    }

    /**
     * The grid renders pet names, so a page of owners drags its pets along. That must cost a
     * bounded number of statements — the page, its count, one batch of pets and one batch of their
     * visits — never one per owner or one per pet.
     */
    @Test
    void theWholePageOfPets_loadsInTwoStatements() throws Exception {
        entityManager.flush();
        entityManager.clear();
        recordedSql.clear();

        mockMvc.perform(get("/api/owners?size=10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(10));

        assertThat(selectsFrom("owners")).as("the page query plus its count query").hasSize(2);
        assertThat(selectsFrom("pets")).as("all pets of the page in one batched query, not one per owner")
                .hasSize(1);
        assertThat(selectsFrom("visits")).as("all visits of the page's pets in one batched query, not one per pet")
                .hasSize(1);
    }

    private List<String> selectsFrom(String table) {
        synchronized (recordedSql) {
            return recordedSql.stream().filter(sql -> sql.contains("from " + table)).toList();
        }
    }

    private void seedOwnersSharingOneCity(int count) {
        for (int i = 0; i < count; i++) {
            Owner owner = TestData.anOwner();
            owner.setFirstName("Tied" + i);
            owner.setLastName("Tied" + i);
            owner.setCity("Ankh-Morpork");
            ownerRepository.save(owner);
        }
        entityManager.flush();
    }

    private List<Integer> allOwnerIds() {
        return entityManager.createQuery("select o.id from Owner o", Integer.class).getResultList();
    }

    private String getJson(String uri) throws Exception {
        return mockMvc.perform(get(uri))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
    }

    private List<Integer> idsAt(String uri) throws Exception {
        List<Integer> ids = new ArrayList<>();
        for (JsonNode owner : mapper.readTree(getJson(uri)).at("/content")) {
            ids.add(owner.get("id").asInt());
        }
        return ids;
    }

    private List<String> stringsAt(String uri, String field) throws Exception {
        return stringsIn(mapper.readTree(getJson(uri)), field);
    }

    private List<String> stringsIn(JsonNode page, String field) {
        List<String> values = new ArrayList<>();
        for (JsonNode owner : page.at("/content")) {
            values.add(owner.get(field).asText());
        }
        return values;
    }
}
