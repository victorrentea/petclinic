package victor.training.petclinic.rest;

/**
 * Hard-coded response payload examples for the REST API, kept in one place as the single
 * source of truth.
 *
 * <p>Each constant is referenced from an {@code @ExampleObject(value = ...)} on the matching
 * {@code GET} list endpoint, so springdoc copies it verbatim into the generated
 * {@code openapi.yaml} (under {@code responses.200.content.application/json.examples}). From
 * there the optional dev tool {@code petclinic-frontend/wiremock/start.sh} turns each example
 * into a WireMock stub — so a stand-in mock backend can never drift from the documented contract.
 *
 * <p>Annotation values must be compile-time constants, hence plain {@code String} text blocks
 * (not builder-constructed DTOs). The payloads are deliberately small but valid against the
 * schemas (Spectral's {@code oas3-valid-media-type-examples} rule enforces that).
 */
public final class ApiExamples {

    private ApiExamples() {
    }

    public static final String VETS = """
        [
          { "id": 1, "firstName": "James", "lastName": "Carter", "specialties": [] },
          { "id": 2, "firstName": "Helen", "lastName": "Leary",
            "specialties": [ { "id": 1, "name": "radiology", "description": "x-rays and imaging" } ] },
          { "id": 3, "firstName": "Linda", "lastName": "Douglas",
            "specialties": [ { "id": 2, "name": "surgery", "description": "operations" },
                             { "id": 3, "name": "dentistry", "description": "teeth" } ] }
        ]""";

    public static final String PETS = """
        [
          { "id": 1, "name": "Leo", "birthDate": "2010-09-07", "type": { "id": 1, "name": "cat" },
            "ownerId": 1, "visits": [] },
          { "id": 2, "name": "Basil", "birthDate": "2012-08-06", "type": { "id": 2, "name": "hamster" },
            "ownerId": 2,
            "visits": [ { "id": 1, "date": "2013-01-01", "description": "rabies shot", "petId": 2 } ] }
        ]""";

    public static final String VISITS = """
        [
          { "id": 1, "date": "2013-01-01", "description": "rabies shot", "petId": 7 },
          { "id": 2, "date": "2013-01-02", "description": "annual checkup", "petId": 8 }
        ]""";

    public static final String SPECIALTIES = """
        [
          { "id": 1, "name": "radiology", "description": "x-rays, broken bones, imaging" },
          { "id": 2, "name": "surgery", "description": "operations, spaying, neutering" },
          { "id": 3, "name": "dentistry", "description": "teeth cleaning, extractions" }
        ]""";

    public static final String PET_TYPES = """
        [
          { "id": 1, "name": "cat" },
          { "id": 2, "name": "dog" },
          { "id": 3, "name": "hamster" }
        ]""";
}
