// ============================================================
// MAIN SERVER — Special One Express Application
// ============================================================
// This is the heart of the backend. It:
// 1. Loads all security protections
// 2. Connects to MongoDB
// 3. Mounts all API routes
// 4. Serves the HTML pages to visitors
// ============================================================

require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');
const connectDB = require('./config/db');

// Import security middleware
const {
  helmetConfig,
  corsConfig,
  mongoSanitizeConfig,
  generalRateLimiter,
  loginRateLimiter,
  checkoutRateLimiter,
} = require('./middleware/security');

// Import all route handlers
const authRoutes     = require('./routes/auth');
const orderRoutes    = require('./routes/order');
const paymentRoutes  = require('./routes/payment');
const shippingRoutes = require('./routes/shipping');
const productRoutes  = require('./routes/product');
const customerRoutes = require('./routes/customer');
const supportRoutes  = require('./routes/support');
const analyticsRoutes = require('./routes/analytics');

// ── Bootstrap ────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB Atlas
connectDB();

// ── Security Middleware (must come FIRST) ────────────────────
app.use(helmetConfig);         // Sets secure HTTP headers
app.use(corsConfig);           // Controls which origins can call our API
app.use(mongoSanitizeConfig);  // Strips dangerous characters from DB queries

// ── Request Parsing ──────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));           // Parse JSON request bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parse form data
app.use(cookieParser());                             // Parse httpOnly cookies

// ── Logging ─────────────────────────────────────────────────
// Only log HTTP requests in development mode — production logs would be too noisy
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ── Static Files ─────────────────────────────────────────────
// Serve the uploaded product images and SVG assets
app.use('/assets', express.static(path.join(__dirname, '../assets')));

// Serve the entire frontend (HTML, CSS, JS files) from the project root
app.use(express.static(path.join(__dirname, '..')));

// ── API Routes ───────────────────────────────────────────────
// All customer-facing APIs
app.use('/api/auth',     loginRateLimiter, authRoutes);
app.use('/api/orders',   generalRateLimiter, orderRoutes);
app.use('/api/payment',  checkoutRateLimiter, paymentRoutes);
app.use('/api/shipping', generalRateLimiter, shippingRoutes);
app.use('/api/products', generalRateLimiter, productRoutes);
app.use('/api/customers',generalRateLimiter, customerRoutes);
app.use('/api/support',  generalRateLimiter, supportRoutes);
app.use('/api/analytics',generalRateLimiter, analyticsRoutes);

// ── Health Check ─────────────────────────────────────────────
// Used to check if the server is running. Visit /api/health to see status.
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Special One server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ── SPA Fallback ─────────────────────────────────────────────
// For any route not matched above, serve the homepage.
// This lets the browser handle navigation between HTML pages.
app.get('*', (req, res) => {
  // Don't fall back for API routes that weren't found — return 404 JSON
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'API endpoint not found' });
  }
  // For admin routes, serve admin login
  if (req.path.startsWith('/admin/') && req.path !== '/admin/login.html') {
    return res.sendFile(path.join(__dirname, '../admin/login.html'));
  }
  // For all other routes, serve homepage
  res.sendFile(path.join(__dirname, '../index.html'));
});

// ── Global Error Handler ─────────────────────────────────────
// Catches any unhandled errors and returns a clean response instead of a crash
app.use((err, req, res, next) => {
  console.error('🔴 Server error:', err.stack);

  // Don't expose internal error details in production
  const message = process.env.NODE_ENV === 'production'
    ? 'Something went wrong on our end. Please try again.'
    : err.message;

  res.status(err.status || 500).json({
    success: false,
    message,
  });
});

// ── Start Server ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║       SPECIAL ONE SERVER RUNNING      ║
  ╠═══════════════════════════════════════╣
  ║  Local:   http://localhost:${PORT}        ║
  ║  Admin:   http://localhost:${PORT}/admin  ║
  ║  Health:  http://localhost:${PORT}/api/health ║
  ║  Mode:    ${process.env.NODE_ENV}             ║
  ╚═══════════════════════════════════════╝
  `);
});

// Handle unexpected errors so the server doesn't crash silently
process.on('unhandledRejection', (err) => {
  console.error('💀 Unhandled Promise Rejection:', err.message);
  // In production, you might want to gracefully shut down and restart
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

module.exports = app;
