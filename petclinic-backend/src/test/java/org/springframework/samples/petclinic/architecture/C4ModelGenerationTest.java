package org.springframework.samples.petclinic.architecture;

import com.structurizr.Workspace;
import com.structurizr.export.Diagram;
import com.structurizr.export.plantuml.C4PlantUMLExporter;
import com.structurizr.model.Component;
import com.structurizr.model.*;
import com.structurizr.view.*;
import net.sourceforge.plantuml.SourceStringReader;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Collection;

import static org.assertj.core.api.Assertions.assertThat;

class C4ModelGenerationTest {

    @Test
    void generateC4ModelDsl() throws IOException {
        String dsl = buildC4Dsl();

        Files.writeString(Paths.get("docs/c4model.dsl"), dsl);

        assertThat(dsl)
            .contains("workspace")
            .contains("Repositories")
            .contains("RepositoryFocus")
            .contains("MapperFocus");
    }

    @Test
    void generateC4PlantUMLDiagramsAndPngImages() throws IOException {
        Workspace workspace = buildWorkspace();
        C4PlantUMLExporter exporter = new C4PlantUMLExporter();
        Collection<Diagram> diagrams = exporter.export(workspace);

        Path viewsDir = Paths.get("docs/c4views");
        Files.createDirectories(viewsDir);

        for (Diagram diagram : diagrams) {
            Files.writeString(viewsDir.resolve(diagram.getKey() + ".puml"), diagram.getDefinition());
            renderToPng(diagram.getDefinition(), viewsDir.resolve(diagram.getKey() + ".png"));
        }

        assertThat(viewsDir.resolve("RepositoryFocus.png")).exists();
        assertThat(viewsDir.resolve("MapperFocus.png")).exists();
        assertThat(viewsDir.resolve("Components.png")).exists();
    }

    private void renderToPng(String plantUml, Path target) throws IOException {
        SourceStringReader reader = new SourceStringReader(plantUml);
        try (OutputStream os = Files.newOutputStream(target)) {
            reader.outputImage(os);
        }
    }

    private Workspace buildWorkspace() {
        Workspace workspace = new Workspace("PetClinic", "Spring PetClinic REST Backend");
        Model model = workspace.getModel();
        ViewSet views = workspace.getViews();

        Person owner = model.addPerson("Owner", "Pet owner using the clinic system");
        Person vet = model.addPerson("Veterinarian", "Clinic staff managing pets and visits");

        SoftwareSystem petclinic = model.addSoftwareSystem("PetClinic Backend", "REST API managing pet clinic data");

        Container api = petclinic.addContainer("REST API", "Handles HTTP requests and business logic", "Spring Boot / Java");
        Container db = petclinic.addContainer("Database", "Persists all clinic data", "H2 (dev) / PostgreSQL (prod)");

        Component rest = api.addComponent("REST Controllers", "Handles HTTP requests, delegates to mappers and repositories", "Spring MVC");
        Component mapper = api.addComponent("Mappers", "Converts JPA entities to DTOs and back", "MapStruct");
        Component repository = api.addComponent("Repositories", "Data access layer — Spring Data JPA interfaces", "Spring Data JPA");
        Component domainModel = api.addComponent("Domain Model", "JPA entities: Owner, Pet, Vet, Visit, etc.", "JPA / Hibernate");
        api.addComponent("Security", "Basic auth, CORS, and role-based access control", "Spring Security");
        api.addComponent("Invoice", "Invoice calculation business logic", "Spring Service");

        owner.uses(api, "Uses", "HTTPS / REST");
        vet.uses(api, "Uses", "HTTPS / REST");
        rest.uses(repository, "Reads and writes data via");
        rest.uses(mapper, "Transforms entities via");
        rest.uses(domainModel, "Uses directly");
        mapper.uses(domainModel, "Converts entities to DTOs");
        repository.uses(domainModel, "Queries and persists");
        api.uses(db, "Reads and writes", "JPA / SQL");

        SystemContextView contextView = views.createSystemContextView(petclinic, "SystemContext", "System Context: who interacts with PetClinic");
        contextView.addAllElements();

        ContainerView containerView = views.createContainerView(petclinic, "Containers", "Containers inside the PetClinic system");
        containerView.addAllElements();

        ComponentView allComponents = views.createComponentView(api, "Components", "All components inside the REST API container");
        allComponents.addAllComponents();

        ComponentView repoFocus = views.createComponentView(api, "RepositoryFocus", "Repository layer: incoming (REST Controllers) and outgoing (Domain Model) dependencies");
        repoFocus.add(repository);
        repoFocus.add(rest);
        repoFocus.add(domainModel);

        ComponentView mapperFocus = views.createComponentView(api, "MapperFocus", "Mapper layer: incoming (REST Controllers) and outgoing (Domain Model) dependencies");
        mapperFocus.add(mapper);
        mapperFocus.add(rest);
        mapperFocus.add(domainModel);

        Styles styles = views.getConfiguration().getStyles();
        styles.addElementStyle(Tags.PERSON).shape(Shape.Person).background("#08427b").color("#ffffff");
        styles.addElementStyle(Tags.SOFTWARE_SYSTEM).background("#1168bd").color("#ffffff");
        styles.addElementStyle(Tags.CONTAINER).background("#438dd5").color("#ffffff");
        styles.addElementStyle(Tags.COMPONENT).background("#85bbf0").color("#000000");

        return workspace;
    }

    private String buildC4Dsl() {
        return """
                workspace "PetClinic" "Spring PetClinic REST Backend" {

                    model {
                        owner = person "Owner" "Pet owner using the clinic system"
                        vet = person "Veterinarian" "Clinic staff managing pets and visits"

                        petclinic = softwareSystem "PetClinic Backend" "REST API managing pet clinic data" {

                            api = container "REST API" "Handles HTTP requests and business logic" "Spring Boot / Java" {

                                rest = component "REST Controllers" "Handles HTTP requests, delegates to mappers and repositories" "Spring MVC" {
                                    tags "rest"
                                }
                                mapper = component "Mappers" "Converts JPA entities to DTOs and back" "MapStruct" {
                                    tags "mapper"
                                }
                                repository = component "Repositories" "Data access layer — Spring Data JPA interfaces" "Spring Data JPA" {
                                    tags "repository"
                                }
                                domainModel = component "Domain Model" "JPA entities: Owner, Pet, Vet, Visit, etc." "JPA / Hibernate" {
                                    tags "model"
                                }
                                security = component "Security" "Basic auth, CORS, and role-based access control" "Spring Security" {
                                    tags "security"
                                }
                                invoice = component "Invoice" "Invoice calculation business logic" "Spring Service" {
                                    tags "invoice"
                                }
                            }

                            db = container "Database" "Persists all clinic data" "H2 (dev) / PostgreSQL (prod)"
                        }

                        owner -> api "Uses" "HTTPS / REST"
                        vet -> api "Uses" "HTTPS / REST"

                        rest -> repository "Reads and writes data via"
                        rest -> mapper "Transforms entities via"
                        rest -> domainModel "Uses directly"
                        mapper -> domainModel "Converts entities to DTOs"
                        repository -> domainModel "Queries and persists"
                        api -> db "Reads and writes" "JPA / SQL"
                    }

                    views {

                        systemContext petclinic "SystemContext" "System Context: who interacts with PetClinic" {
                            include *
                            autoLayout lr
                        }

                        container petclinic "Containers" "Containers inside the PetClinic system" {
                            include *
                            autoLayout lr
                        }

                        component api "Components" "All components inside the REST API container" {
                            include *
                            autoLayout lr
                        }

                        component api "RepositoryFocus" "Repository layer: incoming and outgoing dependencies" {
                            include repository
                            include rest
                            include domainModel
                            autoLayout lr
                        }

                        component api "MapperFocus" "Mapper layer: incoming and outgoing dependencies" {
                            include mapper
                            include rest
                            include domainModel
                            autoLayout lr
                        }

                        styles {
                            element "Person" {
                                shape Person
                                background #08427b
                                color #ffffff
                            }
                            element "Software System" {
                                background #1168bd
                                color #ffffff
                            }
                            element "Container" {
                                background #438dd5
                                color #ffffff
                            }
                            element "Component" {
                                background #85bbf0
                                color #000000
                            }
                            element "repository" {
                                background #e8a838
                                color #ffffff
                            }
                            element "rest" {
                                background #1168bd
                                color #ffffff
                            }
                            element "model" {
                                background #999999
                                color #ffffff
                            }
                            element "mapper" {
                                background #4caf50
                                color #ffffff
                            }
                        }
                    }
                }
                """;
    }
}
