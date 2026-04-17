package org.springframework.samples.petclinic.rest;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.samples.petclinic.rest.dto.OwnerDto;
import org.springframework.test.web.servlet.MockMvc;

import java.text.SimpleDateFormat;
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

abstract class OwnerTestBase {

    @Autowired
    MockMvc mockMvc;

    ObjectMapper mapper = new ObjectMapper()
        .registerModule(new JavaTimeModule())
        .setDateFormat(new SimpleDateFormat("yyyy-MM-dd"))
        .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    @JsonIgnoreProperties(ignoreUnknown = true)
    static class OwnerPageResult {
        public List<OwnerDto> content;
        public long totalElements;
        public int totalPages;
        public int number;
        public int size;
    }

    OwnerDto callGet(int ownerId) throws Exception {
        String responseJson = mockMvc.perform(get("/api/owners/" + ownerId))
            .andExpect(status().isOk())
            .andExpect(content().contentType("application/json"))
            .andReturn()
            .getResponse()
            .getContentAsString();
        return mapper.readValue(responseJson, OwnerDto.class);
    }

    List<OwnerDto> search(String uriTemplate) throws Exception {
        String url = uriTemplate.contains("size=") ? uriTemplate
            : uriTemplate + (uriTemplate.contains("?") ? "&" : "?") + "size=1000";
        return searchPage(url).content;
    }

    OwnerPageResult searchPage(String uriTemplate) throws Exception {
        String responseJson = mockMvc.perform(get(uriTemplate))
            .andExpect(status().isOk())
            .andExpect(content().contentType("application/json"))
            .andReturn()
            .getResponse()
            .getContentAsString();
        return mapper.readValue(responseJson, OwnerPageResult.class);
    }
}

