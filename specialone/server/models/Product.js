// ============================================================
// PRODUCT MODEL
// ============================================================
// Stores the shirt product definitions — the options available
// for fabric, collar, cuffs, and buttons that appear in the
// customizer. Price is ALWAYS locked at ₹3,999.
// ============================================================

const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema({
  id:          { type: String, required: true }, // short slug, e.g. "spread-collar"
  name:        { type: String, required: true }, // display name
  description: { type: String, default: '' },
  imageUrl:    { type: String, default: '' },    // preview image
  svgLayer:    { type: String, default: '' },    // SVG layer key for the customizer
  isActive:    { type: Boolean, default: true },
}, { _id: false });

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: '',
    },

    // The 4 customizable aspects of the shirt
    fabricOptions: [optionSchema],
    collarOptions: [optionSchema],
    cuffOptions:   [optionSchema],
    buttonOptions: [optionSchema],

    // Product photos (URLs to uploaded images)
    images: [{ type: String }],

    // Whether this product appears in the customizer
    isActive: {
      type: Boolean,
      default: true,
    },

    // ⚠️ PRICE IS ALWAYS 3999 — NEVER EDITABLE
    // This is enforced here AND in the frontend AND in the payment route
    price: {
      type: Number,
      default: 3999,
      immutable: true, // Mongoose will reject any attempt to change this
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

// ── Pre-save: enforce fixed price ─────────────────────────────
// Double-check that nobody can sneak in a different price
productSchema.pre('save', function (next) {
  if (this.price !== 3999) {
    this.price = 3999; // Silent correct — price is non-negotiable
  }
  next();
});

productSchema.index({ isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('Product', productSchema);
