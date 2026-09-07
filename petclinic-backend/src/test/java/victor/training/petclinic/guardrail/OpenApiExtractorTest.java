package victor.training.petclinic.guardrail;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static java.nio.file.StandardOpenOption.CREATE;
import static java.nio.file.StandardOpenOption.TRUNCATE_EXISTING;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
@AutoConfigureMockMvc
public class OpenApiExtractorTest {

    @Autowired
    MockMvc mockMvc;

    @Test // not a test
    void generateOpenApiYaml() throws Exception {
        String contractFromCode = mockMvc.perform(get("/v3/api-docs.yaml"))
                .andReturn().getResponse().getContentAsString();
        Files.writeString(Path.of("../openapi.yaml"), contractFromCode, CREATE, TRUNCATE_EXISTING);
    }
}
