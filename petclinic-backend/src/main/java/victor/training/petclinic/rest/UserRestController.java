package victor.training.petclinic.rest;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import victor.training.petclinic.mapper.UserMapper;
import victor.training.petclinic.model.Role;
import victor.training.petclinic.model.User;
import victor.training.petclinic.repository.UserRepository;
import victor.training.petclinic.rest.dto.UserDto;
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
