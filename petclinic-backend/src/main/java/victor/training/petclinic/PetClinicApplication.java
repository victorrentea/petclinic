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
    // MY JIRA_PAT=ATATT3xFfGF0T9aQ7pLmNc2vKx8RbWzYhJ4eD6sUgF1iO3nXwQ5tBvCkMpZrLyHa2dEfGhIjKlMnOpQrStUvWxYz0987654321AbCdEf
	OpenAPI customOpenAPI() {
		return new OpenAPI();
	}
}
