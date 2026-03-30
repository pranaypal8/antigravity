// ============================================================
// SHIPPING ROUTES
// ============================================================

const express = require('express');
const Order    = require('../models/Order');
const AuditLog = require('../models/AuditLog');
const { createOrder, trackShipment, cancelOrder, getAllShipments } = require('../services/shiprocket');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// POST /api/shipping/create/:orderId — Create Shiprocket order manually
router.post('/create/:orderId', verifyToken, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (order.paymentStatus !== 'paid') return res.status(400).json({ success: false, message: 'Only paid orders can be shipped.' });
    if (order.shiprocketShipmentId) return res.status(400).json({ success: false, message: `Shipment already exists. AWB: ${order.awbNumber}` });

    const shipment = await createOrder(order);
    await Order.findByIdAndUpdate(order._id, {
      shiprocketOrderId:    shipment.shiprocketOrderId,
      shiprocketShipmentId: shipment.shiprocketShipmentId,
      awbNumber:   shipment.awbNumber,
      courierName: shipment.courierName,
      trackingUrl: shipment.trackingUrl,
    });

    await AuditLog.log({ adminUser: req.admin, action: `Created shipment for order ${order.orderId}`, entity: 'shipment', entityId: order._id, req });
    res.json({ success: true, message: 'Shipment created.', awbNumber: shipment.awbNumber, courierName: shipment.courierName });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/shipping/track/:awb
router.get('/track/:awb', verifyToken, requireRole(['admin', 'superadmin', 'support']), async (req, res) => {
  try {
    const tracking = await trackShipment(req.params.awb);
    res.json({ success: true, tracking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/shipping/all
router.get('/all', verifyToken, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const shipments = await getAllShipments(Number(page), 20);
    res.json({ success: true, shipments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/shipping/cancel/:orderId
router.post('/cancel/:orderId', verifyToken, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (!order.shiprocketOrderId) return res.status(400).json({ success: false, message: 'No shipment exists for this order.' });
    if (['dispatched', 'delivered'].includes(order.orderStatus)) return res.status(400).json({ success: false, message: 'Cannot cancel dispatched/delivered orders.' });

    await cancelOrder([order.shiprocketOrderId]);
    await Order.findByIdAndUpdate(order._id, { orderStatus: 'cancelled' });
    await AuditLog.log({ adminUser: req.admin, action: `Cancelled shipment for order ${order.orderId}`, entity: 'shipment', entityId: order._id, req });
    res.json({ success: true, message: 'Shipment cancelled.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
