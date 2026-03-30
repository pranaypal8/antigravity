// ============================================================
// ADMIN USER MODEL
// ============================================================
// Defines the structure of admin accounts in the database.
// Roles:
//   superadmin — Founders (full access)
//   admin      — Order/product management, reports
//   vendor     — View assigned orders, update production status
//   support    — View orders, manage tickets, raise refunds
// ============================================================

const mongoose = require('mongoose');

const adminUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },

    // Password is ALWAYS stored as a bcrypt hash — never plain text
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Never return password in queries by default
    },

    role: {
      type: String,
      enum: ['superadmin', 'admin', 'vendor', 'support'],
      default: 'support',
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // Who created this account (audit trail)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },

    // Refresh token stored server-side for token rotation security
    refreshToken: {
      type: String,
      select: false,
    },

    lastLogin: {
      type: Date,
      default: null,
    },

    // Track failed login attempts for security
    loginAttempts: {
      type: Number,
      default: 0,
    },

    lockedUntil: {
      type: Date,
      default: null,
    },

    // Password reset
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpiry: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Indexes ───────────────────────────────────────────────────
// Note: email index is auto-created by unique:true above
adminUserSchema.index({ role: 1, isActive: 1 });

// ── Methods ───────────────────────────────────────────────────
// Check if account is locked due to too many failed logins
adminUserSchema.methods.isLocked = function () {
  return this.lockedUntil && this.lockedUntil > Date.now();
};

// Increment failed login attempts; lock after 10 failures
adminUserSchema.methods.recordFailedLogin = async function () {
  this.loginAttempts += 1;
  if (this.loginAttempts >= 10) {
    // Lock account for 30 minutes
    this.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
  }
  await this.save();
};

// Reset login tracking after successful login
adminUserSchema.methods.recordSuccessfulLogin = async function () {
  this.loginAttempts = 0;
  this.lockedUntil = null;
  this.lastLogin = new Date();
  await this.save();
};

module.exports = mongoose.model('AdminUser', adminUserSchema);
