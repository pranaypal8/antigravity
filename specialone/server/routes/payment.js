// ============================================================
// PAYMENT ROUTES
// ============================================================
// POST /api/payment/create-order   — Create Razorpay order (customer)
// POST /api/payment/verify         — Verify payment signature + save order
// POST /api/payment/webhook        — Handle Razorpay webhooks
// GET  /api/payment/transactions   — List all transactions (admin)
// POST /api/payment/refund         — Initiate refund (admin)
// GET  /api/payment/stats          — Revenue stats (admin)
// ============================================================

const express = require('express');
const sanitizeHtml = require('sanitize-html');
const Order     = require('../models/Order');
const Customer  = require('../models/Customer');
const AuditLog  = require('../models/AuditLog');
const { createOrder: rzpCreateOrder, verifySignature, initiateRefund, verifyWebhookSignature } = require('../services/razorpay');
const { createOrder: srCreateOrder } = require('../services/shiprocket');
const { sendOrderConfirmation } = require('../services/mailer');
const { verifyToken, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  createOrderValidator,
  verifyPaymentValidator,
  refundValidator,
  transactionStatsValidator,
} = require('../validators/paymentValidator');

const router = express.Router();

// ── Fixed pricing constants (never changes) ───────────────────
const SHIRT_PRICE = 3999;
const GST_RATE    = 0.18;

// ── Valid promo codes ─────────────────────────────────────────
const PROMO_CODES = {
  'SPECIALONE10': { type: 'percent', value: 10 },
  'FIRST500':     { type: 'flat',    value: 500 },
  'NEWUSER':      { type: 'percent', value: 15  },
};

// ── POST /api/payment/create-order ───────────────────────────
// Step 1: Customer clicks Pay → we create a Razorpay order ID
router.post('/create-order', createOrderValidator, validate, async (req, res) => {
  try {
    const { items, promoCode, customerDetails } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items in order.' });
    }

    if (!customerDetails?.email || !customerDetails?.name || !customerDetails?.phone) {
      return res.status(400).json({ success: false, message: 'Customer details are incomplete.' });
    }

    // Validate phone number
    if (!/^\d{10}$/.test(customerDetails.phone)) {
      return res.status(400).json({ success: false, message: 'Phone number must be exactly 10 digits.' });
    }

    // Validate sizes
    const VALID_SIZES = ['S','S.5','M','M.5','L','L.5','XL','XL.5','XXL','XXL.5','XXXL','XXXL.5'];
    for (const item of items) {
      if (!VALID_SIZES.includes(item.shirtConfig?.size)) {
        return res.status(400).json({ success: false, message: `Invalid size: ${item.shirtConfig?.size}` });
      }
    }

    // ── Calculate price (always use server-side price — never trust frontend) ──
    const quantity  = items.length;
    const subtotal  = SHIRT_PRICE * quantity;          // e.g., 3999 × 2 = 7998

    // Apply promo code if provided
    let discount = 0;
    let appliedPromo = null;
    if (promoCode && PROMO_CODES[promoCode.toUpperCase()]) {
      const promo = PROMO_CODES[promoCode.toUpperCase()];
      appliedPromo = promoCode.toUpperCase();
      if (promo.type === 'percent') {
        discount = Math.round(subtotal * (promo.value / 100));
      } else {
        discount = Math.min(promo.value, subtotal); // Never discount more than subtotal
      }
    }

    const discountedSubtotal = subtotal - discount;
    const gstAmount  = Math.round(discountedSubtotal * GST_RATE * 100) / 100;
    const totalAmount = discountedSubtotal + gstAmount;                // Final amount

    // Create Razorpay order (in paise)
    const rzpOrder = await rzpCreateOrder(totalAmount, `SO-${Date.now()}`);

    // Send back only what the frontend needs — never send secrets
    res.json({
      success: true,
      razorpayOrderId: rzpOrder.id,
      amount: totalAmount,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID, // Public key — safe to send
      pricing: { subtotal, discount, gstAmount, totalAmount, promoCode: appliedPromo },
    });
  } catch (err) {
    console.error('create-order error:', err.message);
    res.status(500).json({ success: false, message: 'Could not initiate payment. Please try again.' });
  }
});

// ── POST /api/payment/verify ──────────────────────────────────
// Step 2: After customer pays, verify the payment and save the order
router.post('/verify', verifyPaymentValidator, validate, async (req, res) => {
  try {
    const {
      razorpayOrderId, razorpayPaymentId, razorpaySignature,
      items, customerDetails, pricing,
    } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ success: false, message: 'Payment verification data is missing.' });
    }

    // ⚠️ CRITICAL: Verify the payment signature before doing anything else
    const isValid = verifySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed. This payment may not be genuine. No order has been created.',
      });
    }

    // ── Find or create customer record ────────────────────────
    let customer = await Customer.findOne({ email: customerDetails.email.toLowerCase() });

    if (!customer) {
      customer = await Customer.create({
        name:  sanitizeHtml(customerDetails.name),
        email: customerDetails.email.toLowerCase().trim(),
        phone: customerDetails.phone,
        addresses: [{
          line1:   sanitizeHtml(customerDetails.address.line1),
          line2:   sanitizeHtml(customerDetails.address.line2 || ''),
          city:    sanitizeHtml(customerDetails.address.city),
          state:   sanitizeHtml(customerDetails.address.state),
          pincode: customerDetails.address.pincode,
        }],
      });
    }

    // ── Sanitize monogram field (max 3 chars, no HTML) ────────
    const sanitizedItems = items.map(item => ({
      ...item,
      shirtConfig: {
        ...item.shirtConfig,
        monogram: sanitizeHtml(item.shirtConfig.monogram || '', { allowedTags: [] }).slice(0, 3),
        price: SHIRT_PRICE, // Always override with server price
      },
    }));

    // ── Create Order ──────────────────────────────────────────
    const order = await Order.create({
      customer: customer._id,
      customerSnapshot: {
        name:    customer.name,
        email:   customer.email,
        phone:   customer.phone,
        address: customerDetails.address,
      },
      items: sanitizedItems.map(item => ({
        shirtConfig: item.shirtConfig,
        price: SHIRT_PRICE,
        quantity: 1,
      })),
      subtotal:          pricing.subtotal,
      gstAmount:         pricing.gstAmount,
      discount:          pricing.discount || 0,
      promoCode:         pricing.promoCode || null,
      totalAmount:       pricing.totalAmount,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      paymentStatus: 'paid',
      paidAt: new Date(),
      orderStatus: 'received',
      statusHistory: [{
        status: 'received',
        note: 'Payment verified and order placed.',
      }],
    });

    // ── Update customer stats ─────────────────────────────────
    await Customer.findByIdAndUpdate(customer._id, {
      $inc: { totalOrders: 1, totalSpent: pricing.totalAmount },
    });

    // ── Create Shiprocket shipment ────────────────────────────
    try {
      const shipment = await srCreateOrder(order);
      await Order.findByIdAndUpdate(order._id, {
        shiprocketOrderId:    shipment.shiprocketOrderId,
        shiprocketShipmentId: shipment.shiprocketShipmentId,
        awbNumber:            shipment.awbNumber,
        courierName:          shipment.courierName,
        trackingUrl:          shipment.trackingUrl,
      });
    } catch (shippingErr) {
      // Shipping failure is non-fatal — admin can create it manually
      console.error('❌ Shiprocket auto-create failed:', shippingErr.message);
      // Admin will see this order without AWB and can manually trigger Shiprocket
    }

    // ── Send confirmation email ───────────────────────────────
    await sendOrderConfirmation(customer, order);

    res.json({
      success: true,
      message: 'Payment verified and order placed successfully!',
      orderId: order.orderId,
      orderMongoId: order._id,
    });
  } catch (err) {
    console.error('Payment verify error:', err.message);
    res.status(500).json({ success: false, message: 'Order creation failed. Contact support with your payment ID.' });
  }
});

// ── POST /api/payment/webhook ─────────────────────────────────
// Razorpay sends events here for payment updates (failed, refunded, etc.)
// ⚠️ Register this URL in your Razorpay dashboard → Settings → Webhooks
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const isValid = verifyWebhookSignature(req.body, signature);

    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid webhook signature.' });
    }

    const event = JSON.parse(req.body.toString());
    console.log(`📡 Razorpay webhook: ${event.event}`);

    if (event.event === 'payment.failed') {
      const paymentId = event.payload.payment.entity.id;
      const orderId   = event.payload.payment.entity.order_id;
      await Order.findOneAndUpdate(
        { razorpayOrderId: orderId },
        { paymentStatus: 'failed' }
      );
      console.log(`❌ Payment failed recorded: ${paymentId}`);
    }

    if (event.event === 'refund.processed') {
      const refundId  = event.payload.refund.entity.id;
      const paymentId = event.payload.refund.entity.payment_id;
      await Order.findOneAndUpdate(
        { razorpayPaymentId: paymentId },
        { paymentStatus: 'refunded', 'refund.razorpayRefundId': refundId, 'refund.processedAt': new Date() }
      );
      console.log(`💰 Refund processed: ${refundId}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(500).json({ success: false });
  }
});

// ── GET /api/payment/transactions (admin) ─────────────────────
router.get('/transactions', verifyToken, requireRole(['admin', 'superadmin']), transactionStatsValidator, validate, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, startDate, endDate } = req.query;

    const filter = {};
    if (status) filter.paymentStatus = status;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate)   filter.createdAt.$lte = new Date(endDate + 'T23:59:59');
    }

    const [transactions, total] = await Promise.all([
      Order.find(filter)
        .select('orderId customerSnapshot totalAmount paymentStatus razorpayPaymentId paidAt promoCode discount gstAmount')
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .lean(),
      Order.countDocuments(filter),
    ]);

    res.json({ success: true, transactions, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not fetch transactions.' });
  }
});

// ── POST /api/payment/refund (admin) ─────────────────────────
router.post('/refund', verifyToken, requireRole(['admin', 'superadmin']), refundValidator, validate, async (req, res) => {
  try {
    const { orderId, amount, reason } = req.body;

    if (!orderId || !amount || !reason) {
      return res.status(400).json({ success: false, message: 'Order ID, amount, and reason are required.' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (order.paymentStatus !== 'paid') {
      return res.status(400).json({ success: false, message: `Cannot refund an order with status: ${order.paymentStatus}` });
    }

    if (amount > order.totalAmount) {
      return res.status(400).json({ success: false, message: 'Refund amount cannot exceed the order total.' });
    }

    const refund = await initiateRefund(order.razorpayPaymentId, amount, reason);

    const isFullRefund = amount >= order.totalAmount;
    await Order.findByIdAndUpdate(orderId, {
      paymentStatus: isFullRefund ? 'refunded' : 'partially_refunded',
      'refund.razorpayRefundId': refund.id,
      'refund.amount': amount,
      'refund.reason': reason,
      'refund.approvedBy': req.admin._id,
      'refund.processedAt': new Date(),
    });

    await AuditLog.log({
      adminUser: req.admin,
      action: `Initiated ₹${amount} refund for order ${order.orderId}`,
      entity: 'payment',
      entityId: order._id,
      req,
    });

    res.json({
      success: true,
      message: `Refund of ₹${amount} initiated. Razorpay Refund ID: ${refund.id}`,
      refundId: refund.id,
    });
  } catch (err) {
    console.error('Refund error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/payment/stats (admin) ────────────────────────────
router.get('/stats', verifyToken, requireRole(['admin', 'superadmin']), transactionStatsValidator, validate, async (req, res) => {
  try {
    const { period = 'month' } = req.query;

    const now   = new Date();
    let startDate;

    if (period === 'today') {
      startDate = new Date(now.toISOString().split('T')[0]);
    } else if (period === 'week') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const [stats] = await Order.aggregate([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalOrders:  { $sum: 1 },
          totalGST:     { $sum: '$gstAmount' },
          totalDiscount:{ $sum: '$discount' },
          avgOrderValue:{ $avg: '$totalAmount' },
        },
      },
    ]);

    // Daily breakdown for chart
    const daily = await Order.aggregate([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$totalAmount' },
          orders:  { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      period,
      stats: stats || { totalRevenue: 0, totalOrders: 0, totalGST: 0, totalDiscount: 0, avgOrderValue: 0 },
      daily,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not fetch payment stats.' });
  }
});

module.exports = router;
