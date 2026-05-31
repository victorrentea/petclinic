import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Response } from 'express';

/**
 * Mirrors victor.training.petclinic.rest.RootRestController.
 *
 * The Java controller is mapped to "/" and calls
 * {@code response.sendRedirect(contextPath + "/swagger-ui/index.html")},
 * which emits an HTTP 302 Found redirect. NestJS runs without a servlet
 * context path, so the target is simply "/swagger-ui/index.html".
 */
@Controller()
export class RootController {
  @Get('/')
  @ApiExcludeEndpoint()
  redirectToSwagger(@Res() response: Response): void {
    response.redirect(302, '/swagger-ui/index.html');
  }
}
