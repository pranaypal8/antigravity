// ============================================================
// RAZORPAY SERVICE
// ============================================================
// All payment operations go through this file.
// Three core functions:
// 1. createOrder    — Creates a payment intent (before customer pays)
// 2. verifySignature — Confirms the payment is genuine (crypto check)
// 3. initiateRefund — Sends money back to the customer via Razorpay
//
// ⚠️ NEVER call Razorpay APIs directly from routes.
//    Always use this service so logic stays centralized.
// ============================================================

const Razorpay = require('razorpay');
const crypto = require('crypto');

// ── Lazy-initialize Razorpay ──────────────────────────────────
// The Razorpay client is created only when first needed.
// This prevents a startup crash when RAZORPAY_KEY_ID is not yet in .env.
let _razorpay = null;
const getRazorpay = () => {
  if (!_razorpay) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay credentials missing. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env');
    }
    _razorpay = new Razorpay({
      key_id:     process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return _razorpay;
};

// ── 1. Create Order ───────────────────────────────────────────
// Call this when the customer clicks "Pay Now".
// Returns a Razorpay order ID that the frontend uses to open checkout.
//
// @param {number} amountInRupees — e.g., 4718.82 for one shirt with GST
// @param {string} receipt       — our own order reference (e.g., "SO-20240101-ABCD")
// @returns {object}             — Razorpay order object with id, amount, currency
const createOrder = async (amountInRupees, receipt = '') => {
  try {
    // Razorpay requires amount in PAISE (1 rupee = 100 paise)
    // We round to avoid floating point issues
    const amountInPaise = Math.round(amountInRupees * 100);

    const order = await getRazorpay().orders.create({
      amount:   amountInPaise,
      currency: 'INR',
      receipt:  receipt.slice(0, 40), // Razorpay receipt max 40 chars
      notes: {
        source: 'Special One Website',
      },
    });

    console.log(`✅ Razorpay order created: ${order.id} (₹${amountInRupees})`);
    return order;
  } catch (err) {
    console.error('❌ Razorpay createOrder failed:', err.message);
    throw new Error('Payment system error. Please try again.');
  }
};

// ── 2. Verify Payment Signature ───────────────────────────────
// CRITICAL: This verifies that the payment response from Razorpay is genuine
// and wasn't tampered with. Always verify before saving an order.
//
// @param {string} razorpayOrderId   — The order ID we created
// @param {string} razorpayPaymentId — The payment ID from Razorpay after payment
// @param {string} razorpaySignature — The signature Razorpay sends
// @returns {boolean}               — true if signature matches, false if tampered
const verifySignature = (razorpayOrderId, razorpayPaymentId, razorpaySignature) => {
  // Generate what the signature SHOULD be using our secret key
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  // Compare using timing-safe method (prevents timing attacks)
  const isValid = crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(razorpaySignature)
  );

  if (!isValid) {
    console.error('🚨 PAYMENT SIGNATURE MISMATCH — Possible fraud attempt!', {
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
    });
  }

  return isValid;
};

// ── 3. Initiate Refund ────────────────────────────────────────
// Called after Admin approves a refund request from the support team.
//
// @param {string} paymentId      — Razorpay payment ID to refund
// @param {number} amountInRupees — Amount to refund (can be partial)
// @param {string} notes          — Reason for refund (for Razorpay records)
// @returns {object}              — Razorpay refund object with refund ID
const initiateRefund = async (paymentId, amountInRupees, notes = 'Customer request') => {
  try {
    const amountInPaise = Math.round(amountInRupees * 100);

    const refund = await getRazorpay().payments.refund(paymentId, {
      amount: amountInPaise,
      notes: { reason: notes },
      speed: 'normal', // 'normal' = 5-7 business days, 'optimum' = same day (extra cost)
    });

    console.log(`✅ Refund initiated: ${refund.id} for ₹${amountInRupees}`);
    return refund;
  } catch (err) {
    console.error('❌ Razorpay refund failed:', err.message);
    throw new Error(`Refund failed: ${err.error?.description || err.message}`);
  }
};

// ── 4. Fetch Payment Details ──────────────────────────────────
// Used in the admin panel to get full payment info
const fetchPayment = async (paymentId) => {
  try {
    return await getRazorpay().payments.fetch(paymentId);
  } catch (err) {
    console.error('❌ Could not fetch payment:', err.message);
    throw new Error('Could not retrieve payment details.');
  }
};

// ── 5. Verify Webhook Signature ──────────────────────────────
// Used when Razorpay sends events to our webhook endpoint
const verifyWebhookSignature = (rawBody, signature) => {
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature)
  );
};

module.exports = {
  createOrder,
  verifySignature,
  initiateRefund,
  fetchPayment,
  verifyWebhookSignature,
};
