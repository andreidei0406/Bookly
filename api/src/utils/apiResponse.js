/**
 * @module apiResponse
 * @description Standardized API response helpers for consistent JSON output.
 * All responses follow the shape: { success, message, data, meta }.
 */

/**
 * Sends a successful response.
 * @param {import('express').Response} res - Express response object
 * @param {object} options - Response options
 * @param {number} [options.statusCode=200] - HTTP status code
 * @param {string} [options.message='Success'] - Response message
 * @param {*} [options.data=null] - Response payload
 * @param {object|null} [options.meta=null] - Pagination or other metadata
 * @returns {import('express').Response}
 */
export const success = (res, { statusCode = 200, message = 'Success', data = null, meta = null } = {}) => {
  const body = { success: true, message, data };
  if (meta !== null) {
    body.meta = meta;
  }
  return res.status(statusCode).json(body);
};

/**
 * Sends a 201 Created response.
 * @param {import('express').Response} res - Express response object
 * @param {object} options - Response options
 * @param {string} [options.message='Created'] - Response message
 * @param {*} [options.data=null] - Created resource payload
 * @returns {import('express').Response}
 */
export const created = (res, { message = 'Created', data = null } = {}) => res.status(201).json({
    success: true,
    message,
    data,
  });

/**
 * Sends a 204 No Content response.
 * @param {import('express').Response} res - Express response object
 * @returns {import('express').Response}
 */
export const noContent = (res) => res.status(204).end();
