import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard that triggers the HTTP Basic passport strategy ('basic' is the default
 * name registered by passport-http's BasicStrategy).
 *
 * On success Passport sets `request.user` to the AuthenticatedPrincipal returned
 * by BasicAuthStrategy.validate(); on failure it throws 401 with a
 * WWW-Authenticate header.
 *
 * The RolesGuard delegates to this guard (only when security is enabled) to
 * perform authentication before checking role membership ("authenticate, then
 * authorize").
 */
@Injectable()
export class BasicAuthGuard extends AuthGuard('basic') {}
