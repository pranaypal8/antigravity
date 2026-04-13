// ============================================================
// ORDER ROUTES
// ============================================================
// GET    /api/orders                — List all orders (admin)
// GET    /api/orders/:id            — Get order detail (admin)
// PATCH  /api/orders/:id/status     — Update order status (admin/vendor)
// POST   /api/orders/manual         — Create manual order (admin)
// GET    /api/orders/export         — Export orders as CSV (admin)
// GET    /api/orders/track/:orderId — Customer tracking by order ID
// ============================================================

const express = require('express');
const sanitizeHtml = require('sanitize-html');
const Order    = require('../models/Order');
const Customer = require('../models/Customer');
const AuditLog = require('../models/AuditLog');
const { verifyToken, requireRole } = require('../middleware/auth');
const { sendShipmentDispatched }   = require('../services/mailer');
const { validate } = require('../middleware/validate');
const {
  getOrdersValidator,
  manualOrderValidator,
  updateOrderStatusValidator,
  paramIdValidator,
  trackOrderValidator,
} = require('../validators/orderValidator');

const router = express.Router();

// ── GET /api/orders ───────────────────────────────────────────
router.get('/', verifyToken, requireRole(['admin', 'superadmin', 'support', 'vendor']), getOrdersValidator, validate, async (req, res) => {
  try {
    const {
      page = 1, limit = 20,
      status, paymentStatus,
      startDate, endDate,
      search,
    } = req.query;

    const filter = {};

    // Vendors can ONLY see their assigned orders
    if (req.admin.role === 'vendor') {
      filter.assignedVendor = req.admin._id;
    }

    if (status)        filter.orderStatus = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate)   filter.createdAt.$lte = new Date(endDate + 'T23:59:59');
    }

    if (search) {
      filter.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { 'customerSnapshot.name': { $regex: search, $options: 'i' } },
        { 'customerSnapshot.email': { $regex: search, $options: 'i' } },
        { 'customerSnapshot.phone': { $regex: search, $options: 'i' } },
        { razorpayPaymentId: { $regex: search, $options: 'i' } },
        { awbNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .select('-razorpaySignature -statusHistory -refund')
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .lean(),
      Order.countDocuments(filter),
    ]);

    res.json({
      success: true,
      orders,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    console.error('Get orders error:', err.message);
    res.status(500).json({ success: false, message: 'Could not fetch orders.' });
  }
});

// ── GET /api/orders/export ────────────────────────────────────
router.get('/export', verifyToken, requireRole(['admin', 'superadmin']), getOrdersValidator, validate, async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;

    const filter = {};
    if (status)    filter.orderStatus = status;
    if (startDate) filter.createdAt = { $gte: new Date(startDate) };
    if (endDate)   filter.createdAt = { ...filter.createdAt, $lte: new Date(endDate + 'T23:59:59') };

    const orders = await Order.find(filter).sort({ createdAt: -1 }).lean();

    // Build CSV
    const headers = [
      'Order ID', 'Date', 'Customer Name', 'Email', 'Phone',
      'Fabric', 'Collar', 'Cuffs', 'Buttons', 'Monogram', 'Size',
      'Subtotal', 'Discount', 'GST', 'Total',
      'Payment Status', 'Order Status', 'AWB Number', 'Courier',
    ];

    const rows = orders.map(o => [
      o.orderId,
      new Date(o.createdAt).toLocaleDateString('en-IN'),
      o.customerSnapshot?.name,
      o.customerSnapshot?.email,
      o.customerSnapshot?.phone,
      o.items?.[0]?.shirtConfig?.fabric?.name || '',
      o.items?.[0]?.shirtConfig?.collar?.name || '',
      o.items?.[0]?.shirtConfig?.cuffs?.name  || '',
      o.items?.[0]?.shirtConfig?.buttons?.name || '',
      o.items?.[0]?.shirtConfig?.monogram || '',
      o.items?.[0]?.shirtConfig?.size || '',
      o.subtotal,
      o.discount,
      o.gstAmount,
      o.totalAmount,
      o.paymentStatus,
      o.orderStatus,
      o.awbNumber || '',
      o.courierName || '',
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="specialone-orders-${Date.now()}.csv"`);
    res.send(csv);

    await AuditLog.log({ adminUser: req.admin, action: 'Exported orders to CSV', entity: 'order', req });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Export failed.' });
  }
});

// ── GET /api/orders/track/:orderId ────────────────────────────
// Customer-facing: look up own order by order ID (public, no auth)
router.get('/track/:orderId', trackOrderValidator, validate, async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId })
      .select('orderId orderStatus awbNumber courierName trackingUrl createdAt estimatedDelivery items customerSnapshot.name')
      .lean();

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found. Check your Order ID.' });
    }

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not fetch order.' });
  }
});

// ── GET /api/orders/:id ───────────────────────────────────────
router.get('/:id', verifyToken, requireRole(['admin', 'superadmin', 'support', 'vendor']), paramIdValidator, validate, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'name email phone totalOrders totalSpent isBlacklisted')
      .populate('statusHistory.changedBy', 'name role')
      .populate('assignedVendor', 'name email')
      .lean();

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // Vendors can only see their assigned orders
    if (req.admin.role === 'vendor' && String(order.assignedVendor?._id) !== String(req.admin._id)) {
      return res.status(403).json({ success: false, message: 'You do not have access to this order.' });
    }

    // Support and vendors don't see payment signature
    if (['support', 'vendor'].includes(req.admin.role)) {
      delete order.razorpaySignature;
    }
    // Vendors don't see financial details
    if (req.admin.role === 'vendor') {
      delete order.totalAmount;
      delete order.subtotal;
      delete order.gstAmount;
      delete order.razorpayPaymentId;
    }

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not fetch order.' });
  }
});

// ── PATCH /api/orders/:id/status ──────────────────────────────
router.patch('/:id/status', verifyToken, requireRole(['admin', 'superadmin', 'vendor', 'support']), updateOrderStatusValidator, validate, async (req, res) => {
  try {
    const { status, note } = req.body;

    const VALID_STATUSES = ['received','in_production','quality_check','packed','dispatched','delivered','cancelled','returned'];
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Valid options: ${VALID_STATUSES.join(', ')}` });
    }

    // Vendors can only set production-related statuses
    if (req.admin.role === 'vendor') {
      const vendorAllowed = ['in_production', 'quality_check'];
      if (!vendorAllowed.includes(status)) {
        return res.status(403).json({ success: false, message: `Vendors can only set status to: ${vendorAllowed.join(', ')}` });
      }
    }

    const before = await Order.findById(req.params.id).lean();
    if (!before) return res.status(404).json({ success: false, message: 'Order not found.' });

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        orderStatus: status,
        $push: {
          statusHistory: {
            status,
            changedBy: req.admin._id,
            note: sanitizeHtml(note || ''),
            timestamp: new Date(),
          },
        },
        // Set delivery date if delivered
        ...(status === 'delivered' && { deliveredAt: new Date() }),
      },
      { new: true }
    );

    // Send dispatch email if status changed to dispatched
    if (status === 'dispatched' && before.orderStatus !== 'dispatched') {
      const customer = await Customer.findById(order.customer);
      if (customer) await sendShipmentDispatched(customer, order);
    }

    await AuditLog.log({
      adminUser: req.admin,
      action: `Updated order status to "${status}"`,
      entity: 'order',
      entityId: order._id,
      changes: { before: { orderStatus: before.orderStatus }, after: { orderStatus: status } },
      req,
    });

    res.json({ success: true, message: `Order status updated to: ${status}`, order });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not update order status.' });
  }
});

// ── POST /api/orders/manual ───────────────────────────────────
// Create a manual order (for phone/WhatsApp orders)
router.post('/manual', verifyToken, requireRole(['admin', 'superadmin']), manualOrderValidator, validate, async (req, res) => {
  try {
    const { customerDetails, items, paymentNote } = req.body;

    // Find or create customer
    let customer = await Customer.findOne({ email: customerDetails.email.toLowerCase() });
    if (!customer) {
      customer = await Customer.create({
        name:  sanitizeHtml(customerDetails.name),
        email: customerDetails.email.toLowerCase().trim(),
        phone: customerDetails.phone,
        addresses: [customerDetails.address],
      });
    }

    const SHIRT_PRICE = 3999;
    const GST_RATE    = 0.18;
    const subtotal    = SHIRT_PRICE * items.length;
    const gstAmount   = Math.round(subtotal * GST_RATE * 100) / 100;
    const totalAmount = subtotal + gstAmount;

    const order = await Order.create({
      customer: customer._id,
      customerSnapshot: {
        name:    customer.name,
        email:   customer.email,
        phone:   customer.phone,
        address: customerDetails.address,
      },
      items: items.map(item => ({
        shirtConfig: { ...item.shirtConfig, monogram: (item.shirtConfig.monogram || '').slice(0, 3) },
        price: SHIRT_PRICE,
        quantity: 1,
      })),
      subtotal,
      gstAmount,
      totalAmount,
      paymentStatus: 'paid', // Manual orders are assumed paid
      orderStatus: 'received',
      isManualOrder: true,
      internalNotes: sanitizeHtml(paymentNote || 'Manual order created by admin.'),
      statusHistory: [{ status: 'received', changedBy: req.admin._id, note: 'Manual order created.' }],
    });

    await Customer.findByIdAndUpdate(customer._id, { $inc: { totalOrders: 1, totalSpent: totalAmount } });

    await AuditLog.log({
      adminUser: req.admin,
      action: `Created manual order: ${order.orderId}`,
      entity: 'order',
      entityId: order._id,
      req,
    });

    res.status(201).json({ success: true, message: 'Manual order created successfully.', orderId: order.orderId });
  } catch (err) {
    console.error('Manual order error:', err.message);
    res.status(500).json({ success: false, message: 'Could not create manual order.' });
  }
});

module.exports = router;
