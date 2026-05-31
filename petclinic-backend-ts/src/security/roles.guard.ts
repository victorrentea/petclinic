import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { isSecurityEnabled } from '../config/app-config';
import { AuthenticatedPrincipal } from './authenticated-principal';
import { PERMIT_ALL_KEY, ROLES_KEY } from './roles.decorator';

/**
 * Global authorization guard.
 *
 * Behaviour (in order):
 *   1. Security DISABLED (PETCLINIC_SECURITY_ENABLE != true, the default) ->
 *      permit everything.
 *   2. @PermitAll() on the handler/class -> permit without authentication.
 *   3. Otherwise authenticate via HTTP Basic (passport 'basic' strategy). A
 *      failed/absent authentication yields 401.
 *   4. If @Roles(...) is present, require the authenticated principal to hold at
 *      least one of those roles. Otherwise just being authenticated suffices.
 *      A role mismatch yields 403.
 *
 * Extends AuthGuard('basic') so it can drive Passport authentication itself; we
 * only invoke that step when security is on and the route is not @PermitAll.
 *
 * Method-level metadata overrides class-level metadata (NestJS reflector
 * getAllAndOverride).
 */
@Injectable()
export class RolesGuard extends AuthGuard('basic') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Security disabled -> permit all.
    if (!isSecurityEnabled()) {
      return true;
    }

    const handler = context.getHandler();
    const controller = context.getClass();

    // 2. @PermitAll overrides any role requirement and skips authentication.
    const permitAll = this.reflector.getAllAndOverride<boolean>(PERMIT_ALL_KEY, [
      handler,
      controller,
    ]);
    if (permitAll) {
      return true;
    }

    // 3. Authenticate (HTTP Basic). Throws 401 on failure.
    const authenticated = (await super.canActivate(context)) as boolean;
    if (!authenticated) {
      return false;
    }

    // 4. Authorize against required roles (method overrides class).
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      handler,
      controller,
    ]);

    // No @Roles -> being authenticated is enough (anyRequest().authenticated()).
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const principal = request.user as AuthenticatedPrincipal | undefined;
    const authorities = principal?.authorities ?? [];

    const hasAnyRole = requiredRoles.some((role) => authorities.includes(role));
    if (!hasAnyRole) {
      throw new ForbiddenException('Access is denied');
    }
    return true;
  }
}
