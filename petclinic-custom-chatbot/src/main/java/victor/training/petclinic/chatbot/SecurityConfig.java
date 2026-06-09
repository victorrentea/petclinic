package victor.training.petclinic.chatbot;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.ReactiveAuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.SecurityWebFiltersOrder;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.security.web.server.authentication.AuthenticationWebFilter;
import org.springframework.security.web.server.authentication.ServerAuthenticationConverter;
import reactor.core.publisher.Mono;

/**
 * Minimal WebFlux security: the web page sends the owner's access token as a Bearer header. We do
 * NOT validate the signature (demo) — a {@link ServerAuthenticationConverter} just decodes the JWT
 * payload into an {@link OwnerJwtPrincipal}, which a pass-through authentication manager accepts. The
 * authenticated owner then lives in the standard reactive {@code SecurityContext}, so the controller
 * reads identity via {@code @AuthenticationPrincipal} instead of parsing headers by hand.
 */
@Configuration
@EnableWebFluxSecurity
class SecurityConfig {

  @Bean
  SecurityWebFilterChain securityWebFilterChain(ServerHttpSecurity http) {
    return http
        .csrf(ServerHttpSecurity.CsrfSpec::disable)
        .httpBasic(ServerHttpSecurity.HttpBasicSpec::disable)
        .formLogin(ServerHttpSecurity.FormLoginSpec::disable)
        // Only the static page + its assets load without a token (the browser fetches them before
        // it can present one). Everything else — i.e. /assistant — requires the Bearer token.
        .authorizeExchange(e -> e
            .pathMatchers("/", "/index.html", "/*.css", "/*.js").permitAll()
            .anyExchange().authenticated())
        .addFilterAt(bearerAuthenticationFilter(), SecurityWebFiltersOrder.AUTHENTICATION)
        .build();
  }

  private AuthenticationWebFilter bearerAuthenticationFilter() {
    // Pass-through manager: we trust the (unverified) token in this demo, so the converted
    // authentication is accepted as-is.
    ReactiveAuthenticationManager passThrough = Mono::just;
    AuthenticationWebFilter filter = new AuthenticationWebFilter(passThrough);
    filter.setServerAuthenticationConverter(bearerConverter());
    return filter;
  }

  private ServerAuthenticationConverter bearerConverter() {
    return exchange -> {
      String header = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
      OwnerJwtPrincipal owner = OwnerJwtPrincipal.fromBearerHeader(header);
      if (owner == OwnerJwtPrincipal.ANONYMOUS) {
        return Mono.empty(); // stays unauthenticated -> /assistant gets 401; static page still loads
      }
      Authentication auth = new UsernamePasswordAuthenticationToken(owner, null, List.of());
      return Mono.just(auth);
    };
  }
}
