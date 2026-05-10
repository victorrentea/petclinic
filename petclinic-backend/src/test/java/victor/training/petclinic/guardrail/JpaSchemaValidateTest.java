package victor.training.petclinic.guardrail;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;

/**
 * Schema sync guardrail. With the "test" profile active, ddl-auto=validate
 * (set in src/test/resources/application-test.properties) makes Spring
 * context refresh throw if any @Entity column does not exist in the
 * Flyway-migrated schema.
 *
 * Annotation set is intentionally identical to OpenApiSyncTest (including
 * @ActiveProfiles("test")) so that Spring's TestContext cache reuses the
 * same ApplicationContext between the two tests.
 *
 * Caveats: Hibernate validate is one-directional (entity → DB). It is
 * lax on column precision, varchar length, and nullability. The reverse
 * direction (DB column without entity field) is partially covered by
 * DbSchemaSyncTest.
 */
@AutoConfigureMockMvc
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
@ActiveProfiles("test")
class JpaSchemaValidateTest {

    @Test
    void contextLoads_meaningSchemaMatchesEntities() {
        // Empty body. The assertion is that the Spring context loads at all.
    }
}
