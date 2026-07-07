import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  HttpException,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import type { ArgumentsHost } from "@nestjs/common";
import { AllExceptionsFilter } from "./http-exception.filter";

function mockHost() {
  const send = vi.fn();
  const status = vi.fn().mockReturnValue({ send });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  return { host, send, status };
}

describe("AllExceptionsFilter", () => {
  let filter: AllExceptionsFilter;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    filter = new AllExceptionsFilter();

    errorSpy = vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("formats an HttpException with its status and string message", () => {
    const { host, send, status } = mockHost();

    filter.catch(new NotFoundException("Movie not found"), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        message: "Movie not found",
      }),
    );
  });

  it("extracts the message array from a validation-style exception", () => {
    const { host, send } = mockHost();

    filter.catch(
      new BadRequestException({
        message: ["field A is invalid", "field B is invalid"],
      }),
      host,
    );

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        message: ["field A is invalid", "field B is invalid"],
      }),
    );
  });

  it("falls back to 500 / 'Internal server error' for a non-HttpException", () => {
    const { host, send, status } = mockHost();

    filter.catch(new Error("boom"), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: "Internal server error",
      }),
    );
  });

  it("logs 5xx HttpExceptions to the server console", () => {
    const { host } = mockHost();

    filter.catch(
      new HttpException("upstream failed", HttpStatus.BAD_GATEWAY),
      host,
    );

    expect(errorSpy).toHaveBeenCalled();
  });

  it("logs unexpected non-HttpException errors", () => {
    const { host } = mockHost();

    filter.catch(new Error("boom"), host);

    expect(errorSpy).toHaveBeenCalled();
  });

  it("does not log normal 4xx client errors", () => {
    const { host } = mockHost();

    filter.catch(new NotFoundException("nope"), host);

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("includes a valid ISO timestamp in the response", () => {
    const { host, send } = mockHost();

    filter.catch(new BadRequestException("bad"), host);

    const payload = send.mock.calls[0][0];
    expect(payload.timestamp).toBe(new Date(payload.timestamp).toISOString());
  });
});
