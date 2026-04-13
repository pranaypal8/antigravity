const { body, param, query } = require('express-validator');

const getProductsValidator = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('category').optional().trim().escape(),
  query('isActive').optional().isBoolean().toBoolean(),
  query('search').optional().trim().escape(),
];

const productIdValidator = [
  param('id').isMongoId().withMessage('Invalid Product ID'),
];

const createProductValidator = [
  body('name').trim().notEmpty().withMessage('Product name is required').escape(),
  body('description').optional().trim().escape(),
  body('price').isNumeric().withMessage('Price must be a number'),
  body('category').optional().trim().escape(),
  body('isActive').optional().isBoolean(),
];

const updateProductValidator = [
  param('id').isMongoId().withMessage('Invalid Product ID'),
  body('name').optional().trim().notEmpty().withMessage('Product name cannot be empty').escape(),
  body('description').optional().trim().escape(),
  body('price').optional().isNumeric().withMessage('Price must be a number'),
  body('category').optional().trim().escape(),
  body('isActive').optional().isBoolean(),
];

module.exports = {
  getProductsValidator,
  productIdValidator,
  createProductValidator,
  updateProductValidator,
};
