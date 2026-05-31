import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key under which required role names are stored.
 * Read by the (security-phase-owned) RolesGuard.
 */
export const ROLES_KEY = 'roles';

/**
 * Mirrors Spring's @PreAuthorize("hasRole(...)") / "hasAnyRole(...)".
 *
 * Attach one or more role names (e.g. 'ROLE_VET_ADMIN'). When applied at the
 * class level it guards every handler; a method-level @Roles overrides the
 * class-level one. The RolesGuard treats multiple roles as "hasAnyRole".
 *
 * Role-based access is only enforced when PETCLINIC_SECURITY_ENABLE=true;
 * otherwise everything is permitted (default), matching the Java backend.
 */
export const Roles = (...roles: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
