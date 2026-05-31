/**
 * The authenticated principal attached to `request.user` by Passport after a
 * successful HTTP Basic authentication.
 *
 * Mirrors Spring Security's authenticated `UserDetails` + granted authorities:
 * `username` is the login, `authorities` are the role names (already carrying
 * the `ROLE_` prefix, e.g. 'ROLE_ADMIN') loaded from the `roles` table. The
 * RolesGuard compares the @Roles(...) requirements against `authorities`.
 */
export interface AuthenticatedPrincipal {
  username: string;
  authorities: string[];
}
