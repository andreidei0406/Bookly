/**
 * @module apiError
 * @description Custom error class for API errors with HTTP status codes,
 * structured error details, and static factory methods for common responses.
 */

/**
 * Custom API error class that extends the native Error.
 * Provides structured error information for consistent API responses.
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Human-readable error message
   * @param {Array<{ field?: string, message: string }>} [errors=[]] - Detailed validation errors
   * @param {boolean} [isOperational=true] - Whether this is an expected operational error
   */
  constructor(statusCode, message, errors = [], isOperational = true) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = isOperational;

    // Capture stack trace, excluding the constructor call from the trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Creates a 400 Bad Request error.
   * @param {string} [msg='Bad request'] - Error message
   * @param {Array<{ field?: string, message: string }>} [errors=[]] - Validation errors
   * @returns {ApiError}
   */
  static badRequest(msg = 'Bad request', errors = []) {
    return new ApiError(400, msg, errors);
  }

  /**
   * Creates a 401 Unauthorized error.
   * @param {string} [msg='Unauthorized'] - Error message
   * @returns {ApiError}
   */
  static unauthorized(msg = 'Unauthorized') {
    return new ApiError(401, msg);
  }

  /**
   * Creates a 403 Forbidden error.
   * @param {string} [msg='Forbidden'] - Error message
   * @returns {ApiError}
   */
  static forbidden(msg = 'Forbidden') {
    return new ApiError(403, msg);
  }

  /**
   * Creates a 404 Not Found error.
   * @param {string} [msg='Not found'] - Error message
   * @returns {ApiError}
   */
  static notFound(msg = 'Not found') {
    return new ApiError(404, msg);
  }

  /**
   * Creates a 409 Conflict error.
   * @param {string} [msg='Conflict'] - Error message
   * @returns {ApiError}
   */
  static conflict(msg = 'Conflict') {
    return new ApiError(409, msg);
  }

  /**
   * Creates a 429 Too Many Requests error.
   * @param {string} [msg='Too many requests'] - Error message
   * @returns {ApiError}
   */
  static tooManyRequests(msg = 'Too many requests') {
    return new ApiError(429, msg);
  }

  /**
   * Creates a 500 Internal Server Error.
   * Non-operational by default since internal errors are typically unexpected.
   * @param {string} [msg='Internal server error'] - Error message
   * @returns {ApiError}
   */
  static internal(msg = 'Internal server error') {
    return new ApiError(500, msg, [], false);
  }
}

export { ApiError };
export default ApiError;
