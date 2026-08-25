/**
 * Base error class for all Township SDK errors.
 *
 * `code` carries the machine-readable error code the Energy, Federal Land,
 * and Texas APIs return in v1 error bodies (`{"error": {"code", "message"}}`),
 * e.g. `invalid_parameter`, `missing_parameter`, `plss_not_supported`,
 * `ambiguous_location`, `not_found`, `rate_limit_exceeded`. It is null for
 * endpoints that do not send one.
 */
export class TownshipError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number | null = null,
    public readonly code: string | null = null
  ) {
    super(message);
    this.name = "TownshipError";
  }
}

/**
 * Thrown when the API key is missing or invalid (HTTP 401).
 */
export class AuthenticationError extends TownshipError {
  constructor(message = "Invalid or missing API key", code: string | null = null) {
    super(message, 401, code);
    this.name = "AuthenticationError";
  }
}

/**
 * Thrown when no result is found for the given input.
 */
export class NotFoundError extends TownshipError {
  constructor(message = "Location not found", code: string | null = null) {
    super(message, 404, code);
    this.name = "NotFoundError";
  }
}

/**
 * Thrown when the API rate limit is exceeded (HTTP 429).
 */
export class RateLimitError extends TownshipError {
  constructor(
    message = "Rate limit exceeded. Please slow down your requests.",
    code: string | null = null
  ) {
    super(message, 429, code);
    this.name = "RateLimitError";
  }
}

/**
 * Thrown when the request is malformed (HTTP 400).
 */
export class ValidationError extends TownshipError {
  constructor(message = "Invalid request", code: string | null = null) {
    super(message, 400, code);
    this.name = "ValidationError";
  }
}

/**
 * Thrown when the batch payload exceeds the maximum size (HTTP 413).
 */
export class PayloadTooLargeError extends TownshipError {
  constructor(
    message = "Batch payload exceeds the maximum of 100 records per request",
    code: string | null = null
  ) {
    super(message, 413, code);
    this.name = "PayloadTooLargeError";
  }
}
