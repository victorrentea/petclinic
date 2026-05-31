import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Response } from 'express';

/**
 * Root controller mapped to "/" that emits an HTTP 302 Found redirect to
 * "/swagger-ui/index.html".
 */
@Controller()
export class RootController {
  @Get('/')
  @ApiExcludeEndpoint()
  redirectToSwagger(@Res() response: Response): void {
    response.redirect(302, '/swagger-ui/index.html');
  }
}
