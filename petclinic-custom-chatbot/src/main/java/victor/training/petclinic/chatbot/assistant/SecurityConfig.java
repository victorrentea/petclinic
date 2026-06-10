package victor.training.petclinic.chatbot.assistant;

import java.io.IOException;
import java.util.List;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Minimal servlet (Spring MVC) security: the web page sends the owner's access token as a Bearer
 * header. We do NOT validate the signature (demo) — a per-request {@link OncePerRequestFilter}
 * decodes the JWT payload into an {@link OwnerJwtPrincipal} and, when present, stores it in the
 * standard {@code SecurityContext}, so the controller reads identity via
 * {@code @AuthenticationPrincipal} instead of parsing headers by hand.
 *
 * <p>Servlet (not WebFlux) on purpose: with {@code spring.threads.virtual.enabled=true} the WHOLE
 * request — including the blocking {@code ChatClient.call()} and its tool calls — runs on one virtual
 * thread, so a plain {@code ThreadLocal} stays visible end-to-end (no boundedElastic hop detaches it).
 */
@Configuration
@EnableWebSecurity
class SecurityConfig {

  @Bean
  SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    return http
        .csrf(csrf -> csrf.disable())
        .httpBasic(httpBasic -> httpBasic.disable())
        .formLogin(formLogin -> formLogin.disable())
        // Stateless: identity comes from the Bearer token on every request, no server session.
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        // Only the static page + its assets load without a token (the browser fetches them before it
        // can present one). Everything else — notably /assistant — still requires the token.
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/", "/index.html", "/*.css", "/*.js").permitAll()
            // Actuator open for scraping (demo): Prometheus pulls /actuator/prometheus without a JWT.
            .requestMatchers("/actuator/**").permitAll()
            .anyRequest().authenticated())
        .addFilterBefore(new BearerAuthenticationFilter(), UsernamePasswordAuthenticationFilter.class)
        .build();
  }

  /**
   * Decodes the {@code Authorization: Bearer <jwt>} header into an {@link OwnerJwtPrincipal} and, when
   * present, authenticates the request with it. We trust the (unverified) token in this demo. When the
   * header is absent or unparseable, the request stays unauthenticated -> 401 for protected paths.
   */
  static class BearerAuthenticationFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(
        HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
      String header = request.getHeader(HttpHeaders.AUTHORIZATION);
      OwnerJwtPrincipal owner = OwnerJwtPrincipal.fromBearerHeader(header);
      if (owner != null) {
        var auth = new UsernamePasswordAuthenticationToken(owner, null, List.of());
        SecurityContextHolder.getContext().setAuthentication(auth);
      }
      chain.doFilter(request, response);
    }
  }
}
