/**
 * Role name constants:
 *   OWNER_ADMIN = "ROLE_OWNER_ADMIN"
 *   VET_ADMIN   = "ROLE_VET_ADMIN"
 *   ADMIN       = "ROLE_ADMIN"
 *
 * The roles stored in the `roles` table already carry the `ROLE_` prefix (see
 * the SampleData migration). These constants keep the full `ROLE_`-prefixed
 * names as the canonical authority strings, which the RolesGuard compares
 * against directly.
 */
export const ROLE_OWNER_ADMIN = 'ROLE_OWNER_ADMIN';
export const ROLE_VET_ADMIN = 'ROLE_VET_ADMIN';
export const ROLE_ADMIN = 'ROLE_ADMIN';

/** All known roles, for convenience / validation. */
export const ALL_ROLES = [ROLE_OWNER_ADMIN, ROLE_VET_ADMIN, ROLE_ADMIN] as const;

export type RoleName = (typeof ALL_ROLES)[number];
