package victor.training.petclinic.rest.dto;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/** Verifies PageDto serializes to the documented page envelope shape (see design.md Decision 1). */
class PageDtoTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void serializesToTheDocumentedEnvelopeShape() throws Exception {
        PageDto<String> page = new PageDto<>(List.of("a", "b"), 42L, 5, 1, 10);

        JsonNode json = mapper.readTree(mapper.writeValueAsString(page));

        List<String> content = mapper.convertValue(json.get("content"), List.class);
        assertThat(content).containsExactly("a", "b");
        assertThat(json.get("totalElements").asLong()).isEqualTo(42L);
        assertThat(json.get("totalPages").asInt()).isEqualTo(5);
        assertThat(json.get("number").asInt()).isEqualTo(1);
        assertThat(json.get("size").asInt()).isEqualTo(10);
    }
}
