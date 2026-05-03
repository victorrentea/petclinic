package org.springframework.samples.petclinic.rest;

import io.swagger.v3.oas.annotations.Operation;
import org.springframework.http.ResponseEntity;
import org.springframework.samples.petclinic.rest.dto.UserDto;

public interface UserRestApi {

    @Operation(operationId = "addUser", summary = "Create a user")
    ResponseEntity<UserDto> addUser(UserDto userDto);
}
