import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { FastifyReply } from "fastify";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = "Internal server error";

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      // Only log unexpected server errors — 4xx are normal client errors
      if (status >= 500) {
        console.error("--- 🔥 SERVER ERROR ---");
        console.error(exception);
        if (exception instanceof Error) console.error("Stack:", exception.stack);
        console.error("----------------------");
      }
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === "string") {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === "object") {
        const responseObj = exceptionResponse as Record<string, unknown>;
        message = (responseObj.message as string | string[]) || message;
      }
    }

    response.status(status).send({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
