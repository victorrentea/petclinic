package org.springframework.samples.petclinic.bdd;

import io.cucumber.spring.CucumberContextConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;

@CucumberContextConfiguration
@SpringBootTest
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
public class CucumberSpringConfiguration {
}

