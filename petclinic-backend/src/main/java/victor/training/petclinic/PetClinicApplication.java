package victor.training.petclinic;

import io.swagger.v3.oas.models.OpenAPI;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.web.context.WebServerInitializedEvent;
import org.springframework.context.annotation.Bean;
import org.springframework.context.event.EventListener;

@SpringBootApplication
public class PetClinicApplication {

	public static void main(String[] args) {
		SpringApplication.run(PetClinicApplication.class, args);
	}

	@EventListener
	void started(WebServerInitializedEvent event) {
		System.out.println("✅ started petclinic-backend on port " + event.getWebServer().getPort());
	}

	@Bean
	@ConfigurationProperties(prefix = "openapi")
	OpenAPI customOpenAPI() {
		return new OpenAPI();
	}
}
