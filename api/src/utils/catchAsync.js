/**
 * @module catchAsync
 * @description Higher-order function that wraps async Express route handlers.
 * Catches any rejected promises and forwards the error to Express error-handling middleware.
 */

/**
 * Wraps an async Express route handler to catch errors automatically.
 * @param {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => Promise<void>} fn - Async route handler
 * @returns {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => void}
 */
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default catchAsync;
