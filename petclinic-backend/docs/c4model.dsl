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
