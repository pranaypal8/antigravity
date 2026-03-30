// ============================================================
// CUSTOMER MODEL
// ============================================================
// Stores information about customers who place orders.
// Created automatically when a customer completes checkout.
// ============================================================

const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  line1: { type: String, required: true, trim: true },
  line2: { type: String, trim: true, default: '' },
  city:  { type: String, required: true, trim: true },
  state: { type: String, required: true, trim: true },
  pincode: {
    type: String,
    required: true,
    match: [/^\d{6}$/, 'Pincode must be exactly 6 digits'],
  },
}, { _id: false });

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },

    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      match: [/^\d{10}$/, 'Phone must be exactly 10 digits'],
    },

    // A customer can have multiple saved addresses
    addresses: [addressSchema],

    // Aggregated stats — updated after each order
    totalOrders: {
      type: Number,
      default: 0,
    },

    totalSpent: {
      type: Number,   // In rupees (e.g., 9437.64 for two shirts with GST)
      default: 0,
    },

    // Support team can blacklist a customer to block future orders
    isBlacklisted: {
      type: Boolean,
      default: false,
    },

    blacklistReason: {
      type: String,
      default: null,
    },

    // Notes internal to the support team
    internalNotes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Indexes ───────────────────────────────────────────────────
customerSchema.index({ email: 1 });
customerSchema.index({ phone: 1 });
customerSchema.index({ createdAt: -1 });
customerSchema.index({ totalSpent: -1 }); // For "top customers" reports

module.exports = mongoose.model('Customer', customerSchema);
