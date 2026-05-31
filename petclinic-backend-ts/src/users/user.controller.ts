import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Response } from 'express';
import { Repository } from 'typeorm';
import { Roles } from '../security/roles.decorator';
import { UserDto } from './dto/user.dto';
import { Role } from './role.entity';
import { User } from './user.entity';
import { toUser, toUserDto } from './user.mapper';

/**
 * Ported from victor.training.petclinic.rest.UserRestController.
 *
 * Java: @RestController @RequestMapping("/api/users")
 *       @PreAuthorize("hasRole(@roles.ADMIN)")  ->  @Roles('ROLE_ADMIN') (class-level)
 *
 * Mirrors the Java design: NO service layer — the controller injects the
 * TypeORM repositories directly and uses the stateless mapper functions.
 */
@ApiTags('user-rest-controller')
@Controller('api/users')
@Roles('ROLE_ADMIN')
export class UserController {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    // Role is registered in forFeature so cascade persistence resolves its
    // metadata; the controller persists roles via the User cascade, mirroring
    // the Java @OneToMany(cascade = ALL).
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  /**
   * Java: @PostMapping @Transactional addUser(@RequestBody @Validated UserDto)
   *   - reject when the user has no roles ("User must have at least a role set!")
   *   - normalise each role name to the ROLE_ prefix
   *   - set the Role.user back-reference when absent
   *   - bcrypt-encode the password before saving
   *   - return 201 Created with Location: /api/users/{username}
   *
   * The Java code throws IllegalArgumentException for the empty-roles case. That
   * exception is NOT specially handled by ExceptionControllerAdvice, so it falls
   * through to the generic handler and yields HTTP 500. We faithfully reproduce
   * that by throwing a plain Error (the global exception filter maps unhandled
   * errors to 500), NOT a 400.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: UserDto })
  async addUser(
    @Body() userDto: UserDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserDto> {
    const user = toUser(userDto);

    if (!user.roles || user.roles.length === 0) {
      throw new Error('User must have at least a role set!');
    }

    for (const role of user.roles) {
      if (role.name && !role.name.startsWith('ROLE_')) {
        role.name = `ROLE_${role.name}`;
      }
      if (!role.user) {
        role.user = user;
      }
    }

    if (user.password != null) {
      user.password = await bcrypt.hash(user.password, 10);
    }

    await this.userRepository.save(user);

    response.setHeader('Location', `/api/users/${user.username}`);
    return toUserDto(user);
  }
}
