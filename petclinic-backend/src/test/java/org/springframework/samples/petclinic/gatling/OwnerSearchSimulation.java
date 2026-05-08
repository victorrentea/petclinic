package org.springframework.samples.petclinic.gatling;

import io.gatling.javaapi.core.*;
import io.gatling.javaapi.http.*;

import java.util.List;
import java.util.Random;

import static io.gatling.javaapi.core.CoreDsl.*;
import static io.gatling.javaapi.http.HttpDsl.*;

/**
 * Gatling load test for the owner search endpoint.
 *
 * Verifies that GET /api/owners?search=<term> responds in under 500ms
 * at the 95th percentile under 30 requests/second, with a dataset of 10,000 owners.
 *
 * Run with: ./mvnw gatling:test
 * (requires the backend to be running on localhost:8080 with 10,000 owners seeded)
 */
public class OwnerSearchSimulation extends Simulation {

    // Representative partial search terms that exercise the multi-field search
    private static final List<String> SEARCH_TERMS = List.of(
        "tav", "son", "col", "win", "dav", "mar", "joh", "smi", "bro", "wil",
        "123", "oak", "elm", "main", "lake", "cat", "dog", "max", "bel", "ros"
    );

    private final HttpProtocolBuilder httpProtocol = http
        .baseUrl("http://localhost:8080")
        .acceptHeader("application/json")
        .header("Authorization", "Basic YWRtaW46YWRtaW4="); // admin:admin

    private final ScenarioBuilder ownerSearch = scenario("Owner Search")
        .exec(
            http("search owners")
                .get("/api/owners")
                .queryParam("q", session -> SEARCH_TERMS.get(new Random().nextInt(SEARCH_TERMS.size())))
                .check(status().is(200))
                .check(responseTimeInMillis().lte(500)) // individual sanity check
        );

    {
        setUp(
            ownerSearch.injectOpen(
                rampUsersPerSec(1).to(30).during(10),  // ramp up to 30 rps over 10s
                constantUsersPerSec(30).during(60)      // sustain 30 rps for 60s
            )
        )
        .protocols(httpProtocol)
        .assertions(
            // 95th percentile under 500ms for the search endpoint
            details("search owners").responseTime().percentile(95).lt(500),
            // No failed requests
            details("search owners").failedRequests().percent().lt(1.0)
        );
    }
}
