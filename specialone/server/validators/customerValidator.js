const { body, query, param } = require('express-validator');

const getCustomersValidator = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('search').optional().trim().escape(),
];

const customerIdValidator = [
  param('id').isMongoId().withMessage('Invalid Customer ID'),
];

const toggleBlacklistValidator = [
  param('id').isMongoId().withMessage('Invalid Customer ID'),
  body('isBlacklisted').isBoolean().withMessage('isBlacklisted must be true or false'),
  body('reason').optional().trim().escape(),
];

const updateNotesValidator = [
  param('id').isMongoId().withMessage('Invalid Customer ID'),
  body('notes').optional().trim().escape(),
];

module.exports = {
  getCustomersValidator,
  customerIdValidator,
  toggleBlacklistValidator,
  updateNotesValidator,
};
