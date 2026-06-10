package victor.training.petclinic.chatbot.assistant;

import java.text.ParseException;

import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.JWTParser;

/**
 * The authenticated pet owner — the custom principal we put into Spring Security's context. Built
 * from the Bearer JWT the web page sends: we parse out the {@code name} / {@code email} claims, but
 * deliberately do NOT validate the signature (demo only). Returns {@code null} when there is no
 * usable token, so {@link SecurityConfig} leaves the request unauthenticated (-> 401).
 *
 * <p>Deliberately NOT a {@link java.security.Principal}: if it were, Spring's generic Principal
 * argument resolver would inject the whole {@code Authentication} into a {@code @AuthenticationPrincipal}
 * parameter of this type, causing an argument-type-mismatch 500.
 */
record OwnerJwtPrincipal(Integer id, String name, String email, String token) {

  /** Parse the {@code Authorization: Bearer <jwt>} header into a principal; {@code null} if absent/bad. */
  static OwnerJwtPrincipal fromBearerHeader(String authorizationHeader) {
    if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
      return null;
    }
    return fromJwt(authorizationHeader.substring("Bearer ".length()).trim());
  }

  static OwnerJwtPrincipal fromJwt(String token) {
    try {
      JWTClaimsSet claims = JWTParser.parse(token).getJWTClaimsSet();
      Integer id = parseIdOrNull(claims.getSubject()); // owner id — what the backend resolves the owner from
      String name = claims.getStringClaim("name");
      String email = claims.getStringClaim("email");
      if (name == null && email == null) {
        return null;
      }
      // keep the raw token so RemoteToolsConfig can propagate it to the MCP server for THIS user's calls
      return new OwnerJwtPrincipal(id, orEmpty(name), orEmpty(email), token);
    } catch (ParseException | RuntimeException e) {
      return null;
    }
  }

  /** The {@code sub} claim is the numeric owner id; tolerate it being absent or non-numeric. */
  private static Integer parseIdOrNull(String subject) {
    if (subject == null) {
      return null;
    }
    try {
      return Integer.valueOf(subject.trim());
    } catch (NumberFormatException e) {
      return null;
    }
  }

  private static String orEmpty(String s) {
    if (s == null) {
      return "";
    }
    return s;
  }
}
