package org.springframework.samples.petclinic.rest;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.samples.petclinic.mapper.UserMapper;
import org.springframework.samples.petclinic.model.Role;
import org.springframework.samples.petclinic.model.User;
import org.springframework.samples.petclinic.repository.UserRepository;
import org.springframework.samples.petclinic.rest.dto.UserDto;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.util.UriComponentsBuilder;

import org.springframework.transaction.annotation.Transactional;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole(@roles.ADMIN)")
public class UserRestController {
    private final UserRepository userRepository;
    private final UserMapper userMapper;

    @PostMapping
    @Transactional
    public ResponseEntity<UserDto> addUser(@RequestBody @Validated UserDto userDto) {
        User user = userMapper.toUser(userDto);

        if(user.getRoles() == null || user.getRoles().isEmpty()) {
            throw new IllegalArgumentException("User must have at least a role set!");
        }

        for (Role role : user.getRoles()) {
            if(!role.getName().startsWith("ROLE_")) {
                role.setName("ROLE_" + role.getName());
            }

            if(role.getUser() == null) {
                role.setUser(user);
            }
        }

        userRepository.save(user);
        return ResponseEntity.created(UriComponentsBuilder.fromPath("/api/users/{username}")
                .buildAndExpand(user.getUsername()).toUri())
            .body(userMapper.toUserDto(user));
    }
}
