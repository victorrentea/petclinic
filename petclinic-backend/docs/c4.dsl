workspace "PetClinic" "Veterinary practice management system" {

    model {
        petOwner = person "Pet Owner" "Manages their pets and appointments"
        veterinarian = person "Veterinarian" "Provides veterinary care"

        petClinic = softwareSystem "PetClinic" "Veterinary practice management system" {
            frontend = container "Frontend" "Single-page application" "Angular"
            backend = container "Backend" "REST API" "Java / Spring Boot" {
                restLayer = component "REST Layer" "HTTP endpoints, DTOs, error handlers" "Spring MVC" {
                    tags "REST Layer"
                    properties {
                        "packages" "rest, rest.dto, rest.error"
                    }
                }
                domainModel = component "Domain Model" "JPA entities" "JPA" {
                    tags "Domain Model"
                    properties {
                        "packages" "model"
                    }
                }
                repositoryLayer = component "Repository Layer" "Spring Data JPA repositories" "Spring Data" {
                    tags "Repository Layer"
                    properties {
                        "packages" "repository"
                    }
                }
                mapperLayer = component "Mapper Layer" "MapStruct mappers" "MapStruct" {
                    tags "Mapper Layer"
                    properties {
                        "packages" "mapper"
                    }
                }
                security = component "Security" "Spring Security configuration" "Spring Security" {
                    tags "Security"
                    properties {
                        "packages" "security"
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

        styles {
            element "Person" {
                shape Person
                background "#08427b"
                color "#ffffff"
            }
            element "Software System" {
                background "#1168bd"
                color "#ffffff"
            }
            element "Container" {
                background "#438dd5"
                color "#ffffff"
            }
            element "Component" {
                background "#85bbf0"
                color "#000000"
            }
            element "REST Layer" {
                background "#1168bd"
                color "#ffffff"
            }
            element "Domain Model" {
                background "#999999"
                color "#ffffff"
            }
            element "Repository Layer" {
                background "#e8a838"
                color "#ffffff"
            }
            element "Mapper Layer" {
                background "#4caf50"
                color "#ffffff"
            }
            element "Security" {
                background "#888888"
                color "#ffffff"
            }
        }
    }
}
