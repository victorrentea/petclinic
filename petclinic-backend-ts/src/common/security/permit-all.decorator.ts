import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key under which the permit-all flag is stored.
 * Read by the (security-phase-owned) RolesGuard.
 */
export const PERMIT_ALL_KEY = 'permitAll';

/**
 * Mirrors Spring's @PreAuthorize("permitAll()").
 *
 * Applied at the method level to override a class-level @Roles(...) guard so the
 * endpoint is reachable without authentication, even when
 * PETCLINIC_SECURITY_ENABLE=true. The RolesGuard must short-circuit (allow) when
 * this metadata is present, exactly like Spring's permitAll().
 */
export const PermitAll = (): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMIT_ALL_KEY, true);
