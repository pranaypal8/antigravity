const { body, param } = require('express-validator');

// Validation rules for auth endpoints
const loginValidator = [
  body('email').trim().isEmail().withMessage('Enter a valid email address').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

const createAdminValidator = [
  body('name').trim().notEmpty().withMessage('Name is required').escape(),
  body('email').trim().isEmail().withMessage('Enter a valid email address').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  body('role').isIn(['admin', 'vendor', 'support', 'superadmin']).withMessage('Invalid role selected'),
];

const updatePasswordValidator = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters long'),
];

const updateAdminValidator = [
  param('id').isMongoId().withMessage('Invalid admin ID'),
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty if provided').escape(),
  body('role').optional().isIn(['admin', 'vendor', 'support', 'superadmin']).withMessage('Invalid role selected'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean value'),
];

const adminIdValidator = [
  param('id').isMongoId().withMessage('Invalid admin ID'),
];

module.exports = {
  loginValidator,
  createAdminValidator,
  updatePasswordValidator,
  updateAdminValidator,
  adminIdValidator,
};
