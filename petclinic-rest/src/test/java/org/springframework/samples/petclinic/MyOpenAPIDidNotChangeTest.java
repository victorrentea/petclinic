package org.springframework.samples.petclinic;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import org.apache.commons.lang3.StringUtils;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.Resource;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Map;

import static java.nio.charset.Charset.defaultCharset;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

@SpringBootTest
@AutoConfigureMockMvc
public class MyOpenAPIDidNotChangeTest {
    @Autowired
    MockMvc mockMvc;

    @Value("classpath:/my_openapi.yaml")
    Resource contractFile;

    @Test
    void my_contract_did_not_change() throws Exception {
        String contractExtractedFromCode = mockMvc.perform(get("/v3/api-docs.yaml"))
            .andReturn().getResponse().getContentAsString();

        String contractSavedOnGit = contractFile.getContentAsString(defaultCharset())
            .replace(":8080", "");

        assertThat(prettifyYaml(contractExtractedFromCode))
            .isEqualTo(prettifyYaml(contractSavedOnGit));
    }

    private String prettifyYaml(String rawYaml) throws JsonProcessingException {
        if (StringUtils.isBlank(rawYaml)) return rawYaml;
        // parse YAML into a Map and re-serialize as YAML to normalize formatting and ordering
        ObjectMapper yamlMapper = new ObjectMapper(new YAMLFactory());
        Map<?, ?> map = yamlMapper.readValue(rawYaml, Map.class);
        return yamlMapper.writerWithDefaultPrettyPrinter().writeValueAsString(map);
    }

    @Disabled("Run this test manually to update src/test/resources/my_openapi.yaml with the current API contract")
    @Test
    public void updateStoredOpenApiYaml() throws Exception {
        String yaml = mockMvc.perform(get("/v3/api-docs.yaml")).andReturn().getResponse().getContentAsString();

        Path target = Path.of("src/test/resources/my_openapi.yaml");
        Files.createDirectories(target.getParent());
        Files.writeString(target, yaml, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);

        System.out.println("WROTE " + target.toAbsolutePath());
    }
}
