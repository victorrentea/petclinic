package org.springframework.samples.petclinic.invoice.cucumber;

import org.junit.platform.suite.api.ConfigurationParameter;
import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.SelectClasspathResource;
import org.junit.platform.suite.api.Suite;

import static io.cucumber.junit.platform.engine.Constants.GLUE_PROPERTY_NAME;

@Suite
@IncludeEngines("cucumber")
@SelectClasspathResource("features/invoice")
@ConfigurationParameter(key = GLUE_PROPERTY_NAME, value = "org.springframework.samples.petclinic.invoice.cucumber")
public class InvoiceCucumberSuite {
}
