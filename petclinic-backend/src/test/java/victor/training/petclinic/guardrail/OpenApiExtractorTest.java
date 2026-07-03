package victor.training.petclinic.guardrail;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
@ActiveProfiles("test")
public class OpenApiExtractorTest {

    @Autowired
    MockMvc mockMvc;

    @Test
    void generateOpenApiYaml() throws Exception {
        String yaml = mockMvc.perform(get("/v3/api-docs.yaml")).andReturn().getResponse().getContentAsString();
        Path target = Path.of("../openapi.yaml");
        Files.createDirectories(target.getParent());
        Files.writeString(target, yaml, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
    }

    @Test
    void listOwnersSchema_isTypedAsOwnerPage() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.paths['/api/owners'].get.responses['200'].content['application/json'].schema.$ref")
                .value("#/components/schemas/OwnerPage"));
    }
}
