package petclinic.mcp;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
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
@EnableConfigurationProperties(McpSecurity.McpProperties.class)
public class McpSecurity {

    public static final String API_KEY_HEADER = "X-API-Key";

    /** Owner id of the caller, derived from the authenticated API key. */
    public static int currentOwnerId() {
        return Integer.parseInt(SecurityContextHolder.getContext().getAuthentication().getName());
    }

    @Bean
    SecurityFilterChain mcpApiKeyChain(HttpSecurity http, McpProperties props) throws Exception {
        return http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth.anyRequest().authenticated())
            .addFilterBefore(new ApiKeyFilter(props.getApiKeys()), UsernamePasswordAuthenticationFilter.class)
            .httpBasic(AbstractHttpConfigurer::disable)
            .formLogin(AbstractHttpConfigurer::disable)
            .build();
    }

    @ConfigurationProperties(prefix = "petclinic.mcp")
    public static class McpProperties {
        private Map<String, Integer> apiKeys = new HashMap<>();
        public Map<String, Integer> getApiKeys() { return apiKeys; }
        public void setApiKeys(Map<String, Integer> apiKeys) { this.apiKeys = apiKeys; }
    }

    private static class ApiKeyFilter extends OncePerRequestFilter {
        private final Map<String, Integer> apiKeys;

        ApiKeyFilter(Map<String, Integer> apiKeys) {
            this.apiKeys = apiKeys;
        }

        @Override
        protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
            String key = req.getHeader(API_KEY_HEADER);
            Integer ownerId = key == null ? null : apiKeys.get(key);
            if (ownerId != null) {
                var auth = new UsernamePasswordAuthenticationToken(
                    ownerId.toString(),
                    null,
                    List.of(new SimpleGrantedAuthority("ROLE_MCP")));
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
            chain.doFilter(req, res);
        }
    }
}
