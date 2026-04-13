const { param, query } = require('express-validator');

const shippingOrderIdValidator = [
  param('orderId').isMongoId().withMessage('Invalid Order ID'),
];

const trackAwbValidator = [
  param('awb').trim().notEmpty().withMessage('AWB number is required').escape(),
];

const allShipmentsValidator = [
  query('page').optional().isInt({ min: 1 }).toInt(),
];

module.exports = {
  shippingOrderIdValidator,
  trackAwbValidator,
  allShipmentsValidator,
};
