package victor.training.petclinic.rewrite;

import org.junit.jupiter.api.Test;
import org.openrewrite.java.JavaParser;
import org.openrewrite.test.RecipeSpec;
import org.openrewrite.test.RewriteTest;

import static org.openrewrite.java.Assertions.java;

class CsrfDisableLambdaDslTest implements RewriteTest {

    @Override
    public void defaults(RecipeSpec spec) {
        spec.recipe(new CsrfDisableLambdaDslRecipe())
            .parser(JavaParser.fromJavaVersion().classpath(
                "spring-security-config", "spring-security-core",
                "spring-context", "spring-beans", "spring-core", "jakarta.servlet-api"));
    }

    @Test
    void csrfDisableBecomesALambda() {
        rewriteRun(java(
            """
            import org.springframework.security.config.annotation.web.builders.HttpSecurity;

            class SecurityConfig {
                void configure(HttpSecurity http) throws Exception {
                    http.csrf().disable();
                }
            }
            """,
            """
            import org.springframework.security.config.annotation.web.builders.HttpSecurity;
            import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;

            class SecurityConfig {
                void configure(HttpSecurity http) throws Exception {
                    http.csrf(AbstractHttpConfigurer::disable);
                }
            }
            """
        ));
    }
}
