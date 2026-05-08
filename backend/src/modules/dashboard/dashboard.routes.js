const router = require('express').Router();
const { protect, tenantFilter } = require('../../middleware/auth');
const { getSummary } = require('./dashboard.service');
const { ok, error }  = require('../../utils/response');

// GET /api/dashboard/summary
router.get('/summary', protect, tenantFilter, async (req, res) => {
  try {
    const data = await getSummary(req.tenantFilter);
    return ok(res, data);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
});

module.exports = router;
