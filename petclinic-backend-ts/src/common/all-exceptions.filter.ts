import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { Request, Response } from 'express';
import { EntityNotFoundError } from 'typeorm';
import { buildProblemDetail, ProblemDetail } from './problem-detail';
import { formatValidationErrors } from './validation-error.formatter';

/**
 * Global exception handler, mirroring the Spring {@code ExceptionControllerAdvice}.
 *
 * Maps:
 *   - validation failures (class-validator errors surfaced via {@link ValidationPipe}
 *     as a {@link BadRequestException}) -> 400, title "Validation Error",
 *     {@code errors[]} = humanized messages;
 *   - {@link NotFoundException} / TypeORM {@link EntityNotFoundError}
 *     (the analog of Java {@code NoSuchElementException}) -> 404, title "Not found!";
 *   - everything else -> 500, title/detail = the error message.
 *
 * NOTE: This filter is intentionally NOT registered here. The Integration phase wires
 * it in (e.g. {@code app.useGlobalFilters(new AllExceptionsFilter())} in main.ts, or as
 * an {@code APP_FILTER} provider in app.module.ts).
 *
 * To get the exact humanized messages, the Integration phase should also configure the
 * global {@link ValidationPipe} with {@link validationExceptionFactory} so the raw
 * {@link ValidationError}[] survives into this filter.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestUrl = this.buildRequestUrl(request);
    const requestPath = this.buildRequestPath(request);

    const pd = this.toProblemDetail(exception, requestUrl);

    // Spring's ProblemDetail always carries `instance` = the request URI path (path only,
    // not the full URL). Emit it after `detail` to mirror Spring's JSON key order.
    const body = {
      type: pd.type,
      title: pd.title,
      status: pd.status,
      detail: pd.detail,
      instance: requestPath,
      timestamp: pd.timestamp,
      ...(pd.errors !== undefined ? { errors: pd.errors } : {}),
    };

    response
      .status(pd.status)
      .type('application/problem+json')
      .json(body);
  }

  private toProblemDetail(exception: unknown, requestUrl: string): ProblemDetail {
    // ----- 400: validation failure ---------------------------------------------------
    const validationErrors = this.extractValidationErrors(exception);
    if (validationErrors !== null) {
      this.logger.warn(`Validation failed: ${JSON.stringify(validationErrors)}`);
      const pd = buildProblemDetail(
        'Validation Error',
        "Validation failed for request. See 'errors' for details.",
        HttpStatus.BAD_REQUEST,
        requestUrl,
      );
      pd.errors = validationErrors;
      return pd;
    }

    // ----- 404: not found (NoSuchElementException analog) -----------------------------
    if (exception instanceof NotFoundException || exception instanceof EntityNotFoundError) {
      this.logger.error('Not found!');
      return buildProblemDetail('Not found!', 'Not found!', HttpStatus.NOT_FOUND, requestUrl);
    }

    // ----- other HttpExceptions: honor their status, message becomes title/detail -----
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const message = this.messageOf(exception);
      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        this.logger.error(`An unexpected error occurred: ${message}`, exception.stack);
      } else {
        this.logger.warn(`Request failed (${status}): ${message}`);
      }
      return buildProblemDetail(message, message, status, requestUrl);
    }

    // ----- 500: everything else -------------------------------------------------------
    const message = exception instanceof Error ? exception.message : String(exception);
    const stack = exception instanceof Error ? exception.stack : undefined;
    this.logger.error(`An unexpected error occurred: ${message}`, stack);
    return buildProblemDetail(message, message, HttpStatus.INTERNAL_SERVER_ERROR, requestUrl);
  }

  /**
   * Recovers humanized validation messages from a {@link BadRequestException} raised by
   * the {@link ValidationPipe}. Handles two shapes:
   *   1. raw {@link ValidationError}[] attached via {@link validationExceptionFactory}
   *      (preferred — yields the exact Java-style humanized output);
   *   2. the default Nest payload {@code { message: string[], ... }} (fallback — the
   *      messages are class-validator defaults, already reasonably readable).
   * Returns {@code null} when the exception is not a validation failure.
   */
  private extractValidationErrors(exception: unknown): string[] | null {
    if (!(exception instanceof BadRequestException)) {
      return null;
    }

    const carrier = exception as BadRequestException & {
      validationErrors?: ValidationError[];
    };
    if (Array.isArray(carrier.validationErrors)) {
      return formatValidationErrors(carrier.validationErrors);
    }

    const payload = exception.getResponse();
    if (typeof payload === 'object' && payload !== null) {
      const message = (payload as { message?: unknown }).message;
      if (Array.isArray(message)) {
        return message.map((m) => String(m));
      }
    }
    return null;
  }

  private messageOf(exception: HttpException): string {
    const payload = exception.getResponse();
    if (typeof payload === 'string') {
      return payload;
    }
    if (typeof payload === 'object' && payload !== null) {
      const message = (payload as { message?: unknown }).message;
      if (typeof message === 'string') {
        return message;
      }
      if (Array.isArray(message)) {
        return message.map((m) => String(m)).join(', ');
      }
    }
    return exception.message;
  }

  /** Reconstructs the full request URL, mirroring Java {@code request.getRequestURL()}. */
  private buildRequestUrl(request: Request): string {
    const protocol = request.protocol ?? 'http';
    const host = request.get?.('host') ?? 'localhost';
    return `${protocol}://${host}${this.buildRequestPath(request)}`;
  }

  /**
   * Extracts the request URI path (no scheme/host/query), mirroring the value Spring puts in
   * {@code ProblemDetail.instance} (e.g. "/api/owners").
   */
  private buildRequestPath(request: Request): string {
    const originalUrl = request.originalUrl ?? request.url ?? '';
    return originalUrl.split('?')[0];
  }
}

/**
 * Exception factory for the global {@link ValidationPipe} that preserves the raw
 * {@link ValidationError}[] so {@link AllExceptionsFilter} can humanize them exactly like
 * the Java {@code ValidationErrorExtractor}/{@code ValidationErrorFieldExtractor}.
 *
 * Wiring (Integration phase, in main.ts):
 *   app.useGlobalPipes(new ValidationPipe({
 *     whitelist: true,
 *     transform: true,
 *     exceptionFactory: validationExceptionFactory,
 *   }));
 */
export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  const exception = new BadRequestException('Validation Error') as BadRequestException & {
    validationErrors: ValidationError[];
  };
  exception.validationErrors = errors;
  return exception;
}
