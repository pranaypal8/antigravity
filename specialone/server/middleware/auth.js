// ============================================================
// AUTHENTICATION & AUTHORIZATION MIDDLEWARE
// ============================================================
// verifyToken   — Checks that the request has a valid login token.
//                 Returns 401 if token is missing or expired.
// requireRole   — Checks that the logged-in admin has the right role.
//                 Returns 403 if they try to access something above their level.
// ============================================================

const jwt = require('jsonwebtoken');
const AdminUser = require('../models/AdminUser');

// ── Role Hierarchy ────────────────────────────────────────────
// Defines which roles are "above" each other.
// If you require 'admin', then 'superadmin' is also allowed.
const ROLE_HIERARCHY = {
  superadmin: 4,
  admin:      3,
  support:    2,
  vendor:     1,
};

// ── verifyToken ───────────────────────────────────────────────
// Use this on every admin route that needs authentication.
// It reads the JWT from the httpOnly cookie (NOT from localStorage — that's insecure).
const verifyToken = async (req, res, next) => {
  try {
    // Get the token from the httpOnly cookie
    const token = req.cookies?.adminToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'You must be logged in to access this. Please log in to the admin panel.',
      });
    }

    // Verify the token's signature and check it hasn't expired
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtErr) {
      // Token is invalid or expired
      const message = jwtErr.name === 'TokenExpiredError'
        ? 'Your session has expired. Please log in again.'
        : 'Invalid login token. Please log in again.';

      return res.status(401).json({ success: false, message });
    }

    // Find the admin user in the database
    // (We re-fetch to ensure the account is still active — it might have been disabled since token was issued)
    const adminUser = await AdminUser.findById(decoded.id).select('-password -refreshToken');

    if (!adminUser) {
      return res.status(401).json({
        success: false,
        message: 'Admin account not found. Please log in again.',
      });
    }

    if (!adminUser.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated. Contact a Super Admin.',
      });
    }

    // Attach admin user to the request so downstream handlers can use it
    req.admin = adminUser;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Authentication error. Please try again.',
    });
  }
};

// ── requireRole ───────────────────────────────────────────────
// Factory function — call with an array of allowed roles.
// Example: router.get('/refunds', verifyToken, requireRole(['admin', 'superadmin']), ...)
//
// IMPORTANT: Use verifyToken BEFORE requireRole.
// requireRole by itself doesn't check if the token is valid.
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated. Please call verifyToken before requireRole.',
      });
    }

    const userRoleLevel = ROLE_HIERARCHY[req.admin.role] || 0;

    // Check if the user's role level meets ANY of the required roles
    const hasPermission = allowedRoles.some((role) => {
      const requiredLevel = ROLE_HIERARCHY[role] || 0;
      return userRoleLevel >= requiredLevel;
    });

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: `Access denied. This feature requires one of these roles: ${allowedRoles.join(', ')}. Your role: ${req.admin.role}.`,
      });
    }

    next();
  };
};

// ── requireSuperAdmin ─────────────────────────────────────────
// Shorthand for requireRole(['superadmin']) — used on the most sensitive routes
const requireSuperAdmin = requireRole(['superadmin']);

// ── optionalAuth ──────────────────────────────────────────────
// For routes that work both authenticated and unauthenticated.
// If a valid token exists, sets req.admin. Otherwise, continues without.
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.cookies?.adminToken;
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const adminUser = await AdminUser.findById(decoded.id).select('-password -refreshToken');

    if (adminUser && adminUser.isActive) {
      req.admin = adminUser;
    }
    next();
  } catch {
    // If token is invalid, just continue without setting req.admin
    next();
  }
};

module.exports = { verifyToken, requireRole, requireSuperAdmin, optionalAuth };
