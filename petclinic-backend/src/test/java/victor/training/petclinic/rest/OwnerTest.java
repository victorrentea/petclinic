package victor.training.petclinic.rest;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import victor.training.petclinic.model.Owner;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.rest.dto.OwnerDto;
import victor.training.petclinic.rest.dto.OwnerPageDto;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerTest {
    @Autowired
    MockMvc mockMvc;
    @Autowired
    OwnerRepository ownerRepository;

    ObjectMapper mapper = new ObjectMapper();

    @Test
    void listOwners_returnsPagedAndSortedResults() throws Exception {
        ownerRepository.save(owner("Amy", "Zeal", "task1-a", "Zurich", "1111111111"));
        ownerRepository.save(owner("Bob", "Able", "task1-b", "Athens", "2222222222"));
        ownerRepository.save(owner("Cara", "Mills", "task1-c", "Berlin", "3333333333"));

        String json = mockMvc.perform(get("/api/owners")
                .param("query", "task1-")
                .param("page", "0")
                .param("size", "2")
                .param("sortField", "name")
                .param("sortDirection", "asc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType("application/json"))
            .andReturn()
            .getResponse()
            .getContentAsString();

        OwnerPageDto page = mapper.readValue(json, OwnerPageDto.class);
        assertThat(page.getTotalElements()).isEqualTo(3);
        assertThat(page.getTotalPages()).isEqualTo(2);
        assertThat(page.getNumber()).isEqualTo(0);
        assertThat(page.getSize()).isEqualTo(2);
        assertThat(page.getContent()).extracting(OwnerDto::getLastName).containsExactly("Able", "Mills");
    }

    @Test
    void listOwners_filtersAndSortsByCityDescending() throws Exception {
        ownerRepository.save(owner("Dora", "Lane", "filter-lane-1", "Cluj", "4444444444"));
        ownerRepository.save(owner("Eli", "Lane", "filter-lane-2", "Arad", "5555555555"));
        ownerRepository.save(owner("Finn", "Other", "filter-other", "Zurich", "6666666666"));

        String json = mockMvc.perform(get("/api/owners")
                .param("query", "Lane")
                .param("page", "0")
                .param("size", "5")
                .param("sortField", "city")
                .param("sortDirection", "desc"))
            .andExpect(status().isOk())
            .andExpect(content().contentType("application/json"))
            .andReturn()
            .getResponse()
            .getContentAsString();

        OwnerPageDto page = mapper.readValue(json, OwnerPageDto.class);
        assertThat(page.getTotalElements()).isEqualTo(2);
        assertThat(page.getTotalPages()).isEqualTo(1);
        assertThat(page.getContent()).extracting(OwnerDto::getCity).containsExactly("Cluj", "Arad");
        assertThat(page.getContent()).extracting(OwnerDto::getLastName).containsOnly("Lane");
    }

    @Test
    void listOwners_rejectsUnsupportedSortField() throws Exception {
        mockMvc.perform(get("/api/owners")
                .param("sortField", "telephone"))
            .andExpect(status().isBadRequest());
    }

    private Owner owner(String firstName, String lastName, String address, String city, String telephone) {
        return new Owner()
            .setFirstName(firstName)
            .setLastName(lastName)
            .setAddress(address)
            .setCity(city)
            .setTelephone(telephone);
    }
}
