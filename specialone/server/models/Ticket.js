// ============================================================
// TICKET (SUPPORT) MODEL
// ============================================================
// Customer support ticket system.
// Customers raise issues → Support team responds → Admin approves refunds.
// Tickets link to orders when relevant.
// ============================================================

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  // Who sent this message?
  senderType: {
    type: String,
    enum: ['customer', 'support', 'system'],
    required: true,
  },
  senderId:   { type: mongoose.Schema.Types.ObjectId }, // AdminUser or Customer _id
  senderName: { type: String, required: true },
  message:    { type: String, required: true, trim: true },
  // Attachments (image URLs)
  attachments: [{ type: String }],
  timestamp:   { type: Date, default: Date.now },
  isInternal:  { type: Boolean, default: false }, // Internal notes not visible to customer
}, { _id: false });

const ticketSchema = new mongoose.Schema(
  {
    // Human-readable ticket ID (SO-TKT-XXXXXX format)
    ticketId: {
      type: String,
      unique: true,
      required: true,
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },

    // Snapshot so we don't need to join in most queries
    customerSnapshot: {
      name:  { type: String },
      email: { type: String },
      phone: { type: String },
    },

    // If this ticket is about a specific order
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },

    subject: {
      type: String,
      required: [true, 'Ticket subject is required'],
      trim: true,
      maxlength: [200, 'Subject cannot exceed 200 characters'],
    },

    // Full conversation thread
    messages: [messageSchema],

    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved', 'closed'],
      default: 'open',
    },

    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },

    // Which support agent is handling this ticket
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },

    // Timestamps for SLA tracking
    firstResponseAt: { type: Date, default: null },
    resolvedAt:      { type: Date, default: null },
    closedAt:        { type: Date, default: null },

    // ── Refund Request Workflow ───────────────────────────────
    // Support raises → Admin approves → Razorpay executes
    refundRequest: {
      amount:          { type: Number, default: 0 },
      reason:          { type: String, default: '' },
      status: {
        type: String,
        enum: ['none', 'pending', 'approved', 'rejected', 'processed'],
        default: 'none',
      },
      requestedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
      approvedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
      razorpayRefundId: { type: String, default: null },
      processedAt:  { type: Date, default: null },
    },

    // Tags for categorization (e.g., "sizing", "payment", "delivery")
    tags: [{ type: String, trim: true }],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Pre-save: auto-generate ticket ID ────────────────────────
ticketSchema.pre('validate', function (next) {
  if (!this.ticketId) {
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.ticketId = `SO-TKT-${random}`;
  }
  next();
});

ticketSchema.index({ customer: 1 });
ticketSchema.index({ status: 1, priority: 1 });
ticketSchema.index({ assignedTo: 1 });
ticketSchema.index({ createdAt: -1 });
ticketSchema.index({ orderId: 1 });

module.exports = mongoose.model('Ticket', ticketSchema);
