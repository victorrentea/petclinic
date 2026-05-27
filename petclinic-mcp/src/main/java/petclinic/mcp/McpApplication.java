package petclinic.mcp;

import java.lang.reflect.Field;

import org.apache.coyote.AbstractProtocol;
import org.apache.tomcat.util.net.AbstractEndpoint;
import org.apache.tomcat.util.net.SocketProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

// Reuses entities (victor.training.petclinic.model) and JPA repos (victor.training.petclinic.repository).
// from petclinic-backend; everything else (controllers, mappers, security) is ignored by component scan.
@SpringBootApplication
@EnableJpaRepositories(basePackages = "victor.training.petclinic.repository")
@EntityScan(basePackages = "victor.training.petclinic.model")
public class McpApplication {
    public static void main(String[] args) {
        SpringApplication.run(McpApplication.class, args);
    }

    // Workaround for JDK/macOS bug where setSoLinger(false, -1) throws EINVAL.
    // making Tomcat drop accepted connections (Acceptor closeSocket path). Null the.
    // SocketProperties linger fields so setProperties() skips the setSoLinger call.
    @Bean
    public WebServerFactoryCustomizer<TomcatServletWebServerFactory> disableSoLinger() {
        return factory -> factory.addConnectorCustomizers(connector -> {
            AbstractProtocol<?> protocol = (AbstractProtocol<?>) connector.getProtocolHandler();
            try {
                Field endpointField = AbstractProtocol.class.getDeclaredField("endpoint");
                endpointField.setAccessible(true);
                AbstractEndpoint<?, ?> endpoint = (AbstractEndpoint<?, ?>) endpointField.get(protocol);
                SocketProperties props = endpoint.getSocketProperties();
                nullField(props, "soLingerOn");
                nullField(props, "soLingerTime");
            } catch (ReflectiveOperationException e) {
                throw new IllegalStateException("Failed to disable SO_LINGER", e);
            }
        });
    }

    private static void nullField(SocketProperties props, String name) throws ReflectiveOperationException {
        Field f = SocketProperties.class.getDeclaredField(name);
        f.setAccessible(true);
        f.set(props, null);
    }
}
