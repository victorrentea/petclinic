package victor.training.petclinic.rest;

import java.util.Locale;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.format.FormatterRegistry;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Explicit case-insensitive binding for the owners grid's query-string enums
 * ({@code ?sort=name|city}, {@code ?dir=asc|desc}). Spring Boot's lenient enum conversion is
 * scoped to {@code @ConfigurationProperties} binding, not {@code @RequestParam}, so without this
 * a lowercase value fails the exact-case {@code Enum.valueOf} Spring MVC falls back to. A failed
 * conversion here surfaces as a {@link MethodArgumentTypeMismatchException}, mapped to 400 by
 * {@code ExceptionControllerAdvice}.
 */
@Configuration
class OwnerGridWebConfig implements WebMvcConfigurer {

    @Override
    public void addFormatters(FormatterRegistry registry) {
        registry.addConverter(String.class, Direction.class, Direction::fromString);
        registry.addConverter(String.class, OwnerRestController.OwnerSort.class,
                value -> OwnerRestController.OwnerSort.valueOf(value.toUpperCase(Locale.ROOT)));
    }
}
