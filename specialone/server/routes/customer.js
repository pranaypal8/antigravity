// ============================================================
// CUSTOMER ROUTES
// ============================================================

const express = require('express');
const sanitizeHtml = require('sanitize-html');
const Customer = require('../models/Customer');
const Order    = require('../models/Order');
const AuditLog = require('../models/AuditLog');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/customers — All customers (admin)
router.get('/', verifyToken, requireRole(['admin', 'superadmin', 'support']), async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const filter = {};
    if (search) {
      filter.$or = [
        { name:  { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const [customers, total] = await Promise.all([
      Customer.find(filter).sort({ totalSpent: -1 }).limit(Number(limit)).skip((Number(page) - 1) * Number(limit)).lean(),
      Customer.countDocuments(filter),
    ]);

    res.json({ success: true, customers, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not fetch customers.' });
  }
});

// GET /api/customers/export — Export CSV
router.get('/export', verifyToken, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const customers = await Customer.find().sort({ createdAt: -1 }).lean();
    const headers = ['Name', 'Email', 'Phone', 'Total Orders', 'Total Spent (₹)', 'Blacklisted', 'Joined'];
    const rows = customers.map(c => [
      c.name, c.email, c.phone, c.totalOrders, c.totalSpent.toFixed(2),
      c.isBlacklisted ? 'Yes' : 'No',
      new Date(c.createdAt).toLocaleDateString('en-IN'),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="specialone-customers-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Export failed.' });
  }
});

// GET /api/customers/:id — Customer detail with order history
router.get('/:id', verifyToken, requireRole(['admin', 'superadmin', 'support']), async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id).lean();
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

    const orders = await Order.find({ customer: req.params.id })
      .select('orderId createdAt totalAmount orderStatus paymentStatus items')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, customer, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not fetch customer.' });
  }
});

// PATCH /api/customers/:id/blacklist — Toggle blacklist
router.patch('/:id/blacklist', verifyToken, requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const { isBlacklisted, reason } = req.body;
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { isBlacklisted, blacklistReason: sanitizeHtml(reason || '') },
      { new: true }
    );
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

    await AuditLog.log({
      adminUser: req.admin,
      action: `${isBlacklisted ? 'Blacklisted' : 'Unblacklisted'} customer: ${customer.email}`,
      entity: 'customer', entityId: customer._id, req,
    });
    res.json({ success: true, message: `Customer ${isBlacklisted ? 'blacklisted' : 'unblacklisted'}.`, customer });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not update customer.' });
  }
});

// PATCH /api/customers/:id/notes — Update internal notes
router.patch('/:id/notes', verifyToken, requireRole(['admin', 'superadmin', 'support']), async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { internalNotes: sanitizeHtml(req.body.notes || '') },
      { new: true }
    );
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });
    res.json({ success: true, message: 'Notes updated.', customer });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not update notes.' });
  }
});

module.exports = router;
