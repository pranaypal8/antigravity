const { body, query } = require('express-validator');

const createOrderValidator = [
  body('items').isArray({ min: 1 }).withMessage('Order must contain at least one item'),
  body('items.*.shirtConfig.size')
    .isIn(['S', 'S.5', 'M', 'M.5', 'L', 'L.5', 'XL', 'XL.5', 'XXL', 'XXL.5', 'XXXL', 'XXXL.5'])
    .withMessage('Invalid size provided in one or more items'),
  body('promoCode').optional({ checkFalsy: true }).isString().trim(),
  body('customerDetails.name').trim().notEmpty().withMessage('Customer name is required').escape(),
  body('customerDetails.email').trim().isEmail().withMessage('Valid customer email is required').normalizeEmail(),
  body('customerDetails.phone').matches(/^\d{10}$/).withMessage('Valid 10-digit phone number is required'),
];

const verifyPaymentValidator = [
  body('razorpayOrderId').notEmpty().withMessage('Razorpay Order ID is required'),
  body('razorpayPaymentId').notEmpty().withMessage('Razorpay Payment ID is required'),
  body('razorpaySignature').notEmpty().withMessage('Razorpay Signature is required'),
  body('items').isArray({ min: 1 }).withMessage('Order must contain at least one item'),
  body('customerDetails.name').trim().notEmpty().escape(),
  body('customerDetails.email').trim().isEmail().normalizeEmail(),
  body('customerDetails.phone').matches(/^\d{10}$/),
  body('customerDetails.address.line1').trim().notEmpty().escape(),
  body('customerDetails.address.city').trim().notEmpty().escape(),
  body('customerDetails.address.state').trim().notEmpty().escape(),
  body('customerDetails.address.pincode').matches(/^\d{6}$/).withMessage('Valid 6-digit pincode is required'),
  body('pricing.subtotal').isNumeric(),
  body('pricing.gstAmount').isNumeric(),
  body('pricing.totalAmount').isNumeric(),
];

const refundValidator = [
  body('orderId').isMongoId().withMessage('Invalid Order ID'),
  body('amount').isNumeric().withMessage('Refund amount must be a number'),
  body('reason').trim().notEmpty().withMessage('Refund reason is required').escape(),
];

const transactionStatsValidator = [
  query('period').optional().isIn(['today', 'week', 'month']).withMessage('Invalid period parameter'),
];

module.exports = {
  createOrderValidator,
  verifyPaymentValidator,
  refundValidator,
  transactionStatsValidator,
};
