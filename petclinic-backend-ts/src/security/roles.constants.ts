/**
 * Role name constants, ported 1:1 from
 * victor.training.petclinic.security.Roles.
 *
 * Java reference:
 *   public final String OWNER_ADMIN = "ROLE_OWNER_ADMIN";
 *   public final String VET_ADMIN   = "ROLE_VET_ADMIN";
 *   public final String ADMIN       = "ROLE_ADMIN";
 *
 * In Spring, the `Roles` @Component is referenced from SpEL inside
 * @PreAuthorize("hasRole(@roles.X)"). The roles stored in the `roles` table
 * already carry the `ROLE_` prefix (see the SampleData migration), and Spring's
 * hasRole() compares against authorities verbatim once the GrantedAuthority is
 * built from that column. The TS port therefore keeps the full `ROLE_`-prefixed
 * names as the canonical authority strings and compares them directly in the
 * RolesGuard.
 */
export const ROLE_OWNER_ADMIN = 'ROLE_OWNER_ADMIN';
export const ROLE_VET_ADMIN = 'ROLE_VET_ADMIN';
export const ROLE_ADMIN = 'ROLE_ADMIN';

/** All known roles, for convenience / validation. */
export const ALL_ROLES = [ROLE_OWNER_ADMIN, ROLE_VET_ADMIN, ROLE_ADMIN] as const;

export type RoleName = (typeof ALL_ROLES)[number];
