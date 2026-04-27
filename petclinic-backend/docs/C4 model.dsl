workspace "PetClinic" "Veterinary practice management system" {

    model {
        pet_owner = person "Pet Owner" "Manages their pets and appointments"
        veterinarian = person "Veterinarian" "Provides veterinary care"
        petclinic = softwareSystem "PetClinic" "Veterinary practice management system" {
            frontend = container "Frontend" "Single-page application" "React" {
            }
            backend = container "Backend" "REST API" "Java / Spring Boot" {
                rest_layer = component "REST Layer" "HTTP endpoints, DTOs, error handlers" "Spring MVC"
                domain_model = component "Domain Model" "JPA entities" "JPA"
                repository_layer = component "Repository Layer" "Spring Data JPA repositories" "Spring Data"
                mapper_layer = component "Mapper Layer" "MapStruct mappers" "MapStruct"
                security = component "Security" "Spring Security configuration" "Spring Security"
                invoice = component "Invoice" "Invoice processing logic" "Java"
                utilities = component "Utilities" "Cross-cutting utilities" "Java"
            }
            database = container "Database" "Stores all data" "H2 / PostgreSQL" {
            }
        }

        pet_owner -> petclinic "Manages pets and visits"
        veterinarian -> petclinic "Manages appointments and records"
        pet_owner -> frontend "Uses"
        veterinarian -> frontend "Uses"
        frontend -> backend "REST API calls" "HTTPS/JSON"
        backend -> database "Reads/writes data" "JPA"
        mapper_layer -> domain_model ""
        mapper_layer -> rest_layer ""
        repository_layer -> domain_model ""
        rest_layer -> domain_model ""
        rest_layer -> repository_layer ""
        rest_layer -> mapper_layer ""
    }

    views {
        container petclinic {
            include *
            autoLayout
        }
        component backend {
            include *
            autoLayout
        }
        component backend "repository-layer-view" "Repo dependencies" {
            include ->repository_layer->
            autoLayout
        }
    }
}
