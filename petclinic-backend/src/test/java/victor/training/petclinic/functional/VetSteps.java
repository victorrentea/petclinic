package victor.training.petclinic.functional;

import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

public class VetSteps {

    @Autowired
    private HttpContext http;

    @Autowired
    private JdbcTemplate jdbc;

    @Given("a vet {string} with specialties {string}")
    public void aVetWithSpecialties(String fullName, String specialty1) {
        insertVet(fullName, specialty1);
    }

    @Given("a vet {string} with specialties {string}, {string}")
    public void aVetWithSpecialties(String fullName, String specialty1, String specialty2) {
        insertVet(fullName, specialty1, specialty2);
    }

    @Given("a veterinarian {string}")
    public void aVeterinarian(String fullName) {
        insertVet(fullName);
    }

    private void insertVet(String fullName, String... specialties) {
        String[] parts = fullName.split(" ", 2);
        Integer vetId = jdbc.queryForObject(
            "INSERT INTO vets (first_name, last_name) VALUES (?, ?) RETURNING id",
            Integer.class, parts[0], parts[1]);
        for (String specialty : specialties) {
            Integer specialtyId = jdbc.queryForObject(
                "SELECT id FROM specialties WHERE name = ?", Integer.class, specialty);
            jdbc.update(
                "INSERT INTO vet_specialties (vet_id, specialty_id) VALUES (?, ?)",
                vetId, specialtyId);
        }
        http.rememberId("vet:" + fullName, vetId);
    }

    @Then("vet {string} has specialties {string}")
    public void vetHasSpecialties(String fullName, String specialty1) {
        assertVetHasSpecialties(fullName, specialty1);
    }

    @Then("vet {string} has specialties {string}, {string}")
    public void vetHasSpecialties(String fullName, String specialty1, String specialty2) {
        assertVetHasSpecialties(fullName, specialty1, specialty2);
    }

    private void assertVetHasSpecialties(String fullName, String... expectedSpecialties) {
        int vetId = http.idOf("vet:" + fullName);
        var response = http.getLastResponse();
        var jp = response.jsonPath();
        List<Integer> ids = jp.getList("id", Integer.class);
        int index = ids.indexOf(vetId);
        assertThat(index).as("vet %s not in response", fullName).isNotNegative();
        List<String> actualSpecialties = jp.getList("[" + index + "].specialties.name", String.class);
        List<String> expected = Arrays.asList(expectedSpecialties);
        assertThat(actualSpecialties).containsExactlyInAnyOrderElementsOf(expected);
    }
}
