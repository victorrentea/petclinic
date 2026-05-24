package petclinic.mcp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

// Reuses entities (victor.training.petclinic.model) and JPA repos (victor.training.petclinic.repository)
// from petclinic-backend; everything else (controllers, mappers, security) is ignored by component scan.
@SpringBootApplication
@EnableJpaRepositories(basePackages = "victor.training.petclinic.repository")
@EntityScan(basePackages = "victor.training.petclinic.model")
public class McpApplication {
    public static void main(String[] args) {
        SpringApplication.run(McpApplication.class, args);
    }
}
