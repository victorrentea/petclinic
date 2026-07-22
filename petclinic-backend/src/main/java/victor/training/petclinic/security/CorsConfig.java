package victor.training.petclinic.security;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
class CorsConfig implements WebMvcConfigurer {
  @Override
  public void addCorsMappings(CorsRegistry registry) {
    registry.addMapping("/**")
        // Allow the dev frontend on ANY localhost port, so an isolated checkout / git worktree
        // running `ng serve --port <n>` (or several trainees in parallel) can still call the API.
        // allowedOriginPatterns (not allowedOrigins) is required to combine wildcards with credentials.
        .allowedOriginPatterns("http://localhost:[*]", "http://127.0.0.1:[*]")
        .allowedMethods("GET","POST","PUT","PATCH","DELETE","OPTIONS")
        .allowedHeaders("*")
        .exposedHeaders( "errors, content-type")
        .allowCredentials(true);
  }
}
