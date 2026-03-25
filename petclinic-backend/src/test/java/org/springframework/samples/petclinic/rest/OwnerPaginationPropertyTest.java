package org.springframework.samples.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.samples.petclinic.PetClinicApplication;
import org.springframework.samples.petclinic.model.Owner;
import org.springframework.samples.petclinic.repository.OwnerRepository;
import org.springframework.samples.petclinic.rest.dto.OwnerDto;
import org.springframework.samples.petclinic.rest.dto.PagedOwnersDto;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.constraints.AlphaChars;
import net.jqwik.api.constraints.IntRange;
import net.jqwik.api.constraints.Size;
import net.jqwik.api.lifecycle.AfterProperty;
import net.jqwik.api.lifecycle.BeforeProperty;

/**
 * Property-based tests for the paginated owner list endpoint.
 *
 * jqwik does not integrate with Spring's @SpringBootTest lifecycle, so we
 * bootstrap a real Spring context once per property via @BeforeProperty and
 * roll back each try manually using TransactionTemplate.
 */
public class OwnerPaginationPropertyTest {

    private static ConfigurableApplicationContext ctx;
    private MockMvc mockMvc;
    private OwnerRepository ownerRepository;
    private TransactionTemplate txTemplate;

    private final ObjectMapper mapper = new ObjectMapper()
        .registerModule(new JavaTimeModule())
        .setDateFormat(new SimpleDateFormat("yyyy-MM-dd"))
        .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    @BeforeProperty
    void startContext() {
        if (ctx == null || !ctx.isActive()) {
            ctx = new org.springframework.boot.builder.SpringApplicationBuilder(PetClinicApplication.class)
                .properties(
                    "spring.profiles.active=h2",
                    "petclinic.security.enable=false",
                    "server.port=0"   // random port — avoids conflict with running dev server
                )
                .run();
        }
        ownerRepository = ctx.getBean(OwnerRepository.class);
        PlatformTransactionManager txManager = ctx.getBean(PlatformTransactionManager.class);
        txTemplate = new TransactionTemplate(txManager);
        mockMvc = MockMvcBuilders
            .webAppContextSetup((WebApplicationContext) ctx)
            .apply(springSecurity())
            .build();
    }

    @AfterProperty
    void stopContext() {
        // Keep context alive across properties for speed; it is closed by JVM shutdown.
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private Owner saveOwner(String firstName, String lastName) {
        return txTemplate.execute(status -> {
            Owner o = new Owner();
            o.setFirstName(firstName);
            o.setLastName(lastName);
            o.setAddress("1 Test St");
            o.setCity("Testville");
            o.setTelephone("1234567890");
            return ownerRepository.save(o);
        });
    }

    private void deleteOwner(Owner o) {
        txTemplate.executeWithoutResult(status -> ownerRepository.delete(o));
    }

    private List<OwnerDto> collectAllPages(String baseUrl, int size) throws Exception {
        List<OwnerDto> all = new ArrayList<>();
        int page = 0;
        while (true) {
            String sep = baseUrl.contains("?") ? "&" : "?";
            String url = baseUrl + sep + "page=" + page + "&size=" + size;
            String json = mockMvc.perform(
                    get(url).with(SecurityMockMvcRequestPostProcessors.user("user").roles("OWNER_ADMIN")))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
            PagedOwnersDto dto = mapper.readValue(json, PagedOwnersDto.class);
            if (dto.owners().isEmpty()) break;
            all.addAll(dto.owners());
            page++;
            if (page >= dto.totalPages()) break;
        }
        return all;
    }

    /**
     * Validates: Requirements 1.1, 1.2, 2.1
     *
     * Feature: owners-pagination, Property 1: pagination covers all owners exactly once
     */
    @Property(tries = 20)
    void PaginationCoversAllOwnersProperty(
            @ForAll @Size(min = 1, max = 12) List<@AlphaChars @net.jqwik.api.constraints.NotEmpty String> firstNames,
            @ForAll @IntRange(min = 1, max = 10) int pageSize
    ) throws Exception {
        String prefix = "P1x" + System.nanoTime();
        List<Owner> seeded = new ArrayList<>();
        for (int i = 0; i < firstNames.size(); i++) {
            seeded.add(saveOwner(firstNames.get(i), prefix + i));
        }
        try {
            List<OwnerDto> collected = collectAllPages("/api/owners?lastName=" + prefix, pageSize);
            List<Integer> collectedIds = collected.stream().map(OwnerDto::getId).sorted().collect(Collectors.toList());
            List<Integer> expectedIds  = seeded.stream().map(Owner::getId).sorted().collect(Collectors.toList());
            assertThat(collectedIds).isEqualTo(expectedIds);
        } finally {
            seeded.forEach(this::deleteOwner);
        }
    }

    /**
     * Validates: Requirements 1.3, 2.1
     *
     * Feature: owners-pagination, Property 3: filtered pagination covers all matching owners exactly once
     */
    @Property(tries = 20)
    void FilteredPaginationCoversMatchingOwnersProperty(
            @ForAll @Size(min = 2, max = 10) List<@AlphaChars @net.jqwik.api.constraints.NotEmpty String> firstNames,
            @ForAll @IntRange(min = 1, max = 8) int pageSize
    ) throws Exception {
        String matchPrefix = "P3M" + System.nanoTime();
        String otherPrefix = "P3O" + System.nanoTime();
        List<Owner> matchOwners = new ArrayList<>();
        List<Owner> otherOwners = new ArrayList<>();
        for (int i = 0; i < firstNames.size(); i++) {
            matchOwners.add(saveOwner(firstNames.get(i), matchPrefix + i));
            otherOwners.add(saveOwner(firstNames.get(i), otherPrefix + i));
        }
        try {
            List<OwnerDto> collected = collectAllPages("/api/owners?lastName=" + matchPrefix, pageSize);
            List<Integer> collectedIds = collected.stream().map(OwnerDto::getId).sorted().collect(Collectors.toList());
            List<Integer> expectedIds  = matchOwners.stream().map(Owner::getId).sorted().collect(Collectors.toList());
            assertThat(collectedIds).isEqualTo(expectedIds);
        } finally {
            matchOwners.forEach(this::deleteOwner);
            otherOwners.forEach(this::deleteOwner);
        }
    }

    /**
     * Validates: Requirements 1.7
     *
     * Feature: owners-pagination, Property 6: sorted order is consistent across pages
     */
    @Property(tries = 20)
    void SortedOrderAcrossPagesProperty(
            @ForAll @Size(min = 2, max = 12) List<@AlphaChars @net.jqwik.api.constraints.NotEmpty String> firstNames,
            @ForAll @IntRange(min = 1, max = 6) int pageSize
    ) throws Exception {
        String prefix = "P6x" + System.nanoTime();
        List<Owner> seeded = new ArrayList<>();
        for (int i = 0; i < firstNames.size(); i++) {
            seeded.add(saveOwner(firstNames.get(i), prefix + i));
        }
        try {
            List<OwnerDto> collected = collectAllPages("/api/owners?lastName=" + prefix, pageSize);
            List<String> fullNames = collected.stream()
                .map(o -> o.getFirstName() + " " + o.getLastName())
                .collect(Collectors.toList());
            List<String> sorted = new ArrayList<>(fullNames);
            sorted.sort(Comparator.naturalOrder());
            assertThat(fullNames).isEqualTo(sorted);
        } finally {
            seeded.forEach(this::deleteOwner);
        }
    }

    /**
     * Validates: Requirements 1.3, 2.1
     *
     * Feature: owners-pagination, Property 7: totalElements equals the count of matching owners
     */
    @Property(tries = 20)
    void TotalElementsEqualsMatchingCountProperty(
            @ForAll @Size(min = 1, max = 12) List<@AlphaChars @net.jqwik.api.constraints.NotEmpty String> firstNames,
            @ForAll @IntRange(min = 1, max = 10) int pageSize
    ) throws Exception {
        String matchPrefix = "P7M" + System.nanoTime();
        String otherPrefix = "P7O" + System.nanoTime();
        List<Owner> matchOwners = new ArrayList<>();
        List<Owner> otherOwners = new ArrayList<>();
        for (int i = 0; i < firstNames.size(); i++) {
            matchOwners.add(saveOwner(firstNames.get(i), matchPrefix + i));
            otherOwners.add(saveOwner(firstNames.get(i), otherPrefix + i));
        }
        try {
            String json = mockMvc.perform(
                    get("/api/owners?lastName=" + matchPrefix + "&page=0&size=" + pageSize)
                        .with(SecurityMockMvcRequestPostProcessors.user("user").roles("OWNER_ADMIN")))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
            PagedOwnersDto dto = mapper.readValue(json, PagedOwnersDto.class);
            assertThat(dto.totalElements()).isEqualTo(matchOwners.size());
        } finally {
            matchOwners.forEach(this::deleteOwner);
            otherOwners.forEach(this::deleteOwner);
        }
    }
}
