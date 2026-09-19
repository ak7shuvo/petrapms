import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

/**
 * Phase 10 — production error sanitization (see
 * docs/SECURITY-ARCHITECTURE.md — Error Handling).
 *
 * Nest's default behavior for an unhandled (non-HttpException) error is
 * to return the raw error, which for a PrismaClientKnownRequestError
 * includes table/column names, and for anything else can include a full
 * stack trace — none of that is safe to hand to a client. This filter
 * guarantees every response is one of a small, predictable shape, while
 * the full original error (message + stack) always still reaches the
 * server log via Nest's Logger for real debugging.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ method: string; url: string }>();

    const { status, body } = this.shape(exception);

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}: ${this.describe(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} -> ${status}: ${this.describe(exception)}`);
    }

    response.status(status).json(body);
  }

  private shape(exception: unknown): { status: number; body: Record<string, unknown> } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message =
        typeof res === 'string'
          ? res
          : (res as { message?: string | string[] }).message ?? exception.message;
      return { status, body: { statusCode: status, message } };
    }

    // Known Prisma errors get a stable, non-leaky client message instead
    // of their raw (often schema-revealing) internals.
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return {
          status: HttpStatus.CONFLICT,
          body: { statusCode: HttpStatus.CONFLICT, message: 'A record with these details already exists.' },
        };
      }
      if (exception.code === 'P2025') {
        return {
          status: HttpStatus.NOT_FOUND,
          body: { statusCode: HttpStatus.NOT_FOUND, message: 'Resource not found.' },
        };
      }
      return {
        status: HttpStatus.BAD_REQUEST,
        body: { statusCode: HttpStatus.BAD_REQUEST, message: 'The request could not be processed.' },
      };
    }

    // Anything else (programming errors, unexpected exceptions): never
    // echo the original message or stack to the client.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'An unexpected error occurred.' },
    };
  }

  private describe(exception: unknown): string {
    if (exception instanceof Error) return exception.message;
    return String(exception);
  }
}
