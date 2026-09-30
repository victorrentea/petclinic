package victor.training.petclinic.rewrite;

import com.google.errorprone.refaster.annotation.AfterTemplate;
import com.google.errorprone.refaster.annotation.BeforeTemplate;
import org.openrewrite.java.template.RecipeDescriptor;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;

/**
 * Spring Security 7 removed the chained DSL ({@code http.csrf().disable()}), deprecated since 6.1.
 * Only the lambda DSL survives, so the call changes shape, not just its name — beyond a find-and-replace.
 */
@RecipeDescriptor(
    name = "Disable CSRF through the lambda DSL",
    description = "Rewrites `http.csrf().disable()` to `http.csrf(AbstractHttpConfigurer::disable)`, " +
                "as Spring Security 7 no longer has the no-arg `csrf()`."
)
public class CsrfDisableLambdaDsl {

    @BeforeTemplate
    HttpSecurity before(HttpSecurity http) throws Exception {
        return http.csrf().disable();
    }

    @AfterTemplate
    HttpSecurity after(HttpSecurity http) throws Exception {
        return http.csrf(AbstractHttpConfigurer::disable);
    }
}
