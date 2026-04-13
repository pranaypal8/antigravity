// ============================================================
// SUPPORT ROUTES — Ticket System
// ============================================================

const express = require('express');
const sanitizeHtml = require('sanitize-html');
const Ticket   = require('../models/Ticket');
const Customer = require('../models/Customer');
const Order    = require('../models/Order');
const AuditLog = require('../models/AuditLog');
const { sendTicketUpdate } = require('../services/mailer');
const { verifyToken, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  createTicketValidator,
  getTicketsValidator,
  ticketIdValidator,
  replyTicketValidator,
  updateTicketValidator,
  refundRequestValidator,
} = require('../validators/supportValidator');

const router = express.Router();

// POST /api/support/tickets — Customer creates ticket (public)
router.post('/tickets', createTicketValidator, validate, async (req, res) => {
  try {
    const { name, email, phone, subject, message, orderId } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ success: false, message: 'Name, email, subject and message are required.' });
    }

    let customer = await Customer.findOne({ email: email.toLowerCase() });
    if (!customer) {
      customer = await Customer.create({ name: sanitizeHtml(name), email: email.toLowerCase().trim(), phone: phone || '' });
    }

    let orderRef = null;
    if (orderId) {
      const order = await Order.findOne({ orderId });
      if (order) orderRef = order._id;
    }

    const ticket = await Ticket.create({
      customer: customer._id,
      customerSnapshot: { name: customer.name, email: customer.email, phone: customer.phone },
      orderId: orderRef,
      subject: sanitizeHtml(subject),
      messages: [{
        senderType: 'customer',
        senderId:   customer._id,
        senderName: customer.name,
        message:    sanitizeHtml(message),
      }],
    });

    res.status(201).json({
      success: true,
      message: `Ticket created! Your ticket ID is ${ticket.ticketId}. We'll respond within 24 hours.`,
      ticketId: ticket.ticketId,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not create ticket.' });
  }
});

// GET /api/support/tickets — Admin: list all tickets
router.get('/tickets', verifyToken, requireRole(['admin', 'superadmin', 'support']), getTicketsValidator, validate, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, priority, assignedTo } = req.query;
    const filter = {};
    if (status)     filter.status   = status;
    if (priority)   filter.priority = priority;
    if (assignedTo) filter.assignedTo = assignedTo;

    const [tickets, total] = await Promise.all([
      Ticket.find(filter)
        .select('-messages')
        .populate('assignedTo', 'name')
        .sort({ priority: -1, createdAt: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .lean(),
      Ticket.countDocuments(filter),
    ]);

    res.json({ success: true, tickets, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not fetch tickets.' });
  }
});

// GET /api/support/tickets/:id — Ticket detail
router.get('/tickets/:id', verifyToken, requireRole(['admin', 'superadmin', 'support']), ticketIdValidator, validate, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('assignedTo', 'name email role')
      .populate('orderId', 'orderId totalAmount orderStatus')
      .lean();
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });
    res.json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not fetch ticket.' });
  }
});

// POST /api/support/tickets/:id/reply — Support replies
router.post('/tickets/:id/reply', verifyToken, requireRole(['admin', 'superadmin', 'support']), replyTicketValidator, validate, async (req, res) => {
  try {
    const { message, isInternal } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Reply message is required.' });

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    const newMsg = {
      senderType: 'support',
      senderId:   req.admin._id,
      senderName: req.admin.name,
      message:    sanitizeHtml(message),
      isInternal: Boolean(isInternal),
    };

    ticket.messages.push(newMsg);
    if (!ticket.firstResponseAt) ticket.firstResponseAt = new Date();
    if (ticket.status === 'open') ticket.status = 'in_progress';
    await ticket.save();

    // Send email to customer (only for non-internal notes)
    if (!isInternal) {
      await sendTicketUpdate(ticket.customerSnapshot.email, ticket, sanitizeHtml(message));
    }

    res.json({ success: true, message: 'Reply sent.', ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not send reply.' });
  }
});

// PATCH /api/support/tickets/:id — Update ticket (status, priority, assign)
router.patch('/tickets/:id', verifyToken, requireRole(['admin', 'superadmin', 'support']), updateTicketValidator, validate, async (req, res) => {
  try {
    const { status, priority, assignedTo, tags } = req.body;
    const updates = {};
    if (status)     updates.status     = status;
    if (priority)   updates.priority   = priority;
    if (assignedTo) updates.assignedTo = assignedTo;
    if (tags)       updates.tags       = tags;
    if (status === 'resolved') updates.resolvedAt = new Date();
    if (status === 'closed')   updates.closedAt   = new Date();

    const ticket = await Ticket.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    await AuditLog.log({ adminUser: req.admin, action: `Updated ticket ${ticket.ticketId}`, entity: 'ticket', entityId: ticket._id, req });
    res.json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not update ticket.' });
  }
});

// POST /api/support/tickets/:id/refund-request — Support raises refund
router.post('/tickets/:id/refund-request', verifyToken, requireRole(['support', 'admin', 'superadmin']), refundRequestValidator, validate, async (req, res) => {
  try {
    const { amount, reason } = req.body;
    if (!amount || !reason) return res.status(400).json({ success: false, message: 'Amount and reason are required.' });

    const ticket = await Ticket.findByIdAndUpdate(req.params.id, {
      'refundRequest.amount':      Number(amount),
      'refundRequest.reason':      sanitizeHtml(reason),
      'refundRequest.status':      'pending',
      'refundRequest.requestedBy': req.admin._id,
    }, { new: true });

    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    await AuditLog.log({ adminUser: req.admin, action: `Raised refund request of ₹${amount} on ticket ${ticket.ticketId}`, entity: 'ticket', entityId: ticket._id, req });
    res.json({ success: true, message: 'Refund request submitted for Admin approval.', ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not submit refund request.' });
  }
});

module.exports = router;
