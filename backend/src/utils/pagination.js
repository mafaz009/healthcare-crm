/**
 * Parse page/limit from query string and return Prisma-ready skip/take values.
 * Also returns metadata to include in list responses.
 */
const paginate = (query) => {
  const page  = Math.max(1, parseInt(query.page,  10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip  = (page - 1) * limit;
  return { page, limit, skip, take: limit };
};

/**
 * Build the pagination block returned in every list response.
 */
const paginationMeta = (total, page, limit) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
  hasNext: page * limit < total,
  hasPrev: page > 1,
});

module.exports = { paginate, paginationMeta };
