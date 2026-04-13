const { body, query, param } = require('express-validator');

const createTicketValidator = [
  body('name').trim().notEmpty().withMessage('Name is required').escape(),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('subject').trim().notEmpty().withMessage('Subject is required').escape(),
  body('message').trim().notEmpty().withMessage('Message is required').escape(),
  body('phone').optional().trim().escape(),
  body('orderId').optional().trim().escape(), // Could validate string format if strict orderId format is known e.g., /^SO-\d+$/
];

const getTicketsValidator = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(['open', 'in_progress', 'resolved', 'closed']).withMessage('Invalid status'),
  query('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
  query('assignedTo').optional().isMongoId(),
];

const ticketIdValidator = [
  param('id').isMongoId().withMessage('Invalid Ticket ID'),
];

const replyTicketValidator = [
  param('id').isMongoId().withMessage('Invalid Ticket ID'),
  body('message').trim().notEmpty().withMessage('Reply message is required').escape(),
  body('isInternal').optional().isBoolean(),
];

const updateTicketValidator = [
  param('id').isMongoId().withMessage('Invalid Ticket ID'),
  body('status').optional().isIn(['open', 'in_progress', 'resolved', 'closed']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('assignedTo').optional().isMongoId().withMessage('assignedTo must be a valid Mongo ID'),
  body('tags').optional().isArray(),
  body('tags.*').optional().trim().escape(),
];

const refundRequestValidator = [
  param('id').isMongoId().withMessage('Invalid Ticket ID'),
  body('amount').isNumeric().withMessage('Refund amount must be a number'),
  body('reason').trim().notEmpty().withMessage('Refund reason is required').escape(),
];

module.exports = {
  createTicketValidator,
  getTicketsValidator,
  ticketIdValidator,
  replyTicketValidator,
  updateTicketValidator,
  refundRequestValidator,
};
