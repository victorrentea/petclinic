package org.springframework.samples.petclinic.rest;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Sort;
import org.springframework.format.FormatterRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
class WebMvcConfig implements WebMvcConfigurer {

    @Override
    public void addFormatters(FormatterRegistry registry) {
        registry.addConverter(String.class, OwnerSortField.class,
            s -> OwnerSortField.valueOf(s.toUpperCase()));
        registry.addConverter(String.class, Sort.Direction.class,
            Sort.Direction::fromString); // fromString already does toUpperCase internally
    }
}
