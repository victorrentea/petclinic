package victor.training.petclinic.chatbot.assistant;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class OwnerJwtPrincipalTest {

  // Demo access token: sub=1, name="George Franklin", email="george.franklin@petclinic.example".
  // Unverified on purpose — we only read the payload claims, never validate the signature.
  private static final String DEMO_JWT =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwibmFtZSI6Ikdlb3JnZSBGcmFua2xpbiIsImVtY"
          + "WlsIjoiZ2VvcmdlLmZyYW5rbGluQHBldGNsaW5pYy5leGFtcGxlIiwiaWF0IjoxNzQ5MTY4MDAwLCJleHAiOj"
          + "E4MTIyNDAwMDB9.Xk7mN3qR2vL8pY4sA6dW1eH0fT9bC5jOuQzEiWs";

  @Test
  void extracts_name_and_email_from_bearer_header() {
    OwnerJwtPrincipal owner = OwnerJwtPrincipal.fromBearerHeader("Bearer " + DEMO_JWT);

    assertThat(owner.name()).isEqualTo("George Franklin");
    assertThat(owner.email()).isEqualTo("george.franklin@petclinic.example");
  }

  @Test
  void returns_null_when_header_is_missing_or_malformed() {
    assertThat(OwnerJwtPrincipal.fromBearerHeader(null)).isNull();
    assertThat(OwnerJwtPrincipal.fromBearerHeader("Basic abc")).isNull();
    assertThat(OwnerJwtPrincipal.fromBearerHeader("Bearer not-a-jwt")).isNull();
  }
}
