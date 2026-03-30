// ============================================================
// SECURITY MIDDLEWARE
// ============================================================
// This file configures all security protections for the server:
// - HTTP security headers (helmet)
// - CORS (who can call our API)
// - Rate limiters (prevents brute force and spam)
// - MongoDB injection prevention
// ============================================================

const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

// ── 1. HTTP Security Headers ──────────────────────────────────
// Helmet sets secure headers on every response.
// These protect against clickjacking, XSS, and other browser attacks.
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",       // Needed for inline JS in HTML files
        'https://checkout.razorpay.com',  // Razorpay checkout script
        'https://fonts.googleapis.com',
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",       // Needed for inline styles
        'https://fonts.googleapis.com',
        'https://fonts.gstatic.com',
      ],
      fontSrc:  ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:   ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'", 'https://api.razorpay.com', 'https://apiv2.shiprocket.in'],
      frameSrc: ['https://api.razorpay.com'],
    },
  },
  crossOriginEmbedderPolicy: false, // Needed for Razorpay iframe
});

// ── 2. CORS ───────────────────────────────────────────────────
// Only our own site can call the API in production.
// In development mode, localhost is also allowed.
const allowedOrigins = [
  'https://specialone.in',
  'https://www.specialone.in',
];

if (process.env.NODE_ENV === 'development') {
  allowedOrigins.push(`http://localhost:${process.env.PORT || 5000}`);
  allowedOrigins.push('http://localhost:3000');
  allowedOrigins.push('http://127.0.0.1:5000');
}

const corsConfig = cors({
  origin: (origin, callback) => {
    // Allow same-origin (no origin header = server-to-server or file://)
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS blocked: ${origin} is not an allowed origin`));
  },
  credentials: true,          // Required for cookies (JWT tokens)
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,              // Browser can cache CORS preflight for 24 hours
});

// ── 3. MongoDB Sanitization ───────────────────────────────────
// Strips characters like $ and . from query inputs.
// This prevents NoSQL injection attacks (e.g., { "$gt": "" }).
const mongoSanitizeConfig = mongoSanitize({
  replaceWith: '_', // Replace dangerous chars with underscore
  onSanitize: ({ req, key }) => {
    // Log if someone tries to inject (might be an attack)
    if (process.env.NODE_ENV === 'development') {
      console.warn(`⚠️  MongoDB sanitization triggered on key: ${key}`);
    }
  },
});

// ── 4. Rate Limiters ─────────────────────────────────────────
// Prevents abuse by limiting how many requests someone can make.

// General API rate limiter: 100 requests per minute per IP
const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minute window
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please wait a moment before trying again.',
  },
  skip: (req) => {
    // Never rate-limit health checks or static files
    return req.path === '/api/health' || req.path.startsWith('/assets/');
  },
});

// Checkout rate limiter: max 5 payment attempts per minute per IP
// This is critical — prevents payment manipulation attempts
const checkoutRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many payment attempts. Please wait 1 minute before trying again.',
  },
});

// Login rate limiter: max 10 login attempts per 15 minutes per IP
// Prevents brute force password attacks on the admin panel
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15-minute window
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please wait 15 minutes before trying again.',
  },
  skipSuccessfulRequests: true, // Don't count successful logins against the limit
});

module.exports = {
  helmetConfig,
  corsConfig,
  mongoSanitizeConfig,
  generalRateLimiter,
  loginRateLimiter,
  checkoutRateLimiter,
};
