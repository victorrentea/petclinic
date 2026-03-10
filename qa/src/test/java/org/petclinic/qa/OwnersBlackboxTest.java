package org.petclinic.qa;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.WebDriver;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import test.java.org.petclinic.qa.pages.OwnersPage;
import test.java.org.petclinic.qa.support.WebDriverFactory;

class OwnersBlackboxTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(5))
        .build();

    private static final String BASE_URL = System.getProperty("baseUrl", "http://localhost:4200");
    private static final String API_BASE_URL = System.getProperty("apiBaseUrl", "http://localhost:8080/api");

    private WebDriver driver;
    private OwnersPage ownersPage;

    @BeforeEach
    void setUp() {
        driver = WebDriverFactory.createChrome();
        ownersPage = new OwnersPage(driver);
    }

    @AfterEach
    void tearDown() {
        if (driver != null) {
            driver.quit();
        }
    }

    @Test
    void showsAllOwnersOnInitialLoad() throws IOException, InterruptedException {
        ownersPage.open(BASE_URL);

        List<OwnerDto> expectedOwners = fetchOwners();
        List<String> expectedFullNames = fullNames(expectedOwners);

        ownersPage.waitForOwnersCount(expectedFullNames.size());
        List<String> actualFullNames = sorted(ownersPage.ownerFullNames());

        assertThat(actualFullNames)
            .containsExactlyElementsOf(sorted(expectedFullNames));
    }

    @Test
    void filtersOwnersByLastNamePrefix() throws IOException, InterruptedException {
        List<OwnerDto> allOwners = fetchOwners();
        String prefix = choosePrefixFrom(allOwners);
        List<String> expectedFilteredFullNames = fullNames(fetchOwnersByPrefix(prefix));

        ownersPage.open(BASE_URL);
        ownersPage.searchByLastNamePrefix(prefix);
        ownersPage.waitForOwnersCount(expectedFilteredFullNames.size());

        List<String> actualFilteredFullNames = ownersPage.ownerFullNames();

        assertThat(actualFilteredFullNames)
            .isNotEmpty()
            .allSatisfy(fullName -> assertThat(extractLastName(fullName).toLowerCase(Locale.ROOT))
                .startsWith(prefix.toLowerCase(Locale.ROOT)));

        assertThat(sorted(actualFilteredFullNames))
            .containsExactlyElementsOf(sorted(expectedFilteredFullNames));
    }

    private static List<OwnerDto> fetchOwners() throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(API_BASE_URL + "/owners"))
            .timeout(Duration.ofSeconds(10))
            .GET()
            .build();

        HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(200);

        return OBJECT_MAPPER.readValue(response.body(), new TypeReference<>() {
        });
    }

    private static List<OwnerDto> fetchOwnersByPrefix(String prefix) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(API_BASE_URL + "/owners?lastName=" + prefix))
            .timeout(Duration.ofSeconds(10))
            .GET()
            .build();

        HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(200);

        return OBJECT_MAPPER.readValue(response.body(), new TypeReference<>() {
        });
    }

    private static List<String> fullNames(List<OwnerDto> owners) {
        return owners.stream()
            .map(owner -> (owner.firstName + " " + owner.lastName).trim())
            .filter(name -> !name.isBlank())
            .toList();
    }

    private static List<String> sorted(List<String> values) {
        return values.stream()
            .sorted(Comparator.naturalOrder())
            .toList();
    }

    private static String choosePrefixFrom(List<OwnerDto> owners) {
        return owners.stream()
            .map(owner -> owner.lastName)
            .filter(value -> value != null && !value.isBlank())
            .map(value -> value.substring(0, Math.min(2, value.length())))
            .findFirst()
            .orElseThrow(() -> new IllegalStateException("No owners available to derive search prefix"));
    }

    private static String extractLastName(String fullName) {
        int firstSpace = fullName.indexOf(' ');
        if (firstSpace < 0 || firstSpace == fullName.length() - 1) {
            return fullName;
        }
        return fullName.substring(firstSpace + 1);
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record OwnerDto(String firstName, String lastName) {
    }
}
