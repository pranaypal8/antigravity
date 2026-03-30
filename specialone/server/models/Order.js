// ============================================================
// ORDER MODEL
// ============================================================
// The most important model. Every shirt order is stored here.
// Captures the full shirt configuration, payment details,
// shipping info, and the complete status lifecycle.
// ============================================================

const mongoose = require('mongoose');

// The exact shirt configuration chosen by the customer
const shirtConfigSchema = new mongoose.Schema({
  fabric: {
    id:      { type: String, required: true },
    name:    { type: String, required: true },
    color:   { type: String },
    texture: { type: String },
  },
  collar: {
    id:   { type: String, required: true },
    name: { type: String, required: true },
  },
  cuffs: {
    id:   { type: String, required: true },
    name: { type: String, required: true },
  },
  buttons: {
    id:    { type: String, required: true },
    name:  { type: String, required: true },
    color: { type: String },
  },
  // Monogram: max 3 characters, HTML stripped before saving
  monogram: {
    type: String,
    default: '',
    maxlength: [3, 'Monogram can only be 3 characters'],
  },
  // One of the 12 exact sizes
  size: {
    type: String,
    required: true,
    enum: ['S','S.5','M','M.5','L','L.5','XL','XL.5','XXL','XXL.5','XXXL','XXXL.5'],
  },
}, { _id: false });

const orderSchema = new mongoose.Schema(
  {
    // Human-readable order ID (SO-20240101-XXXX format)
    orderId: {
      type: String,
      unique: true,
      required: true,
    },

    // Reference to the customer who placed this order
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },

    // Snapshot of customer details at time of order (in case they update later)
    customerSnapshot: {
      name:    { type: String, required: true },
      email:   { type: String, required: true },
      phone:   { type: String, required: true },
      address: {
        line1:   String,
        line2:   String,
        city:    String,
        state:   String,
        pincode: String,
      },
    },

    // The shirt configuration chosen — can be an array for multi-shirt orders
    items: [
      {
        shirtConfig:  { type: shirtConfigSchema, required: true },
        price:        { type: Number, default: 3999 }, // ALWAYS 3999
        quantity:     { type: Number, default: 1 },
      }
    ],

    // ── Pricing (all in rupees) ───────────────────────────────
    subtotal:    { type: Number, required: true },  // Sum of items (qty × 3999)
    gstAmount:   { type: Number, required: true },  // 18% of subtotal
    discount:    { type: Number, default: 0   },    // Promo code discount
    promoCode:   { type: String, default: null },   // Which promo was used
    totalAmount: { type: Number, required: true },  // Final amount charged

    // ── Payment ──────────────────────────────────────────────
    razorpayOrderId:   { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },
    razorpaySignature: { type: String, default: null, select: false },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'],
      default: 'pending',
    },
    paidAt: { type: Date, default: null },

    // ── Refund ───────────────────────────────────────────────
    refund: {
      razorpayRefundId: { type: String, default: null },
      amount:           { type: Number, default: 0   },
      reason:           { type: String, default: null },
      requestedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
      approvedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
      processedAt:      { type: Date, default: null  },
    },

    // ── Order Status Lifecycle ────────────────────────────────
    // received → in_production → quality_check → packed → dispatched → delivered
    orderStatus: {
      type: String,
      enum: [
        'received',
        'in_production',
        'quality_check',
        'packed',
        'dispatched',
        'delivered',
        'cancelled',
        'returned',
      ],
      default: 'received',
    },

    // Full history of status changes (who changed it, when, and why)
    statusHistory: [
      {
        status:    { type: String },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
        note:      { type: String, default: '' },
        timestamp: { type: Date, default: Date.now },
      }
    ],

    // ── Shipping ──────────────────────────────────────────────
    shiprocketOrderId:  { type: String, default: null },
    shiprocketShipmentId: { type: String, default: null },
    awbNumber:          { type: String, default: null }, // Tracking number
    courierName:        { type: String, default: null },
    trackingUrl:        { type: String, default: null },
    estimatedDelivery:  { type: Date, default: null },
    deliveredAt:        { type: Date, default: null },

    // ── Internal ──────────────────────────────────────────────
    // Admin notes visible only in the admin panel
    internalNotes:      { type: String, default: '' },
    // Was this order created manually (phone/WhatsApp order)?
    isManualOrder:      { type: Boolean, default: false },
    // Assigned to a vendor for production
    assignedVendor:     { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Indexes (for fast queries in the admin panel) ─────────────
orderSchema.index({ orderId: 1 });
orderSchema.index({ customer: 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'customerSnapshot.email': 1 });
orderSchema.index({ razorpayPaymentId: 1 });
orderSchema.index({ awbNumber: 1 });

// ── Pre-save Hook ─────────────────────────────────────────────
// Auto-generate Order ID before saving (if not already set)
orderSchema.pre('validate', function (next) {
  if (!this.orderId) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.orderId = `SO-${dateStr}-${random}`;
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
