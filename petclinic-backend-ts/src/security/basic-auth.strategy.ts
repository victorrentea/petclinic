import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { BasicStrategy as PassportBasicStrategy } from 'passport-http';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { AuthenticatedPrincipal } from './authenticated-principal';

/**
 * HTTP Basic authentication strategy, ported from
 * victor.training.petclinic.security.BasicAuthenticationConfig.
 *
 * The Java config wires `auth.jdbcAuthentication()` with:
 *   usersByUsernameQuery       = "select username,password,enabled from users where username=?"
 *   authoritiesByUsernameQuery = "select username,role from roles where username=?"
 *
 * Here we reproduce that against the `users` / `roles` tables via TypeORM:
 *   1. load the user by username (with its eager `roles`);
 *   2. reject if missing, disabled, or without a stored password hash;
 *   3. bcrypt.compare the supplied password against the stored BCrypt hash
 *      (Spring used BCryptPasswordEncoder; the seeded `admin` user has the
 *      BCrypt hash for "admin");
 *   4. attach the role names as authorities on the principal.
 *
 * Passport's `done(err, user)` contract: passing `false` as the user signals an
 * authentication failure (-> 401). We additionally throw UnauthorizedException
 * defensively; either way Passport responds 401 with WWW-Authenticate.
 */
@Injectable()
export class BasicAuthStrategy extends PassportStrategy(PassportBasicStrategy) {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super();
  }

  async validate(username: string, password: string): Promise<AuthenticatedPrincipal> {
    const user = await this.userRepository.findOne({
      where: { username },
      relations: { roles: true },
    });

    if (!user || user.enabled === false || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const authorities = (user.roles ?? [])
      .map((role) => role.name)
      .filter((name): name is string => !!name);

    return { username: user.username, authorities };
  }
}
