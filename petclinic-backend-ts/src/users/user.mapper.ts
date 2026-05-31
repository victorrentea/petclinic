import { User } from './user.entity';
import { Role } from './role.entity';
import { UserDto } from './dto/user.dto';
import { RoleDto } from './dto/role.dto';

/**
 * Ported from victor.training.petclinic.mapper.UserMapper (MapStruct).
 *
 * STATELESS plain functions, mirroring MapStruct's stateless nature — NO Nest DI,
 * NO @Injectable. Controllers import these functions directly.
 *
 * MapStruct maps by matching property names:
 * - UserDto <-> User: username, password, enabled, roles (List<RoleDto> <-> Set<Role>).
 * - RoleDto <-> Role: name. (Role.id and Role.user have no DTO counterpart, so they
 *   are NOT copied — `user` back-reference is set later by the controller.)
 *
 * NOTE: toUserDto intentionally maps `password` because the Java MapStruct mapper
 * does the same (UserDto has a `password` field and MapStruct copies it). The Java
 * model does NOT @JsonIgnore password on UserDto, so the port preserves that.
 */

export function toRole(roleDto: RoleDto): Role {
  const role = new Role();
  role.name = roleDto.name;
  return role;
}

export function toRoleDto(role: Role): RoleDto {
  const roleDto = new RoleDto();
  // class-validator @IsDefined would reject undefined, but mapping output is not
  // re-validated; mirror MapStruct's straight property copy.
  roleDto.name = role.name as string;
  return roleDto;
}

export function toUser(userDto: UserDto): User {
  const user = new User();
  user.username = userDto.username;
  user.password = userDto.password;
  user.enabled = userDto.enabled;
  // MapStruct maps the List<RoleDto> to a Set<Role>. An empty list maps to an
  // empty collection (NOT null), matching the UserDto default `roles = []`.
  user.roles = (userDto.roles ?? []).map(toRole);
  return user;
}

export function toUserDto(user: User): UserDto {
  const userDto = new UserDto();
  userDto.username = user.username;
  userDto.password = user.password;
  userDto.enabled = user.enabled;
  userDto.roles = (user.roles ?? []).map(toRoleDto);
  return userDto;
}
