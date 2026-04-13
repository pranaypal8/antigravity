const { validationResult } = require('express-validator');

// Validation middleware wrapper
// Use this AFTER your validation chains in the route definition.
// E.g.: router.post('/login', loginValidator, validate, (req, res) => { ... })
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Return early with 400 Bad Request if validation fails
    return res.status(400).json({
      success: false,
      message: 'Validation failed.',
      errors: errors.array(),
    });
  }
  next();
};

module.exports = { validate };
