const { query } = require('express-validator');

const analyticsValidator = [
  query('period').optional().isIn(['today', 'week', 'month', 'year', 'all']).withMessage('Invalid analytics period'),
  query('startDate').optional().isISO8601().toDate(),
  query('endDate').optional().isISO8601().toDate(),
];

module.exports = {
  analyticsValidator,
};
