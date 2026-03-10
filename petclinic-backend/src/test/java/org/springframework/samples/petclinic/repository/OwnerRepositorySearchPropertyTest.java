package org.springframework.samples.petclinic.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.samples.petclinic.model.Owner;

import jakarta.transaction.Transactional;
import net.jqwik.api.Arbitraries;
import net.jqwik.api.Arbitrary;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.Provide;
import net.jqwik.api.Tuple;
import net.jqwik.spring.JqwikSpringSupport;

/**
 * Property-based tests for OwnerRepository.findBySearch method.
 * 
 * **Validates: Requirements AC2.1, AC2.2, AC2.3, AC2.4**
 */
@SpringBootTest
@Transactional
public class OwnerRepositorySearchPropertyTest {

    @Autowired
    private OwnerRepository ownerRepository;

    @BeforeEach
    void setUp() {
        // Clean up before each test
        ownerRepository.findAll().forEach(ownerRepository::delete);
    }

    /**
     * Property CP1: Search Completeness
     * 
     * For any owner O and search text T, if T is a substring of O's name, address, 
     * or city (case-insensitive), then O must appear in the search results.
     * 
     * **Validates: Requirements AC2.1, AC2.2, AC2.3, AC2.4**
     */
    @Property(tries = 100)
    void searchReturnsAllMatchingOwners(
        @ForAll("ownersAndSearchTerm") Tuple.Tuple2<List<Owner>, String> testData
    ) {
        List<Owner> owners = testData.get1();
        String searchTerm = testData.get2();

        // Setup: Insert owners into test database
        List<Owner> insertedOwners = new ArrayList<>();
        for (Owner owner : owners) {
            Owner saved = ownerRepository.save(owner);
            insertedOwners.add(saved);
        }

        // Execute: Search with the generated search term
        Pageable pageable = PageRequest.of(0, 1000); // Large page to get all results
        Page<Owner> results = ownerRepository.findBySearch(searchTerm, pageable);
        List<Owner> resultList = results.getContent();

        // Verify: All owners containing searchTerm are in results
        List<Owner> expectedOwners = insertedOwners.stream()
            .filter(o -> containsIgnoreCase(o.getFirstName(), searchTerm)
                || containsIgnoreCase(o.getLastName(), searchTerm)
                || containsIgnoreCase(o.getAddress(), searchTerm)
                || containsIgnoreCase(o.getCity(), searchTerm))
            .toList();

        // Check that every expected owner is in the results
        for (Owner expected : expectedOwners) {
            boolean found = resultList.stream()
                .anyMatch(r -> r.getId().equals(expected.getId()));
            
            assertThat(found)
                .as("Owner with ID %d (firstName='%s', lastName='%s', address='%s', city='%s') " +
                    "should be found when searching for '%s'",
                    expected.getId(), expected.getFirstName(), expected.getLastName(),
                    expected.getAddress(), expected.getCity(), searchTerm)
                .isTrue();
        }
    }

    /**
     * Provides test data: a list of owners and a search term.
     * The search term is intelligently generated to sometimes match owner fields.
     */
    @Provide
    Arbitrary<Tuple.Tuple2<List<Owner>, String>> ownersAndSearchTerm() {
        Arbitrary<Owner> ownerArbitrary = Arbitraries.randomValue(random -> {
            Owner owner = new Owner();
            owner.setFirstName(generateString(random.nextInt(1, 15)));
            owner.setLastName(generateString(random.nextInt(1, 15)));
            owner.setAddress(generateString(random.nextInt(5, 30)));
            owner.setCity(generateString(random.nextInt(3, 20)));
            owner.setTelephone(generatePhoneNumber());
            return owner;
        });

        Arbitrary<List<Owner>> ownersArbitrary = ownerArbitrary.list().ofMinSize(0).ofMaxSize(20);

        return ownersArbitrary.flatMap(owners -> {
            // Generate search terms that sometimes match owner fields
            Arbitrary<String> searchTermArbitrary = Arbitraries.frequencyOf(
                // 40% chance: substring from an existing owner field
                Tuple.of(4, generateSubstringFromOwners(owners)),
                // 30% chance: random string that might not match
                Tuple.of(3, Arbitraries.strings().alpha().ofMinLength(1).ofMaxLength(10)),
                // 20% chance: empty string (should return all owners)
                Tuple.of(2, Arbitraries.just("")),
                // 10% chance: single character
                Tuple.of(1, Arbitraries.strings().alpha().ofLength(1))
            );

            return searchTermArbitrary.map(searchTerm -> Tuple.of(owners, searchTerm));
        });
    }

    /**
     * Generates a substring from one of the owner fields to ensure some matches.
     */
    private Arbitrary<String> generateSubstringFromOwners(List<Owner> owners) {
        if (owners.isEmpty()) {
            return Arbitraries.strings().alpha().ofMinLength(1).ofMaxLength(10);
        }

        return Arbitraries.randomValue(random -> {
            Owner owner = owners.get(random.nextInt(owners.size()));
            
            // Pick a random field
            String[] fields = {
                owner.getFirstName(),
                owner.getLastName(),
                owner.getAddress(),
                owner.getCity()
            };
            
            String field = fields[random.nextInt(fields.length)];
            
            if (field.isEmpty()) {
                return "";
            }
            
            // Extract a substring
            int start = random.nextInt(field.length());
            int end = random.nextInt(start + 1, field.length() + 1);
            String substring = field.substring(start, end);
            
            // Randomly change case
            return switch (random.nextInt(3)) {
                case 0 -> substring.toLowerCase();
                case 1 -> substring.toUpperCase();
                default -> substring;
            };
        });
    }

    /**
     * Helper method to check if a string contains another string (case-insensitive).
     */
    private boolean containsIgnoreCase(String str, String searchTerm) {
        if (str == null || searchTerm == null) {
            return false;
        }
        if (searchTerm.isEmpty()) {
            return true; // Empty search matches everything
        }
        return str.toUpperCase().contains(searchTerm.toUpperCase());
    }

    /**
     * Generates a random string of specified length.
     */
    private String generateString(int length) {
        StringBuilder sb = new StringBuilder();
        String chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ ";
        for (int i = 0; i < length; i++) {
            sb.append(chars.charAt((int) (Math.random() * chars.length())));
        }
        return sb.toString().trim().isEmpty() ? "a" : sb.toString().trim();
    }

    /**
     * Generates a valid 10-digit phone number.
     */
    private String generatePhoneNumber() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 10; i++) {
            sb.append((int) (Math.random() * 10));
        }
        return sb.toString();
    }
}
