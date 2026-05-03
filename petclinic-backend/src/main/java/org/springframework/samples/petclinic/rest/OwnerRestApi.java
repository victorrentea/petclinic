package org.springframework.samples.petclinic.rest;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.Parameters;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.data.domain.Pageable;
import org.springframework.samples.petclinic.rest.dto.OwnerDto;
import org.springframework.samples.petclinic.rest.dto.OwnerFieldsDto;
import org.springframework.samples.petclinic.rest.dto.OwnerPageDto;
import org.springframework.samples.petclinic.rest.dto.PetDto;
import org.springframework.samples.petclinic.rest.dto.PetFieldsDto;
import org.springframework.samples.petclinic.rest.dto.VisitFieldsDto;
import org.springframework.http.ResponseEntity;

public interface OwnerRestApi {

    @Operation(operationId = "listOwners", summary = "List owners")
    @Parameters({
        @Parameter(name = "page", in = ParameterIn.QUERY, description = "Zero-based owner page index.",
            schema = @Schema(defaultValue = "0", minimum = "0")),
        @Parameter(name = "size", in = ParameterIn.QUERY, description = "Owner page size.",
            schema = @Schema(defaultValue = "10", allowableValues = {"10", "20"})),
        @Parameter(name = "sort", in = ParameterIn.QUERY, description = "Owner sort field and direction.",
            schema = @Schema(defaultValue = "name,asc", allowableValues = {"name,asc", "name,desc", "city,asc", "city,desc"}))
    })
    OwnerPageDto listOwners(
        @Parameter(in = ParameterIn.QUERY, description = "Free-text owner search query.") String query,
        @Parameter(hidden = true) Pageable pageable
    );

    @Operation(operationId = "getOwner", summary = "Get an owner by ID")
    OwnerDto getOwner(int ownerId);

    @Operation(operationId = "addOwner", summary = "Create an owner")
    ResponseEntity<Void> addOwner(OwnerFieldsDto ownerFieldsDto);

    @Operation(operationId = "updateOwner", summary = "Update an owner")
    void updateOwner(int ownerId, OwnerFieldsDto ownerFieldsDto);

    @Operation(operationId = "deleteOwner", summary = "Delete an owner by ID")
    void deleteOwner(int ownerId);

    @Operation(operationId = "addPetToOwner", summary = "Add a pet to an owner")
    ResponseEntity<Void> addPetToOwner(int ownerId, PetFieldsDto petFieldsDto);

    @Operation(operationId = "updateOwnersPet", summary = "Update an owner's pet")
    void updateOwnersPet(int ownerId, int petId, PetFieldsDto petFieldsDto);

    @Operation(operationId = "addVisitToOwner", summary = "Add a visit for an owner's pet")
    ResponseEntity<Void> addVisitToOwner(int ownerId, int petId, VisitFieldsDto visitFieldsDto);

    @Operation(operationId = "getOwnersPet", summary = "Get a pet belonging to an owner")
    PetDto getOwnersPet(int ownerId, int petId);
}
