/**
 * Parse pagination parameters from a query object.
 *
 * @param {object} query - Express req.query object.
 * @param {object} [defaults] - Default values for page and limit.
 * @param {number} [defaults.page=1] - Default page number.
 * @param {number} [defaults.limit=20] - Default items per page.
 * @returns {{ page: number, limit: number, skip: number }} Parsed pagination values.
 */
export const parsePagination = (query, defaults = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || defaults.page || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(query.limit, 10) || defaults.limit || 20)
  );
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

/**
 * Build pagination metadata for response.
 *
 * @param {number} total - Total number of records.
 * @param {number} page - Current page number.
 * @param {number} limit - Items per page.
 * @returns {{ total: number, page: number, limit: number, totalPages: number, hasNextPage: boolean, hasPrevPage: boolean }}
 */
export const buildPaginationMeta = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit);

  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};
