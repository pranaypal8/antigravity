// ============================================================
// MAILER SERVICE (Nodemailer)
// ============================================================
// Sends transactional emails using Gmail SMTP.
// Three email types:
// 1. Order confirmation    — Customer gets this after payment
// 2. Ticket update         — Customer gets this when support responds
// 3. Low stock alert       — Admin gets this when fabric runs low
//
// ⚠️ Requires Gmail App Password in .env (NOT your normal Gmail password).
//    See .env.example for setup instructions.
// ============================================================

const nodemailer = require('nodemailer');

// ── Create the email transport (connection to Gmail) ──────────
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT) || 587,
  secure: false, // TLS on port 587 (not SSL on port 465)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false, // Allows self-signed certs in dev
  },
});

// ── Verify connection on startup ──────────────────────────────
transporter.verify((error, success) => {
  if (error) {
    console.warn('⚠️  Email service not connected:', error.message);
    console.warn('   Orders will save, but confirmation emails will not send.');
    console.warn('   Check SMTP_USER and SMTP_PASS in your .env file.');
  } else {
    console.log('✅ Email service ready (Nodemailer connected to SMTP)');
  }
});

// ── Brand Email Wrapper ───────────────────────────────────────
// Wraps any email content in the Special One brand template
const brandWrapper = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background: #F5F0E8; font-family: Georgia, serif; }
    .wrapper { max-width: 600px; margin: 0 auto; background: #FFFFFF; }
    .header { background: #0A1628; padding: 40px 30px; text-align: center; }
    .header h1 { color: #C9A84C; font-family: Arial, sans-serif; font-size: 28px; letter-spacing: 4px; margin: 0; }
    .header p { color: #F5F0E8; font-size: 12px; letter-spacing: 3px; margin: 8px 0 0 0; }
    .body { padding: 40px 30px; color: #1C1C2E; line-height: 1.8; }
    .body h2 { color: #0A1628; font-size: 22px; margin-bottom: 8px; }
    .divider { height: 1px; background: #C9A84C; margin: 30px 0; }
    .config-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #F5F0E8; }
    .config-label { color: #888; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; }
    .config-value { font-weight: bold; color: #0A1628; }
    .price-box { background: #0A1628; color: #C9A84C; padding: 20px; text-align: center; border-radius: 4px; margin-top: 20px; }
    .price-box .amount { font-size: 32px; font-weight: bold; }
    .cta-button { display: block; background: #C9A84C; color: #0A1628; text-decoration: none; text-align: center; padding: 16px 30px; font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; letter-spacing: 2px; margin: 30px auto; width: 200px; border-radius: 2px; }
    .footer { background: #0A1628; padding: 30px; text-align: center; }
    .footer p { color: #888; font-size: 11px; margin: 4px 0; }
    .footer a { color: #C9A84C; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>SPECIAL ONE</h1>
      <p>DON'T WEAR THE BRAND. BE THE BRAND.</p>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      <p>Special One — India's First Identity-Driven Custom Shirt Platform</p>
      <p><a href="https://specialone.in">specialone.in</a> | <a href="mailto:support@specialone.in">support@specialone.in</a></p>
      <p style="margin-top: 16px; font-size: 10px; color: #555;">
        You received this email because you placed an order on Special One.
      </p>
    </div>
  </div>
</body>
</html>`;

// ── 1. Order Confirmation Email ───────────────────────────────
// Sent to the customer after their payment is verified.
//
// @param {object} customer — { name, email }
// @param {object} order    — Full Order document from MongoDB
const sendOrderConfirmation = async (customer, order) => {
  try {
    const itemsHtml = order.items.map((item, i) => `
      <div style="margin-bottom: 20px; padding: 20px; background: #F5F0E8; border-radius: 4px;">
        <strong>Shirt ${i + 1} of ${order.items.length}</strong>
        <div class="config-row"><span class="config-label">Fabric</span><span class="config-value">${item.shirtConfig.fabric.name}</span></div>
        <div class="config-row"><span class="config-label">Collar</span><span class="config-value">${item.shirtConfig.collar.name}</span></div>
        <div class="config-row"><span class="config-label">Cuffs</span><span class="config-value">${item.shirtConfig.cuffs.name}</span></div>
        <div class="config-row"><span class="config-label">Buttons</span><span class="config-value">${item.shirtConfig.buttons.name}</span></div>
        ${item.shirtConfig.monogram ? `<div class="config-row"><span class="config-label">Monogram</span><span class="config-value">${item.shirtConfig.monogram}</span></div>` : ''}
        <div class="config-row"><span class="config-label">Size</span><span class="config-value">${item.shirtConfig.size}</span></div>
      </div>
    `).join('');

    const content = `
      <h2>Order Confirmed 🎉</h2>
      <p>Thank you, <strong>${customer.name}</strong>. Your custom shirt is now in the hands of our craftspeople.</p>
      <p>Order ID: <strong style="color: #C9A84C;">${order.orderId}</strong></p>

      <div class="divider"></div>
      <h3>Your Custom Shirt Details</h3>
      ${itemsHtml}

      <div class="price-box">
        <div style="font-size: 12px; letter-spacing: 2px; margin-bottom: 8px;">TOTAL PAID</div>
        <div class="amount">₹${order.totalAmount.toFixed(2)}</div>
        <div style="font-size: 11px; margin-top: 8px; color: #aaa;">Includes 18% GST</div>
      </div>

      <div class="divider"></div>
      <p><strong>What happens next?</strong></p>
      <ol>
        <li>Your shirt goes into production within 24 hours.</li>
        <li>Quality check takes 2–3 business days.</li>
        <li>Dispatch within 5–7 business days from order date.</li>
        <li>You'll receive a tracking link once dispatched.</li>
      </ol>
      <p>Questions? Reply to this email or contact us at <a href="mailto:support@specialone.in" style="color: #C9A84C;">support@specialone.in</a></p>
    `;

    await transporter.sendMail({
      from:    process.env.EMAIL_FROM || '"Special One" <support@specialone.in>',
      to:      customer.email,
      subject: `Your Special One Order is Confirmed — ${order.orderId}`,
      html:    brandWrapper(content),
    });

    console.log(`✅ Order confirmation email sent to ${customer.email}`);
  } catch (err) {
    // Email failure should NOT fail the order — just log it
    console.error('❌ Order confirmation email failed:', err.message);
  }
};

// ── 2. Ticket Update Email ────────────────────────────────────
// Sent when the support team responds to a customer's ticket.
const sendTicketUpdate = async (customerEmail, ticket, newMessage) => {
  try {
    const content = `
      <h2>Update on Your Support Ticket</h2>
      <p>Ticket ID: <strong style="color: #C9A84C;">${ticket.ticketId}</strong></p>
      <p>Subject: ${ticket.subject}</p>
      <div class="divider"></div>
      <p><strong>Our team replied:</strong></p>
      <div style="background: #F5F0E8; padding: 20px; border-left: 4px solid #C9A84C; border-radius: 2px;">
        ${newMessage}
      </div>
      <div class="divider"></div>
      <p>To reply, email us at <a href="mailto:support@specialone.in" style="color: #C9A84C;">support@specialone.in</a> with your ticket ID in the subject.</p>
    `;

    await transporter.sendMail({
      from:    process.env.EMAIL_FROM,
      to:      customerEmail,
      subject: `Re: ${ticket.subject} [${ticket.ticketId}]`,
      html:    brandWrapper(content),
    });

    console.log(`✅ Ticket update email sent to ${customerEmail}`);
  } catch (err) {
    console.error('❌ Ticket update email failed:', err.message);
  }
};

// ── 3. Low Stock Alert Email ──────────────────────────────────
// Sent to admin when a fabric's stock drops below the threshold.
const sendLowStockAlert = async (fabric) => {
  try {
    const content = `
      <h2>⚠️ Low Stock Alert</h2>
      <p>This is an automated alert from your inventory system.</p>
      <div class="divider"></div>
      <div class="config-row"><span class="config-label">Fabric</span><span class="config-value">${fabric.name}</span></div>
      <div class="config-row"><span class="config-label">Current Stock</span><span class="config-value" style="color: #cc3333;">${fabric.stockMeters} meters</span></div>
      <div class="config-row"><span class="config-label">Threshold</span><span class="config-value">${fabric.lowStockThreshold} meters</span></div>
      <div class="config-row"><span class="config-label">Status</span><span class="config-value">${fabric.stockStatus.replace('_', ' ').toUpperCase()}</span></div>
      <div class="divider"></div>
      <p>Please restock this fabric soon to avoid order fulfillment delays.</p>
      <a href="http://localhost:${process.env.PORT || 5000}/admin/inventory.html" class="cta-button">VIEW INVENTORY</a>
    `;

    await transporter.sendMail({
      from:    process.env.EMAIL_FROM,
      to:      process.env.SMTP_USER, // Send alert to admin email
      subject: `⚠️ Low Stock: ${fabric.name} (${fabric.stockMeters}m remaining)`,
      html:    brandWrapper(content),
    });

    console.log(`✅ Low stock alert sent for fabric: ${fabric.name}`);
  } catch (err) {
    console.error('❌ Low stock alert email failed:', err.message);
  }
};

// ── 4. Shipment Dispatched Email ──────────────────────────────
const sendShipmentDispatched = async (customer, order) => {
  try {
    const content = `
      <h2>Your Order is on its way! 🚀</h2>
      <p>Great news, <strong>${customer.name}</strong>! Your Special One shirt has been dispatched.</p>
      <div class="divider"></div>
      <div class="config-row"><span class="config-label">Order ID</span><span class="config-value">${order.orderId}</span></div>
      <div class="config-row"><span class="config-label">AWB / Tracking</span><span class="config-value">${order.awbNumber || 'Will be updated shortly'}</span></div>
      <div class="config-row"><span class="config-label">Courier</span><span class="config-value">${order.courierName || 'To be assigned'}</span></div>
      <div class="divider"></div>
      ${order.trackingUrl ? `<a href="${order.trackingUrl}" class="cta-button">TRACK YOUR SHIRT</a>` : ''}
      <p>Estimated delivery: 3–5 business days from dispatch.</p>
    `;

    await transporter.sendMail({
      from:    process.env.EMAIL_FROM,
      to:      customer.email,
      subject: `Your Special One Order is Dispatched — ${order.orderId}`,
      html:    brandWrapper(content),
    });
  } catch (err) {
    console.error('❌ Dispatch email failed:', err.message);
  }
};

module.exports = {
  sendOrderConfirmation,
  sendTicketUpdate,
  sendLowStockAlert,
  sendShipmentDispatched,
};
