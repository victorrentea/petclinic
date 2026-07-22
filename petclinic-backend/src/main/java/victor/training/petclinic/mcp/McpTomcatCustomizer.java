package victor.training.petclinic.mcp;

import java.lang.reflect.Field;

import org.apache.coyote.AbstractProtocol;
import org.apache.tomcat.util.net.AbstractEndpoint;
import org.apache.tomcat.util.net.SocketProperties;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

// Workaround for a JDK/macOS bug where setSoLinger(false, -1) throws EINVAL and
// causes Tomcat's Acceptor to drop accepted connections (notably long-lived SSE
// streams used by the MCP server). Null the SocketProperties linger fields so
// setProperties() skips the setSoLinger call.
@Configuration
public class McpTomcatCustomizer {

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
