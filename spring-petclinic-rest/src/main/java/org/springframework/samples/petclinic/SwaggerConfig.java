package org.springframework.samples.petclinic;


import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SwaggerConfig {
    @Bean
    OpenAPI customOpenAPI() {
        return new OpenAPI()
            .components(new Components())
            .info(new Info()
                .title("REST Petclinic backend API documentation")
                .version("1.0")
                .termsOfService("https://github.com/spring-petclinic/spring-petclinic-rest/blob/master/terms.txt")
                .description(
                    "This is the REST API documentation of the Spring Petclinic backend. " +
                        "If authentication is enabled, use admin/admin when calling the APIs")
            );
    }


}
