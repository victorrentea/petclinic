package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.transaction.Transactional;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.repository.OwnerRepository;

/**
 * Under the cluster's "C" (byte-order) collation these surnames sort AFTER "Z" — a lowercase or
 * accented first letter has a higher byte value than 'Z'. V9 pins en-US-x-icu on the column, which
 * is what makes the order below the one a human calls alphabetical.
 */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerCollationTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    OwnerRepository ownerRepository;

    ObjectMapper mapper = new ObjectMapper();

    @Test
    void lowercasePrefixedAndAccentedSurnamesSortInLinguisticOrder() throws Exception {
        List<String> insertedSurnames = List.of("van Gogh", "Ångström", "Zephyr", "Andrews", "de Vries");
        insertedSurnames.forEach(surname -> ownerRepository.save(anOwnerNamed(surname)));

        List<String> sorted = fetchAllPages("/api/owners?sort=name,asc").stream()
            .map(owner -> owner.get("lastName").asText())
            .filter(insertedSurnames::contains)
            .toList();

        assertThat(sorted).containsExactly("Andrews", "Ångström", "de Vries", "van Gogh", "Zephyr");
    }

    private Owner anOwnerNamed(String lastName) {
        return new Owner()
            .setFirstName("Test")
            .setLastName(lastName)
            .setAddress("some address")
            .setCity("Springfield")
            .setTelephone("1234567890");
    }

    private List<JsonNode> fetchAllPages(String uri) throws Exception {
        List<JsonNode> all = new ArrayList<>();
        int pageNumber = 0;
        int totalPages;
        do {
            String json = mockMvc.perform(get(uri + "&size=20&page=" + pageNumber))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
            JsonNode page = mapper.readTree(json);
            page.get("content").forEach(all::add);
            totalPages = page.get("totalPages").asInt();
            pageNumber++;
        } while (pageNumber < totalPages);
        return all;
    }
}
