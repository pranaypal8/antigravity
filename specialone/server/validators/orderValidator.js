const { body, query, param } = require('express-validator');

const getOrdersValidator = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().trim().escape(),
  query('paymentStatus').optional().trim().escape(),
  query('startDate').optional().isISO8601().toDate(),
  query('endDate').optional().isISO8601().toDate(),
  query('search').optional().trim().escape(),
];

const manualOrderValidator = [
  body('customerDetails.name').trim().notEmpty().withMessage('Customer name required').escape(),
  body('customerDetails.email').trim().isEmail().normalizeEmail(),
  body('customerDetails.phone').matches(/^\d{10}$/).withMessage('Valid phone required'),
  body('items').isArray({ min: 1 }),
  body('items.*.shirtConfig.size')
    .isIn(['S', 'S.5', 'M', 'M.5', 'L', 'L.5', 'XL', 'XL.5', 'XXL', 'XXL.5', 'XXXL', 'XXXL.5'])
    .withMessage('Invalid size in manual order'),
];

const updateOrderStatusValidator = [
  param('id').isMongoId().withMessage('Invalid Mongo ID'),
  body('status').isIn([
    'received', 'in_production', 'quality_check', 'packed',
    'dispatched', 'delivered', 'cancelled', 'returned'
  ]).withMessage('Invalid status'),
  body('note').optional().trim().escape(),
];

const paramIdValidator = [
  param('id').isMongoId().withMessage('Invalid Mongo ID'),
];

const trackOrderValidator = [
  param('orderId').trim().notEmpty().withMessage('Order ID is required').escape(),
];

module.exports = {
  getOrdersValidator,
  manualOrderValidator,
  updateOrderStatusValidator,
  paramIdValidator,
  trackOrderValidator,
};
