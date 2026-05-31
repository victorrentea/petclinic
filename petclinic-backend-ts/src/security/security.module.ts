import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from '../users/role.entity';
import { User } from '../users/user.entity';
import { BasicAuthGuard } from './basic-auth.guard';
import { BasicAuthStrategy } from './basic-auth.strategy';
import { RolesGuard } from './roles.guard';

/**
 * Security feature module.
 *
 * Wiring:
 *   - PassportModule: registers the passport infrastructure. We use the default
 *     ('basic') strategy from passport-http; no session (stateless).
 *   - TypeOrmModule.forFeature([User, Role]): makes the User repository
 *     injectable into BasicAuthStrategy so it can validate credentials against
 *     the users/roles tables.
 *   - Providers: BasicAuthStrategy (passport verify callback), BasicAuthGuard,
 *     and RolesGuard (the global authorization guard).
 *
 * RolesGuard is EXPORTED so the root app.module can register it globally via
 * `{ provide: APP_GUARD, useClass: RolesGuard }` (see Integration notes). When
 * PETCLINIC_SECURITY_ENABLE != true the guard permits everything, so importing
 * this module is harmless in the default (security-disabled) configuration.
 */
@Module({
  imports: [PassportModule, TypeOrmModule.forFeature([User, Role])],
  providers: [BasicAuthStrategy, BasicAuthGuard, RolesGuard],
  exports: [BasicAuthGuard, RolesGuard, PassportModule],
})
export class SecurityModule {}
