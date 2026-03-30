// ============================================================
// AUDIT LOG MODEL
// ============================================================
// Records every action taken in the admin panel.
// This creates a tamper-proof trail of who did what and when.
// Super Admins can view and filter this log.
// ============================================================

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    // Who performed the action
    adminUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      required: true,
    },
    adminName:  { type: String }, // Snapshot so log stays readable even if user is deleted
    adminEmail: { type: String },
    adminRole:  { type: String },

    // What they did (past tense, human-readable)
    // Examples: "Updated order status", "Initiated refund", "Created fabric"
    action: {
      type: String,
      required: true,
      trim: true,
    },

    // What kind of object was affected
    entity: {
      type: String,
      enum: ['order', 'customer', 'product', 'fabric', 'ticket', 'admin_user', 'payment', 'setting', 'shipment'],
      required: true,
    },

    // The database ID of the affected object
    entityId: {
      type: String,
      default: null,
    },

    // What specifically changed (before/after snapshot)
    changes: {
      before: { type: mongoose.Schema.Types.Mixed, default: null },
      after:  { type: mongoose.Schema.Types.Mixed, default: null },
    },

    // IP address of the admin at time of action
    ip: {
      type: String,
      default: null,
    },

    // User agent (browser info)
    userAgent: {
      type: String,
      default: null,
    },

    // Was this action successful?
    success: {
      type: Boolean,
      default: true,
    },

    // Error message if action failed
    errorMessage: {
      type: String,
      default: null,
    },
  },
  {
    // We only store createdAt (audit logs are never updated)
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// ── Indexes ──────────────────────────────────────────────────
auditLogSchema.index({ adminUser: 1, createdAt: -1 });
auditLogSchema.index({ entity: 1, entityId: 1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 'text' }); // Full-text search on actions

// ── Helper function: used across all admin routes ─────────────
auditLogSchema.statics.log = async function ({
  adminUser,
  action,
  entity,
  entityId = null,
  changes = {},
  req = null,
}) {
  try {
    await this.create({
      adminUser:  adminUser._id,
      adminName:  adminUser.name,
      adminEmail: adminUser.email,
      adminRole:  adminUser.role,
      action,
      entity,
      entityId:   entityId ? entityId.toString() : null,
      changes,
      ip:         req ? (req.headers['x-forwarded-for'] || req.ip) : null,
      userAgent:  req ? req.headers['user-agent'] : null,
    });
  } catch (err) {
    // If audit logging fails, don't crash the main operation — just warn
    console.warn('⚠️  Audit log write failed:', err.message);
  }
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
