// ============================================================
// AUTH ROUTES — Admin Login/Logout/Token Refresh
// ============================================================
// POST /api/auth/login          — Log in as admin
// POST /api/auth/logout         — Log out (clears cookie)
// POST /api/auth/refresh        — Refresh access token
// GET  /api/auth/me             — Get current admin profile
// POST /api/auth/create-admin   — Create new admin user (superadmin only)
// PATCH /api/auth/update-password — Change password
// GET  /api/auth/admins         — List all admin users (superadmin only)
// PATCH /api/auth/admins/:id    — Update admin user (superadmin only)
// DELETE /api/auth/admins/:id   — Delete admin user (superadmin only)
// ============================================================

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sanitizeHtml = require('sanitize-html');
const AdminUser = require('../models/AdminUser');
const AuditLog = require('../models/AuditLog');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// ── Helper: generate JWT tokens ──────────────────────────────
const generateTokens = (adminId) => {
  const accessToken = jwt.sign(
    { id: adminId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY || '7d' }
  );

  const refreshToken = jwt.sign(
    { id: adminId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || '30d' }
  );

  return { accessToken, refreshToken };
};

// ── Helper: set httpOnly cookie ───────────────────────────────
const setAuthCookie = (res, token) => {
  res.cookie('adminToken', token, {
    httpOnly: true,         // JavaScript CANNOT read this cookie — secure
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'strict',     // No cross-site cookie sending
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    path: '/',
  });
};

// ── POST /api/auth/login ──────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const email    = sanitizeHtml(req.body.email || '').toLowerCase().trim();
    const password = req.body.password || '';

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    // Find the admin (include password field — it's excluded by default)
    const admin = await AdminUser.findOne({ email }).select('+password');

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'No admin account found with that email address.',
      });
    }

    // Check if account is locked
    if (admin.isLocked()) {
      const unlockTime = new Date(admin.lockedUntil).toLocaleTimeString('en-IN');
      return res.status(423).json({
        success: false,
        message: `Account is temporarily locked due to too many failed attempts. Try again after ${unlockTime}.`,
      });
    }

    if (!admin.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated. Contact a Super Admin.',
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      await admin.recordFailedLogin();
      const remaining = 10 - admin.loginAttempts;
      return res.status(401).json({
        success: false,
        message: remaining > 0
          ? `Incorrect password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Account locked due to too many failed attempts.',
      });
    }

    // Successful login
    const { accessToken, refreshToken } = generateTokens(admin._id);

    // Save refresh token to DB (so we can invalidate it on logout)
    admin.refreshToken = refreshToken;
    await admin.recordSuccessfulLogin(); // Also saves the doc

    setAuthCookie(res, accessToken);
    // Also set refresh token as a separate long-lived cookie
    res.cookie('adminRefreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/api/auth/refresh', // Only sent to the refresh endpoint
    });

    await AuditLog.log({
      adminUser: admin,
      action: 'Admin logged in',
      entity: 'admin_user',
      entityId: admin._id,
      req,
    });

    res.json({
      success: true,
      message: `Welcome back, ${admin.name}!`,
      admin: {
        id:    admin._id,
        name:  admin.name,
        email: admin.email,
        role:  admin.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────
router.post('/logout', verifyToken, async (req, res) => {
  try {
    // Clear the refresh token from DB
    await AdminUser.findByIdAndUpdate(req.admin._id, { refreshToken: null });

    // Clear both cookies
    res.clearCookie('adminToken',        { path: '/' });
    res.clearCookie('adminRefreshToken', { path: '/api/auth/refresh' });

    await AuditLog.log({
      adminUser: req.admin,
      action: 'Admin logged out',
      entity: 'admin_user',
      entityId: req.admin._id,
      req,
    });

    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Logout failed.' });
  }
});

// ── POST /api/auth/refresh ────────────────────────────────────
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.adminRefreshToken;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'No refresh token. Please log in again.' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const admin = await AdminUser.findById(decoded.id).select('+refreshToken');

    if (!admin || admin.refreshToken !== refreshToken) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token. Please log in again.' });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(admin._id);
    admin.refreshToken = newRefreshToken;
    await admin.save();

    setAuthCookie(res, accessToken);

    res.json({ success: true, message: 'Token refreshed.' });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Refresh failed. Please log in again.' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────
router.get('/me', verifyToken, (req, res) => {
  res.json({
    success: true,
    admin: {
      id:        req.admin._id,
      name:      req.admin.name,
      email:     req.admin.email,
      role:      req.admin.role,
      lastLogin: req.admin.lastLogin,
    },
  });
});

// ── POST /api/auth/create-admin ───────────────────────────────
router.post('/create-admin', verifyToken, requireRole(['superadmin']), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Name, email, password and role are required.' });
    }

    const validRoles = ['admin', 'vendor', 'support', 'superadmin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: `Invalid role. Choose from: ${validRoles.join(', ')}` });
    }

    const existing = await AdminUser.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An admin account with that email already exists.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const newAdmin = await AdminUser.create({
      name: sanitizeHtml(name),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role,
      createdBy: req.admin._id,
    });

    await AuditLog.log({
      adminUser: req.admin,
      action: `Created admin user: ${newAdmin.email} (${newAdmin.role})`,
      entity: 'admin_user',
      entityId: newAdmin._id,
      req,
    });

    res.status(201).json({
      success: true,
      message: `Admin account created for ${newAdmin.email}`,
      admin: { id: newAdmin._id, name: newAdmin.name, email: newAdmin.email, role: newAdmin.role },
    });
  } catch (err) {
    console.error('Create admin error:', err.message);
    res.status(500).json({ success: false, message: 'Could not create admin account.' });
  }
});

// ── PATCH /api/auth/update-password ──────────────────────────
router.patch('/update-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters.' });
    }

    const admin = await AdminUser.findById(req.admin._id).select('+password');
    const isMatch = await bcrypt.compare(currentPassword, admin.password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    admin.password = await bcrypt.hash(newPassword, 12);
    await admin.save();

    await AuditLog.log({
      adminUser: req.admin,
      action: 'Changed own password',
      entity: 'admin_user',
      entityId: req.admin._id,
      req,
    });

    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Password update failed.' });
  }
});

// ── GET /api/auth/admins ──────────────────────────────────────
router.get('/admins', verifyToken, requireRole(['superadmin']), async (req, res) => {
  try {
    const admins = await AdminUser.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, count: admins.length, admins });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not fetch admin list.' });
  }
});

// ── PATCH /api/auth/admins/:id ────────────────────────────────
router.patch('/admins/:id', verifyToken, requireRole(['superadmin']), async (req, res) => {
  try {
    const { isActive, role, name } = req.body;

    // Prevent superadmin from deactivating themselves
    if (req.params.id === req.admin._id.toString() && isActive === false) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own account.' });
    }

    const before = await AdminUser.findById(req.params.id).lean();
    const updated = await AdminUser.findByIdAndUpdate(
      req.params.id,
      { ...(name && { name }), ...(role && { role }), ...(isActive !== undefined && { isActive }) },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Admin user not found.' });
    }

    await AuditLog.log({
      adminUser: req.admin,
      action: `Updated admin user: ${updated.email}`,
      entity: 'admin_user',
      entityId: updated._id,
      changes: { before, after: updated.toObject() },
      req,
    });

    res.json({ success: true, message: 'Admin user updated.', admin: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not update admin user.' });
  }
});

// ── DELETE /api/auth/admins/:id ───────────────────────────────
router.delete('/admins/:id', verifyToken, requireRole(['superadmin']), async (req, res) => {
  try {
    if (req.params.id === req.admin._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
    }

    const deleted = await AdminUser.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Admin user not found.' });
    }

    await AuditLog.log({
      adminUser: req.admin,
      action: `Deleted admin user: ${deleted.email}`,
      entity: 'admin_user',
      entityId: deleted._id,
      req,
    });

    res.json({ success: true, message: `Admin account for ${deleted.email} has been deleted.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not delete admin user.' });
  }
});

module.exports = router;
