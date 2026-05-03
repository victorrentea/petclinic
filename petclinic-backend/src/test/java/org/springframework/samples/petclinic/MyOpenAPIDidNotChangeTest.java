package org.springframework.samples.petclinic;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import org.apache.commons.lang3.StringUtils;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.core.io.Resource;
import org.springframework.samples.petclinic.mapper.OwnerMapper;
import org.springframework.samples.petclinic.mapper.PetMapper;
import org.springframework.samples.petclinic.mapper.PetTypeMapper;
import org.springframework.samples.petclinic.mapper.SpecialtyMapper;
import org.springframework.samples.petclinic.mapper.UserMapper;
import org.springframework.samples.petclinic.mapper.VetMapper;
import org.springframework.samples.petclinic.mapper.VisitMapper;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Map;

import static java.nio.charset.Charset.defaultCharset;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

@SpringBootTest
@AutoConfigureMockMvc
public class MyOpenAPIDidNotChangeTest {

    @Autowired
    MockMvc mockMvc;

    @Value("file:${user.dir}/../openapi.yaml")
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

        ObjectMapper YAML_MAPPER = new ObjectMapper(new YAMLFactory())
            .enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS);
        Map<?, ?> map = YAML_MAPPER.readValue(rawYaml, Map.class);
        return YAML_MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(map);
    }

    @Disabled("Run this test manually to update ../openapi.yaml with the current API contract")
    @Test
    public void updateStoredOpenApiYaml() throws Exception {
        String yaml = mockMvc.perform(get("/v3/api-docs.yaml")).andReturn().getResponse().getContentAsString();

        Path target = Path.of("../openapi.yaml");
        Files.createDirectories(target.getParent());
        Files.writeString(target, yaml, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);

        System.out.println("WROTE " + target.toAbsolutePath());
    }

    @TestConfiguration
    static class MapperTestConfiguration {
        @Bean
        @Primary
        OwnerMapper ownerMapper() {
            return mock(OwnerMapper.class);
        }

        @Bean
        @Primary
        PetMapper petMapper() {
            return mock(PetMapper.class);
        }

        @Bean
        @Primary
        PetTypeMapper petTypeMapper() {
            return mock(PetTypeMapper.class);
        }

        @Bean
        @Primary
        SpecialtyMapper specialtyMapper() {
            return mock(SpecialtyMapper.class);
        }

        @Bean
        @Primary
        UserMapper userMapper() {
            return mock(UserMapper.class);
        }

        @Bean
        @Primary
        VetMapper vetMapper() {
            return mock(VetMapper.class);
        }

        @Bean
        @Primary
        VisitMapper visitMapper() {
            return mock(VisitMapper.class);
        }
    }
}
