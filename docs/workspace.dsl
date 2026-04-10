workspace "PetClinic" {

    model {
        clinic_employee = person "Clinic Employee"
        petclinic = softwareSystem "PetClinic" {
            angular_spa = container "Angular SPA" "Single Page App" "Angular 16"
            spring_boot_api = container "Spring Boot API" "REST backend" "Spring Boot 3.5" {
                pet_rest_controller = component "Pet Rest Controller" "" "Spring MVC"
                owner_rest_controller = component "Owner Rest Controller" "" "Spring MVC"
                root_rest_controller = component "Root Rest Controller" "" "Spring MVC"
                pet_type_rest_controller = component "Pet Type Rest Controller" "" "Spring MVC"
                vet_rest_controller = component "Vet Rest Controller" "" "Spring MVC"
                visit_rest_controller = component "Visit Rest Controller" "" "Spring MVC"
                specialty_rest_controller = component "Specialty Rest Controller" "" "Spring MVC"
                user_rest_controller = component "User Rest Controller" "" "Spring MVC"
                pet_type_mapper = component "Pet Type Mapper" "" "MapStruct"
                user_mapper = component "User Mapper" "" "MapStruct"
                vet_mapper = component "Vet Mapper" "" "MapStruct"
                visit_mapper = component "Visit Mapper" "" "MapStruct"
                specialty_mapper = component "Specialty Mapper" "" "MapStruct"
                pet_mapper = component "Pet Mapper" "" "MapStruct"
                owner_mapper = component "Owner Mapper" "" "MapStruct"
                visit_repository = component "Visit Repository" "" "Spring Data JPA"
                vet_repository = component "Vet Repository" "" "Spring Data JPA"
                user_repository = component "User Repository" "" "Spring Data JPA"
                owner_repository = component "Owner Repository" "" "Spring Data JPA"
                specialty_repository = component "Specialty Repository" "" "Spring Data JPA"
                pet_repository = component "Pet Repository" "" "Spring Data JPA"
                pet_type_repository = component "Pet Type Repository" "" "Spring Data JPA"
            }
            database = container "Database" "Persistence" "H2 / PostgreSQL"
        }

        # Relationships
        clinic_employee -> angular_spa "Uses" "Browser"
        angular_spa -> spring_boot_api "Calls" "JSON/HTTP"
        pet_rest_controller -> pet_repository ""
        pet_rest_controller -> pet_mapper ""
        owner_rest_controller -> pet_repository ""
        owner_rest_controller -> owner_mapper ""
        owner_rest_controller -> pet_mapper ""
        owner_rest_controller -> pet_type_repository ""
        owner_rest_controller -> visit_mapper ""
        owner_rest_controller -> visit_repository ""
        owner_rest_controller -> owner_repository ""
        pet_type_rest_controller -> pet_type_mapper ""
        pet_type_rest_controller -> pet_type_repository ""
        vet_rest_controller -> specialty_mapper ""
        vet_rest_controller -> specialty_repository ""
        vet_rest_controller -> vet_repository ""
        vet_rest_controller -> vet_mapper ""
        visit_rest_controller -> visit_mapper ""
        visit_rest_controller -> visit_repository ""
        specialty_rest_controller -> specialty_mapper ""
        specialty_rest_controller -> specialty_repository ""
        user_rest_controller -> user_repository ""
        user_rest_controller -> user_mapper ""
        pet_type_repository -> database "reads/writes" "JPA"
        angular_spa -> root_rest_controller "calls" "JSON/HTTP"
        angular_spa -> owner_rest_controller "calls" "JSON/HTTP"
        visit_repository -> database "reads/writes" "JPA"
        angular_spa -> specialty_rest_controller "calls" "JSON/HTTP"
        vet_repository -> database "reads/writes" "JPA"
        specialty_repository -> database "reads/writes" "JPA"
        angular_spa -> pet_type_rest_controller "calls" "JSON/HTTP"
        user_repository -> database "reads/writes" "JPA"
        angular_spa -> visit_rest_controller "calls" "JSON/HTTP"
        angular_spa -> user_rest_controller "calls" "JSON/HTTP"
        pet_repository -> database "reads/writes" "JPA"
        angular_spa -> vet_rest_controller "calls" "JSON/HTTP"
        owner_repository -> database "reads/writes" "JPA"
        angular_spa -> pet_rest_controller "calls" "JSON/HTTP"
    }

    views {
        # Add your custom views here — all model elements are available above

        component spring_boot_api "Components" {
            include *
        }

        component spring_boot_api "Controllers" "REST controllers with their direct dependencies" {
            include ->pet_rest_controller->
            include ->owner_rest_controller->
            include ->root_rest_controller->
            include ->pet_type_rest_controller->
            include ->vet_rest_controller->
            include ->visit_rest_controller->
            include ->specialty_rest_controller->
            include ->user_rest_controller->
        }
    }
}
