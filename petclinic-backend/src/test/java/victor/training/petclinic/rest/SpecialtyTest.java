package victor.training.petclinic.rest;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.transaction.Transactional;
import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.CacheManager;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import victor.training.petclinic.domain.Specialty;
import victor.training.petclinic.repository.SpecialtyRepository;
import victor.training.petclinic.rest.dto.SpecialtyDto;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "VET_ADMIN")
@Transactional
public class SpecialtyTest {

    @Autowired
    MockMvc mockMvc;

    ObjectMapper mapper = new ObjectMapper()
        .setSerializationInclusion(JsonInclude.Include.ALWAYS);

    @Autowired
    SpecialtyRepository specialtyRepository;

    @Autowired
    CacheManager cacheManager;

    int specialtyId;

    @BeforeEach
    final void before() {
        // The feed cache is not transactional, so drop it between tests to avoid cross-test bleed.
        cacheManager.getCache("specialtyFeed").clear();
        Specialty specialty = new Specialty();
        specialty.setName("radiology");
        specialtyRepository.save(specialty);
        specialtyId = specialty.getId();
    }

    private SpecialtyDto callGet(int specialtyId) throws Exception {
        String responseJson = mockMvc.perform(get("/api/specialties/" + specialtyId))
            .andExpect(status().isOk())
            .andExpect(content().contentType("application/json"))
            .andReturn()
            .getResponse()
            .getContentAsString();
        return mapper.readValue(responseJson, SpecialtyDto.class);
    }

    @Test
    void getByIdOk() throws Exception {
        SpecialtyDto responseDto = callGet(specialtyId);

        assertThat(responseDto.getId()).isEqualTo(specialtyId);
        assertThat(responseDto.getName()).isEqualTo("radiology");
    }

    @Test
    void getById_notFound() throws Exception {
        mockMvc.perform(get("/api/specialties/99999"))
            .andExpect(status().isNotFound());
    }

    @Test
    void getAll() throws Exception {
        String responseJson = mockMvc.perform(get("/api/specialties"))
            .andExpect(status().isOk())
            .andExpect(content().contentType("application/json"))
            .andReturn()
            .getResponse()
            .getContentAsString();
        SpecialtyDto[] specialties = mapper.readValue(responseJson, SpecialtyDto[].class);

        assertThat(specialties)
            .extracting(SpecialtyDto::getId, SpecialtyDto::getName)
            .contains(Assertions.tuple(specialtyId, "radiology"));
    }

    @Test
    void create_ok() throws Exception {
        SpecialtyDto newSpecialty = new SpecialtyDto();
        newSpecialty.setName("surgery");

        mockMvc.perform(post("/api/specialties")
                .content(mapper.writeValueAsString(newSpecialty))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().isCreated());
    }

    @Test
    void create_invalid() throws Exception {
        SpecialtyDto newSpecialty = new SpecialtyDto();
        newSpecialty.setName(null); // invalid - null name

        mockMvc.perform(post("/api/specialties")
                .content(mapper.writeValueAsString(newSpecialty))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().isBadRequest());
    }

    @Test
    void update_ok() throws Exception {
        SpecialtyDto existing = callGet(specialtyId);
        existing.setName("radiology II");

        mockMvc.perform(put("/api/specialties/" + specialtyId)
                .content(mapper.writeValueAsString(existing))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().is2xxSuccessful());

        // assert the update took place
        SpecialtyDto updated = callGet(specialtyId);
        assertThat(updated.getName()).isEqualTo("radiology II");
    }

    @Test
    void update_persistsDescription() throws Exception {
        SpecialtyDto existing = callGet(specialtyId);
        existing.setDescription("Symptoms: limping. Guidance: keep the pet calm.");

        mockMvc.perform(put("/api/specialties/" + specialtyId)
                .content(mapper.writeValueAsString(existing))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().is2xxSuccessful());

        SpecialtyDto updated = callGet(specialtyId);
        assertThat(updated.getDescription()).isEqualTo("Symptoms: limping. Guidance: keep the pet calm.");
    }

    @Test
    void update_invalid() throws Exception {
        SpecialtyDto existing = callGet(specialtyId);
        existing.setName(null); // invalid - null name

        mockMvc.perform(put("/api/specialties/" + specialtyId)
                .content(mapper.writeValueAsString(existing))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
            .andExpect(status().is4xxClientError());
    }

    @Test
    void delete_ok() throws Exception {
        mockMvc.perform(delete("/api/specialties/" + specialtyId))
            .andExpect(status().is2xxSuccessful());

        mockMvc.perform(get("/api/specialties/" + specialtyId))
            .andExpect(status().isNotFound());
    }

    @Test
    void delete_notFound() throws Exception {
        mockMvc.perform(delete("/api/specialties/9999"))
            .andExpect(status().isNotFound());
    }

    @Test
    void feed_returnsAllSpecialtiesWithEtag() throws Exception {
        String etag = mockMvc.perform(get("/api/specialties/feed"))
            .andExpect(status().isOk())
            .andExpect(header().exists(HttpHeaders.ETAG))
            .andReturn().getResponse().getHeader(HttpHeaders.ETAG);

        assertThat(etag).isNotBlank();
    }

    @Test
    void feed_returns304WhenEtagMatches() throws Exception {
        String etag = mockMvc.perform(get("/api/specialties/feed"))
            .andExpect(status().isOk())
            .andReturn().getResponse().getHeader(HttpHeaders.ETAG);

        mockMvc.perform(get("/api/specialties/feed").header(HttpHeaders.IF_NONE_MATCH, etag))
            .andExpect(status().isNotModified());
    }
}
