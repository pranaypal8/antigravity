// ============================================================
// FABRIC MODEL
// ============================================================
// Tracks fabric inventory. Each fabric is measured in meters.
// Admin gets alerts when stock falls below the threshold.
// ============================================================

const mongoose = require('mongoose');

const stockHistoryEntrySchema = new mongoose.Schema({
  action:      { type: String, enum: ['add', 'remove', 'adjust'], required: true },
  quantity:    { type: Number, required: true },      // meters added/removed
  newTotal:    { type: Number, required: true },      // total after change
  note:        { type: String, default: '' },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
  timestamp:   { type: Date, default: Date.now },
}, { _id: false });

const fabricSchema = new mongoose.Schema(
  {
    // e.g., "Oxford Blue", "Ivory Linen", "Charcoal Herringbone"
    name: {
      type: String,
      required: [true, 'Fabric name is required'],
      trim: true,
      unique: true,
    },

    // Hex color for the swatch display in the customizer
    color: {
      type: String,
      required: [true, 'Fabric color is required'],
      match: [/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex code (e.g. #C9A84C)'],
    },

    // Description shown to customer in the customizer
    description: {
      type: String,
      default: '',
    },

    // Tags like "breathable", "formal", "casual"
    tags: [{ type: String, trim: true }],

    // Preview image URL (texture image shown in customizer)
    imageUrl: {
      type: String,
      default: '',
    },

    // ── Stock Management ──────────────────────────────────────
    // How many meters we have available
    stockMeters: {
      type: Number,
      required: true,
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },

    // Status is auto-calculated based on stock level
    stockStatus: {
      type: String,
      enum: ['in_stock', 'low_stock', 'out_of_stock'],
      default: 'out_of_stock',
    },

    // Send a low-stock alert email when stock drops below this number
    lowStockThreshold: {
      type: Number,
      default: 10, // 10 meters = roughly 3–4 shirts
    },

    // Full history of every stock change for audit purposes
    stockHistory: [stockHistoryEntrySchema],

    // Whether this fabric appears in the customizer
    isActive: {
      type: Boolean,
      default: true,
    },

    // Display order in the customizer
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Pre-save: auto-update stock status ───────────────────────
// Keeps status in sync with actual stock levels automatically
fabricSchema.pre('save', function (next) {
  if (this.stockMeters <= 0) {
    this.stockStatus = 'out_of_stock';
  } else if (this.stockMeters <= this.lowStockThreshold) {
    this.stockStatus = 'low_stock';
  } else {
    this.stockStatus = 'in_stock';
  }
  next();
});

fabricSchema.index({ isActive: 1, stockStatus: 1 });
fabricSchema.index({ name: 1 });

module.exports = mongoose.model('Fabric', fabricSchema);
