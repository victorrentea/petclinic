import { SetMetadata } from '@nestjs/common';

/**
 * Security metadata decorators, mirroring Spring's method-level @PreAuthorize.
 *
 * This is the canonical home for the @Roles / @PermitAll decorators and their
 * metadata keys. `src/common/security/{roles,permit-all}.decorator.ts` re-export
 * from here so the two import paths used across the controllers resolve to the
 * exact same metadata keys (otherwise the RolesGuard could not read metadata set
 * via the other path).
 */

/** Metadata key under which required role names are stored. Read by RolesGuard. */
export const ROLES_KEY = 'roles';

/** Metadata key under which the permit-all flag is stored. Read by RolesGuard. */
export const PERMIT_ALL_KEY = 'permitAll';

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

/**
 * Mirrors Spring's @PreAuthorize("permitAll()").
 *
 * Applied at the method level to override a class-level @Roles(...) guard so the
 * endpoint is reachable without authentication, even when
 * PETCLINIC_SECURITY_ENABLE=true. The RolesGuard short-circuits (allows) when
 * this metadata is present, exactly like Spring's permitAll().
 */
export const PermitAll = (): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMIT_ALL_KEY, true);
