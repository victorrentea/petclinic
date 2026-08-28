package victor.training.petclinic.mapper;

import org.springframework.stereotype.Component;
import victor.training.petclinic.domain.Role;
import victor.training.petclinic.domain.User;
import victor.training.petclinic.rest.dto.RoleDto;
import victor.training.petclinic.rest.dto.UserDto;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Component
public class UserMapper {

    public User toUser(UserDto userDto) {
        if (userDto == null) {
            return null;
        }
        User user = new User();
        user.setUsername(userDto.getUsername());
        user.setPassword(userDto.getPassword());
        user.setEnabled(userDto.getEnabled());
        user.setRoles(toRoles(userDto.getRoles()));
        return user;
    }

    public UserDto toUserDto(User user) {
        if (user == null) {
            return null;
        }
        UserDto userDto = new UserDto();
        userDto.setUsername(user.getUsername());
        userDto.setPassword(user.getPassword());
        userDto.setEnabled(user.getEnabled());
        userDto.setRoles(toRoleDtos(user.getRoles()));
        return userDto;
    }

    private Role toRole(RoleDto roleDto) {
        if (roleDto == null) {
            return null;
        }
        Role role = new Role();
        role.setName(roleDto.getName());
        return role;
    }

    private Set<Role> toRoles(List<RoleDto> roleDtos) {
        if (roleDtos == null) {
            return null;
        }
        Set<Role> roles = LinkedHashSet.newLinkedHashSet(roleDtos.size());
        for (RoleDto roleDto : roleDtos) {
            roles.add(toRole(roleDto));
        }
        return roles;
    }

    private RoleDto toRoleDto(Role role) {
        if (role == null) {
            return null;
        }
        RoleDto roleDto = new RoleDto();
        roleDto.setName(role.getName());
        return roleDto;
    }

    private List<RoleDto> toRoleDtos(Set<Role> roles) {
        if (roles == null) {
            return null;
        }
        List<RoleDto> roleDtos = new ArrayList<>(roles.size());
        for (Role role : roles) {
            roleDtos.add(toRoleDto(role));
        }
        return roleDtos;
    }
}
