workspace "PetClinic" "Veterinary practice management system" {

    model {
        pet_owner = person "Pet Owner" "Manages their pets and appointments"
        veterinarian = person "Veterinarian" "Provides veterinary care"
        petclinic = softwareSystem "PetClinic" "Veterinary practice management system" {
            frontend = container "Frontend" "Single-page application" "React"
            backend = container "Backend" "REST API" "Java / Spring Boot" {
                rest_layer = component "REST Layer" "HTTP endpoints, DTOs, error handlers" "Spring MVC" {
                    tags "REST Layer"
                }
                domain_model = component "Domain Model" "JPA entities" "JPA" {
                    tags "Domain Model"
                }
                repository_layer = component "Repository Layer" "Spring Data JPA repositories" "Spring Data" {
                    tags "Repository Layer"
                }
                mapper_layer = component "Mapper Layer" "MapStruct mappers" "MapStruct" {
                    tags "Mapper Layer"
                }
                security = component "Security" "Spring Security configuration" "Spring Security" {
                    tags "Security"
                }
                invoice = component "Invoice" "Invoice processing logic" "Java" {
                    tags "Invoice"
                }
            }
            database = container "Database" "Stores all data" "H2 / PostgreSQL"
        }

        pet_owner -> petclinic "Manages pets and visits"
        veterinarian -> petclinic "Manages appointments and records"
        pet_owner -> frontend "Uses"
        veterinarian -> frontend "Uses"
        frontend -> backend "REST API calls" "HTTPS/JSON"
        backend -> database "Reads/writes" "JPA"
        repository_layer -> domain_model ""
        mapper_layer -> domain_model ""
        mapper_layer -> rest_layer ""
        rest_layer -> repository_layer ""
        rest_layer -> mapper_layer ""
        rest_layer -> domain_model ""
    }

    views {
        systemContext petclinic "C1-Context" "Who uses PetClinic" {
            include *
            autoLayout
        }
        container petclinic "C2-Containers" "Containers inside PetClinic" {
            include *
            autoLayout
        }
        component backend "C3-Components-All" "All components inside Backend" {
            include *
            autoLayout
        }
        component backend "C3-Repository" "Repository Layer — nearest neighbours" {
            include rest_layer
            include domain_model
            include repository_layer
            autoLayout
        }
        component backend "C3-Mapper" "Mapper Layer — nearest neighbours" {
            include rest_layer
            include domain_model
            include mapper_layer
            autoLayout
        }

        styles {
            element "Component" {
                background #85bbf0
                color #000000
            }
            element "Container" {
                background #438dd5
                color #ffffff
            }
            element "Domain Model" {
                background #999999
                color #ffffff
            }
            element "Invoice" {
                background #c0392b
                color #ffffff
            }
            element "Mapper Layer" {
                background #4caf50
                color #ffffff
            }
            element "Person" {
                shape Person
                background #08427b
                color #ffffff
            }
            element "REST Layer" {
                background #1168bd
                color #ffffff
            }
            element "Repository Layer" {
                background #e8a838
                color #ffffff
            }
            element "Security" {
                background #888888
                color #ffffff
            }
            element "Software System" {
                background #1168bd
                color #ffffff
            }
            element "Utilities" {
                background #888888
                color #ffffff
            }
        }
    }
}
