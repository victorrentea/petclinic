package org.springframework.samples.petclinic.functional;

import io.cucumber.java.Before;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

public class DatabaseHooks {

    @Autowired
    private JdbcTemplate jdbc;

    @Before
    public void resetDynamicTables() {
        jdbc.execute("TRUNCATE TABLE vet_specialties, visits, pets, owners, vets RESTART IDENTITY CASCADE");
    }
}
