package victor.training.petclinic.mcp;

import java.lang.reflect.Field;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.apache.catalina.connector.Connector;
import org.apache.coyote.AbstractProtocol;
import org.apache.tomcat.util.net.AbstractEndpoint;
import org.apache.tomcat.util.net.SocketProperties;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.web.embedded.tomcat.TomcatWebServer;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext;

import static org.assertj.core.api.Assertions.assertThat;

// Boots a REAL Tomcat (RANDOM_PORT) so the disableSoLinger() customizer actually runs against a
// live connector. Verifies the SO_LINGER SocketProperties fields are nulled, which is the whole
// point of the JDK/macOS EINVAL workaround. A MOCK web environment would never invoke the bean.
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
class McpTomcatCustomizerTest {

    @Autowired ServletWebServerApplicationContext context;
    @Autowired WebServerFactoryCustomizer<TomcatServletWebServerFactory> disableSoLinger;

    @Test
    void customizer_bean_is_registered() {
        assertThat(disableSoLinger).isNotNull();
    }

    @Test
    void running_connector_has_so_linger_fields_nulled() throws Exception {
        TomcatWebServer server = (TomcatWebServer) context.getWebServer();
        Connector connector = server.getTomcat().getConnector();

        AbstractProtocol<?> protocol = (AbstractProtocol<?>) connector.getProtocolHandler();
        Field endpointField = AbstractProtocol.class.getDeclaredField("endpoint");
        endpointField.setAccessible(true);
        AbstractEndpoint<?, ?> endpoint = (AbstractEndpoint<?, ?>) endpointField.get(protocol);
        SocketProperties props = endpoint.getSocketProperties();

        assertThat(readField(props, "soLingerOn")).isNull();
        assertThat(readField(props, "soLingerTime")).isNull();
    }

    private static Object readField(SocketProperties props, String name) throws Exception {
        Field f = SocketProperties.class.getDeclaredField(name);
        f.setAccessible(true);
        return f.get(props);
    }
}
