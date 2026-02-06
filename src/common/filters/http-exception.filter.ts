import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const isProduction = process.env.NODE_ENV === 'production';

    // Log errors (always log server errors, optionally log client errors)
    if (status >= 500) {
      this.logger.error(
        `HTTP ${status} ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else if (!isProduction) {
      this.logger.warn(`HTTP ${status} ${request.method} ${request.url}`, message);
    }

    // Extract message and errors from exception response
    let errorMessage: string;
    let errors: any[] | undefined;
    
    if (typeof message === 'string') {
      errorMessage = message;
    } else if (typeof message === 'object' && message !== null) {
      const msgObj = message as any;
      errorMessage = msgObj.message || 'An error occurred';
      // Preserve errors array if present
      if (Array.isArray(msgObj.errors)) {
        errors = msgObj.errors;
      } else if (msgObj.message && Array.isArray(msgObj.message)) {
        // NestJS sometimes puts validation errors in message array
        errors = msgObj.message.map((m: string) => ({ message: m }));
        errorMessage = 'Validation failed';
      }
    } else {
      errorMessage = 'An error occurred';
    }

    const errorResponse: any = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: errorMessage,
    };

    // Include errors array if present
    if (errors && errors.length > 0) {
      errorResponse.errors = errors;
    }

    // Only include stack trace in development
    if (!isProduction && exception instanceof Error && exception.stack) {
      errorResponse.stack = exception.stack;
    }

    response.status(status).json(errorResponse);
  }
}
