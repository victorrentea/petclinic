package victor.training.petclinic.chatbot;

import java.text.ParseException;

import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.JWTParser;

/**
 * The authenticated pet owner — the custom principal we put into Spring Security's context. Built
 * from the Bearer JWT the web page sends: we parse out the {@code name} / {@code email} claims, but
 * deliberately do NOT validate the signature (demo only).
 *
 * <p>Deliberately NOT a {@link java.security.Principal}: if it were, WebFlux's generic Principal
 * argument resolver would inject the whole {@code Authentication} into a {@code @AuthenticationPrincipal}
 * parameter of this type, causing an argument-type-mismatch 500.
 */
record OwnerJwtPrincipal(String name, String email) {

  static final OwnerJwtPrincipal ANONYMOUS = new OwnerJwtPrincipal("", "");

  /** Parse the {@code Authorization: Bearer <jwt>} header into a principal; ANONYMOUS if absent/bad. */
  static OwnerJwtPrincipal fromBearerHeader(String authorizationHeader) {
    if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
      return ANONYMOUS;
    }
    return fromJwt(authorizationHeader.substring("Bearer ".length()).trim());
  }

  static OwnerJwtPrincipal fromJwt(String token) {
    try {
      JWTClaimsSet claims = JWTParser.parse(token).getJWTClaimsSet();
      String name = claims.getStringClaim("name");
      String email = claims.getStringClaim("email");
      if (name == null && email == null) {
        return ANONYMOUS;
      }
      return new OwnerJwtPrincipal(orEmpty(name), orEmpty(email));
    } catch (ParseException | RuntimeException e) {
      return ANONYMOUS;
    }
  }

  private static String orEmpty(String s) {
    if (s == null) {
      return "";
    }
    return s;
  }
}
