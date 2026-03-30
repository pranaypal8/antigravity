// ============================================================
// ANALYTICS ROUTES
// ============================================================

const express = require('express');
const Order    = require('../models/Order');
const Customer = require('../models/Customer');
const Ticket   = require('../models/Ticket');
const Fabric   = require('../models/Fabric');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/analytics/dashboard — Live dashboard stats
router.get('/dashboard', verifyToken, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const today = new Date(new Date().toISOString().split('T')[0]);

    const [
      todayOrders, todayRevenue,
      totalOrders, totalRevenue,
      newCustomersToday, totalCustomers,
      pendingTickets,
      ordersByStatus,
    ] = await Promise.all([
      Order.countDocuments({ createdAt: { $gte: today }, paymentStatus: 'paid' }),
      Order.aggregate([
        { $match: { createdAt: { $gte: today }, paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Order.countDocuments({ paymentStatus: 'paid' }),
      Order.aggregate([
        { $match: { paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Customer.countDocuments({ createdAt: { $gte: today } }),
      Customer.countDocuments(),
      Ticket.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
      Order.aggregate([
        { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
      ]),
    ]);

    res.json({
      success: true,
      stats: {
        todayOrders,
        todayRevenue: todayRevenue[0]?.total || 0,
        totalOrders,
        totalRevenue: totalRevenue[0]?.total || 0,
        newCustomersToday,
        totalCustomers,
        pendingTickets,
        ordersByStatus: Object.fromEntries(ordersByStatus.map(s => [s._id, s.count])),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not load dashboard stats.' });
  }
});

// GET /api/analytics/revenue — Revenue chart data
router.get('/revenue', verifyToken, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = Math.min(Number(period), 365);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const daily = await Order.aggregate([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: startDate } } },
      {
        $group: {
          _id:     { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$totalAmount' },
          orders:  { $sum: 1 },
          gst:     { $sum: '$gstAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({ success: true, daily });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not load revenue data.' });
  }
});

// GET /api/analytics/top-configs — Most ordered configurations
router.get('/top-configs', verifyToken, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const [topFabrics, topCollars, topCuffs, topSizes] = await Promise.all([
      Order.aggregate([
        { $unwind: '$items' },
        { $group: { _id: '$items.shirtConfig.fabric.name', count: { $sum: 1 } } },
        { $sort: { count: -1 } }, { $limit: 5 },
      ]),
      Order.aggregate([
        { $unwind: '$items' },
        { $group: { _id: '$items.shirtConfig.collar.name', count: { $sum: 1 } } },
        { $sort: { count: -1 } }, { $limit: 5 },
      ]),
      Order.aggregate([
        { $unwind: '$items' },
        { $group: { _id: '$items.shirtConfig.cuffs.name', count: { $sum: 1 } } },
        { $sort: { count: -1 } }, { $limit: 5 },
      ]),
      Order.aggregate([
        { $unwind: '$items' },
        { $group: { _id: '$items.shirtConfig.size', count: { $sum: 1 } } },
        { $sort: { count: -1 } }, { $limit: 12 },
      ]),
    ]);

    res.json({ success: true, topFabrics, topCollars, topCuffs, topSizes });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not load config data.' });
  }
});

// GET /api/analytics/promo-usage — Promo code usage report
router.get('/promo-usage', verifyToken, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const promoStats = await Order.aggregate([
      { $match: { promoCode: { $ne: null }, paymentStatus: 'paid' } },
      {
        $group: {
          _id:          '$promoCode',
          usageCount:   { $sum: 1 },
          totalDiscount:{ $sum: '$discount' },
          totalRevenue: { $sum: '$totalAmount' },
        },
      },
      { $sort: { usageCount: -1 } },
    ]);

    res.json({ success: true, promoStats });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not load promo data.' });
  }
});

// GET /api/analytics/gst-report — GST report for export
router.get('/gst-report', verifyToken, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const { month, year } = req.query;
    const startDate = new Date(year || new Date().getFullYear(), (month || new Date().getMonth() + 1) - 1, 1);
    const endDate   = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59);

    const orders = await Order.find({
      paymentStatus: 'paid',
      createdAt: { $gte: startDate, $lte: endDate },
    }).select('orderId customerSnapshot totalAmount subtotal gstAmount discount createdAt').lean();

    const totals = orders.reduce((acc, o) => ({
      subtotal:  acc.subtotal  + o.subtotal,
      gstAmount: acc.gstAmount + o.gstAmount,
      total:     acc.total     + o.totalAmount,
    }), { subtotal: 0, gstAmount: 0, total: 0 });

    // Export as CSV
    const headers = ['Order ID', 'Date', 'Customer', 'Subtotal', 'GST (18%)', 'Total'];
    const rows = orders.map(o => [
      o.orderId, new Date(o.createdAt).toLocaleDateString('en-IN'),
      o.customerSnapshot?.name, o.subtotal.toFixed(2), o.gstAmount.toFixed(2), o.totalAmount.toFixed(2),
    ]);

    const csv = [headers, ...rows, ['TOTAL', '', '', totals.subtotal.toFixed(2), totals.gstAmount.toFixed(2), totals.total.toFixed(2)]]
      .map(r => r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="gst-report-${month || new Date().getMonth() + 1}-${year || new Date().getFullYear()}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not generate GST report.' });
  }
});

module.exports = router;
