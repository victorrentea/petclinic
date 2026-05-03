package org.springframework.samples.petclinic;

import org.junit.jupiter.api.Test;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
class SpringConfigTests {

    @Test
    void contextLoads() {
    }
}
