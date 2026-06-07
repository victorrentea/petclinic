package victor.training.petclinic.mcp;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Configuration
public class McpSecurity {

    /** Owner id of the caller, extracted from the JWT subject claim. */
    public static int currentOwnerId() {
        return Integer.parseInt(SecurityContextHolder.getContext().getAuthentication().getName());
    }

    // Scoped to MCP endpoints only so the backend's existing chain still owns /api/**.
    // @Order ensures this chain is consulted before the backend's catch-all chain.
    @Bean
    @Order(Ordered.HIGHEST_PRECEDENCE)
    SecurityFilterChain mcpJwtChain(HttpSecurity http) throws Exception {
        return http
            .securityMatcher("/sse", "/sse/**", "/mcp/**")
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth.anyRequest().authenticated())
            .addFilterBefore(new JwtBearerFilter(), UsernamePasswordAuthenticationFilter.class)
            .httpBasic(AbstractHttpConfigurer::disable)
            .formLogin(AbstractHttpConfigurer::disable)
            .build();
    }

    private static class JwtBearerFilter extends OncePerRequestFilter {

        @Override
        protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
            String header = req.getHeader("Authorization");
            if (header != null && header.startsWith("Bearer ")) {
                String subject = extractSubject(header.substring(7));
                if (subject != null) {
                    var auth = new UsernamePasswordAuthenticationToken(
                        subject,
                        null,
                        List.of(new SimpleGrantedAuthority("ROLE_MCP")));
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            }
            chain.doFilter(req, res);
        }

        private static String extractSubject(String jwt) {
            try {
                String[] parts = jwt.split("\\.");
                if (parts.length < 2) return null;
                byte[] decoded = Base64.getUrlDecoder().decode(padBase64(parts[1]));
                String payload = new String(decoded, StandardCharsets.UTF_8);
                return new ObjectMapper().readTree(payload).path("sub").asText(null);
            } catch (Exception e) {
                return null;
            }
        }

        private static String padBase64(String s) {
            return s + "=".repeat((4 - s.length() % 4) % 4);
        }
    }
}
