workspace "PetClinic" "Veterinary practice management system" {

    # ─────────────────────────────────────────────────────────────────────────
    # C1 + C2 — human-maintained, STABLE.
    # People, containers and their high-level wiring cannot be derived from code
    # (the backend can't introspect the Angular SPA or PostgreSQL), so they live
    # here and change rarely.  The code-coupled C3 layer — component ↔ package
    # mapping and component dependencies — is split into c4model.c3.dsl, which
    # C3ArchTest validates against the real Java packages on every build.
    # ─────────────────────────────────────────────────────────────────────────

    model {
        petOwner = person "Pet Owner" "Manages their pets and appointments"
        veterinarian = person "Veterinarian" "Provides veterinary care"

        petClinic = softwareSystem "PetClinic" "Veterinary practice management system" {
            frontend = container "Frontend" "Single-page application" "Angular"
            backend = container "Backend" "REST API" "Java / Spring Boot" {
                # C3 components + edges — arch-tested vs code
                !include c4model.c3.dsl
            }
            database = container "Database" "Stores all data" "PostgreSQL"
        }

        petOwner -> petClinic "Manages pets and visits"
        veterinarian -> petClinic "Manages appointments and records"
        petOwner -> frontend "Uses"
        veterinarian -> frontend "Uses"
        frontend -> backend "REST API calls" "HTTPS/JSON"
        backend -> database "Reads/writes" "JPA"
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
