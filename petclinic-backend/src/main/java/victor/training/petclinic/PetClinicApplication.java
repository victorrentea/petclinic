package victor.training.petclinic;

import io.swagger.v3.oas.models.OpenAPI;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class PetClinicApplication {

	public static void main(String[] args) {
		SpringApplication.run(PetClinicApplication.class, args);
	}

	@Bean
	@ConfigurationProperties(prefix = "openapi")
    // MY JIRA_PAT=afa87as87f6asf786asf97yas98yas98faus89fyas98fyas9gt8ag78a
	OpenAPI customOpenAPI() {
		return new OpenAPI();
	}
}
