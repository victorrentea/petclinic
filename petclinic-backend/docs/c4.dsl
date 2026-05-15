workspace "PetClinic" "Veterinary practice management system" {

    model {
        petOwner = person "Pet Owner" "Manages their pets and appointments"
        veterinarian = person "Veterinarian" "Provides veterinary care"

        petClinic = softwareSystem "PetClinic" "Veterinary practice management system" {
            frontend = container "Frontend" "Single-page application" "Angular"
            backend = container "Backend" "REST API" "Java / Spring Boot" {
                restLayer = component "REST Layer" "HTTP endpoints, DTOs, error handlers\n[rest.**]" "Spring MVC" {
                    properties {
                        "package" "rest.**"
                    }
                }
                domainModel = component "Domain Model" "JPA entities\n[model]" "JPA" {
                    properties {
                        "package" "model"
                    }
                }
                repositoryLayer = component "Repository Layer" "Spring Data JPA repositories\n[repository]" "Spring Data" {
                    properties {
                        "package" "repository"
                    }
                }
                mapperLayer = component "Mapper Layer" "MapStruct mappers\n[mapper]" "MapStruct" {
                    properties {
                        "package" "mapper"
                    }
                }
                security = component "Security" "Spring Security configuration\n[security]" "Spring Security" {
                    properties {
                        "package" "security"
                    }
                }
            }
            database = container "Database" "Stores all data" "PostgreSQL"
        }

        petOwner -> petClinic "Manages pets and visits"
        veterinarian -> petClinic "Manages appointments and records"
        petOwner -> frontend "Uses"
        veterinarian -> frontend "Uses"
        frontend -> backend "REST API calls" "HTTPS/JSON"
        backend -> database "Reads/writes" "JPA"

        restLayer -> mapperLayer ""
        restLayer -> domainModel ""
        restLayer -> repositoryLayer ""
        mapperLayer -> restLayer ""
        mapperLayer -> domainModel ""
        repositoryLayer -> domainModel ""
    }

    views {
        systemContext petClinic "C1-Context" "Who uses PetClinic" {
            include *
            autoLayout
        }
        container petClinic "C2-Containers" "Containers inside PetClinic" {
            include *
            autoLayout
        }
        component backend "C3-Components-All" "All components inside Backend" {
            include *
            autoLayout
        }
        component backend "C3-Repository" "Repository Layer — nearest neighbours" {
            include ->repositoryLayer->
            autoLayout
        }
        component backend "C3-Mapper" "Mapper Layer — nearest neighbours" {
            include ->mapperLayer->
            autoLayout
        }

    }
}
