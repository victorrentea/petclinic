package victor.training.petclinic.chatbot;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/**
 * Browser-facing side-channel for MCP elicitations (see {@link PendingElicitations}). When
 * {@code create_visit} asks the chatbot for the owner's phone, the page learns about it here and
 * sends the answer back — turning a server-side auto-accept into a real human round-trip.
 *
 * <ul>
 *   <li>{@code GET /elicitations?token=<jwt>} — the page's {@code EventSource}. Since EventSource
 *       can't set an Authorization header, the JWT travels as a query param; we decode the owner
 *       from it and stream only THAT owner's elicitation events.</li>
 *   <li>{@code POST /elicitations/{id}} (body = phone) — submit the answer for a parked elicitation;
 *       identity comes from the normal Bearer header via {@code @AuthenticationPrincipal}.</li>
 * </ul>
 */
@Slf4j
@RestController
@RequiredArgsConstructor
class ElicitationController {

  private final PendingElicitations registry;

  /** The page subscribes here; the JWT is a query param because EventSource can't send headers. */
  @GetMapping(value = "/elicitations", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
  Flux<PendingElicitations.Event> stream(@RequestParam(required = false) String token) {
    OwnerJwtPrincipal owner = OwnerJwtPrincipal.fromJwt(token == null ? "" : token);
    if (owner == null) {
      // SecurityConfig already permits this path, so enforce the token requirement here.
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "A valid token query param is required.");
    }
    return registry.events(owner.name());
  }

  /** Answer a parked elicitation. Identity is the Bearer-authenticated owner, never the path/body. */
  @PostMapping("/elicitations/{id}")
  Mono<ResponseEntity<String>> submit(
      @PathVariable String id,
      @RequestBody String phone,
      @AuthenticationPrincipal OwnerJwtPrincipal owner) {
    if (owner == null) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "A valid Bearer token is required.");
    }
    boolean resumed = registry.submit(owner.name(), id, phone.trim());
    if (!resumed) {
      return Mono.just(ResponseEntity.status(HttpStatus.GONE)
          .body("No pending elicitation " + id + " (already answered or timed out)."));
    }
    return Mono.just(ResponseEntity.ok("ok"));
  }
}
