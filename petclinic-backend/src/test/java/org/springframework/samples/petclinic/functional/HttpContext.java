package org.springframework.samples.petclinic.functional;

import io.cucumber.spring.ScenarioScope;
import io.restassured.response.Response;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Component
@ScenarioScope
public class HttpContext {

    @Value("${local.server.port}")
    private int port;

    private Response lastResponse;
    private final Map<String, Integer> ids = new HashMap<>();

    public String baseUri() {
        return "http://localhost:" + port;
    }

    public Response getLastResponse() {
        return lastResponse;
    }

    public void setLastResponse(Response response) {
        this.lastResponse = response;
    }

    public void rememberId(String key, int id) {
        ids.put(key, id);
    }

    public int idOf(String key) {
        Integer id = ids.get(key);
        if (id == null) {
            throw new IllegalStateException("No id remembered for key: " + key);
        }
        return id;
    }
}
