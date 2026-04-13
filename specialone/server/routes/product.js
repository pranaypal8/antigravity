// ============================================================
// PRODUCT ROUTES — Manage shirt customization options
// ============================================================

const express = require('express');
const sanitizeHtml = require('sanitize-html');
const Product  = require('../models/Product');
const Fabric   = require('../models/Fabric');
const { param } = require('express-validator');
const AuditLog = require('../models/AuditLog');
const { verifyToken, requireRole } = require('../middleware/auth');
const { uploadMultiple, uploadSingle } = require('../middleware/upload');
const { validate } = require('../middleware/validate');
const {
  getProductsValidator,
  productIdValidator,
  createProductValidator,
  updateProductValidator,
} = require('../validators/productValidator');

const router = express.Router();

// GET /api/products — Public: get active products for customizer
router.get('/', getProductsValidator, validate, async (req, res) => {
  try {
    const products = await Product.find({ isActive: true }).sort('sortOrder').lean();
    const fabrics  = await Fabric.find({ isActive: true }).sort('sortOrder').lean();
    res.json({ success: true, products, fabrics });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not load products.' });
  }
});

// GET /api/products/admin — Admin: all products including inactive
router.get('/admin', verifyToken, requireRole(['admin', 'superadmin']), getProductsValidator, validate, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not load products.' });
  }
});

// POST /api/products — Create product (admin)
router.post('/', verifyToken, requireRole(['admin', 'superadmin']), uploadMultiple, createProductValidator, validate, async (req, res) => {
  try {
    const { name, description, fabricOptions, collarOptions, cuffOptions, buttonOptions } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Product name is required.' });

    const images = req.files ? req.files.map(f => `/assets/images/products/${f.filename}`) : [];

    const product = await Product.create({
      name: sanitizeHtml(name),
      description: sanitizeHtml(description || ''),
      fabricOptions: JSON.parse(fabricOptions || '[]'),
      collarOptions: JSON.parse(collarOptions || '[]'),
      cuffOptions:   JSON.parse(cuffOptions   || '[]'),
      buttonOptions: JSON.parse(buttonOptions || '[]'),
      images,
    });

    await AuditLog.log({ adminUser: req.admin, action: `Created product: ${product.name}`, entity: 'product', entityId: product._id, req });
    res.status(201).json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/products/:id — Update product (admin)
router.patch('/:id', verifyToken, requireRole(['admin', 'superadmin']), updateProductValidator, validate, async (req, res) => {
  try {
    const before  = await Product.findById(req.params.id).lean();
    if (!before) return res.status(404).json({ success: false, message: 'Product not found.' });

    const allowed = ['name','description','fabricOptions','collarOptions','cuffOptions','buttonOptions','isActive','sortOrder'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    delete updates.price; // price is immutable

    const product = await Product.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    await AuditLog.log({ adminUser: req.admin, action: `Updated product: ${product.name}`, entity: 'product', entityId: product._id, changes: { before, after: product.toObject() }, req });
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/products/:id — Soft delete (set inactive)
router.delete('/:id', verifyToken, requireRole(['admin', 'superadmin']), productIdValidator, validate, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    await AuditLog.log({ adminUser: req.admin, action: `Deactivated product: ${product.name}`, entity: 'product', entityId: product._id, req });
    res.json({ success: true, message: 'Product deactivated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── FABRIC INVENTORY ──────────────────────────────────────────

// GET /api/products/fabrics — Admin fabric list
router.get('/fabrics', verifyToken, requireRole(['admin', 'superadmin', 'vendor']), async (req, res) => {
  try {
    const fabrics = await Fabric.find().sort('sortOrder').lean();
    res.json({ success: true, fabrics });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not load fabrics.' });
  }
});

// POST /api/products/fabrics — Create fabric
router.post('/fabrics', verifyToken, requireRole(['admin', 'superadmin']), uploadSingle, async (req, res) => {
  try {
    const { name, color, description, stockMeters, lowStockThreshold } = req.body;
    if (!name || !color) return res.status(400).json({ success: false, message: 'Name and color are required.' });

    const imageUrl = req.file ? `/assets/images/fabrics/${req.file.filename}` : '';
    const fabric = await Fabric.create({
      name: sanitizeHtml(name),
      color,
      description: sanitizeHtml(description || ''),
      stockMeters: Number(stockMeters) || 0,
      lowStockThreshold: Number(lowStockThreshold) || 10,
      imageUrl,
    });

    await AuditLog.log({ adminUser: req.admin, action: `Created fabric: ${fabric.name}`, entity: 'fabric', entityId: fabric._id, req });
    res.status(201).json({ success: true, fabric });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/products/fabrics/:id/stock — Update stock level
router.patch('/fabrics/:id/stock', verifyToken, requireRole(['admin', 'superadmin']), param('id').isMongoId(), validate, async (req, res) => {
  try {
    const { action, quantity, note } = req.body;
    if (!['add','remove','adjust'].includes(action) || quantity === undefined) {
      return res.status(400).json({ success: false, message: 'action (add/remove/adjust) and quantity are required.' });
    }

    const fabric = await Fabric.findById(req.params.id);
    if (!fabric) return res.status(404).json({ success: false, message: 'Fabric not found.' });

    const prevStock = fabric.stockMeters;
    if (action === 'add')    fabric.stockMeters += Number(quantity);
    if (action === 'remove') fabric.stockMeters = Math.max(0, fabric.stockMeters - Number(quantity));
    if (action === 'adjust') fabric.stockMeters = Math.max(0, Number(quantity));

    fabric.stockHistory.push({ action, quantity: Number(quantity), newTotal: fabric.stockMeters, note: sanitizeHtml(note || ''), performedBy: req.admin._id });
    await fabric.save();

    await AuditLog.log({
      adminUser: req.admin,
      action: `Updated fabric stock: ${fabric.name} ${action} ${quantity}m (${prevStock}m → ${fabric.stockMeters}m)`,
      entity: 'fabric', entityId: fabric._id, req,
    });

    res.json({ success: true, fabric });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
