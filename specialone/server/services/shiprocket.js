// ============================================================
// SHIPROCKET SERVICE
// ============================================================
// Handles all delivery operations via the Shiprocket API.
//
// IMPORTANT: Shiprocket tokens expire every 10 days.
// This service auto-refreshes the token before it expires
// so shipments never fail due to an expired token.
//
// Functions:
// - getToken()        — Login and get fresh token (auto-cached)
// - createOrder()     — Create a shipment after payment is verified
// - trackShipment()   — Get real-time tracking status by AWB number
// - cancelOrder()     — Cancel a shipment (before pickup)
// - getAllShipments()  — List all shipments (for admin panel)
// ============================================================

const axios = require('axios');

const SHIPROCKET_API = 'https://apiv2.shiprocket.in/v1/external';

// ── Token Cache ───────────────────────────────────────────────
// We cache the token in memory so we don't log in on every API call.
// Priority: SHIPROCKET_TOKEN env var (static, from browser) → API login
let tokenCache = {
  token: null,
  expiresAt: null,
};

// ── Decode JWT expiry without a library ───────────────────────
const getJwtExpiry = (token) => {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload.exp ? payload.exp * 1000 : null; // convert to ms
  } catch {
    return null;
  }
};

// ── getToken ──────────────────────────────────────────────────
// Returns a valid Shiprocket token.
// 1. Uses SHIPROCKET_TOKEN from .env if valid (not expired)
// 2. Falls back to API login if static token is missing/expired
const getToken = async () => {
  const now = Date.now();
  const thirtyMinutes = 30 * 60 * 1000;

  // If cached token is still valid, reuse it
  if (tokenCache.token && tokenCache.expiresAt && (tokenCache.expiresAt - now) > thirtyMinutes) {
    return tokenCache.token;
  }

  // Try the static token from .env first (avoids login API)
  const staticToken = process.env.SHIPROCKET_TOKEN;
  if (staticToken) {
    const expiry = getJwtExpiry(staticToken);
    if (!expiry || (expiry - now) > thirtyMinutes) {
      tokenCache = { token: staticToken, expiresAt: expiry || (now + 9 * 24 * 60 * 60 * 1000) };
      console.log('✅ Shiprocket: using static token from .env (expires:', expiry ? new Date(expiry).toLocaleDateString() : 'unknown', ')');
      return staticToken;
    } else {
      console.warn('⚠️  Shiprocket: static token in .env has expired. Renew it via browser. Falling back to login...');
    }
  }

  // Fallback: login to get a fresh token
  try {
    console.log('🔄 Refreshing Shiprocket token via login...');

    const response = await axios.post(`${SHIPROCKET_API}/auth/login`, {
      email:    process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD,
    });

    const { token } = response.data;
    const nineAndHalfDays = 9.5 * 24 * 60 * 60 * 1000;
    tokenCache = { token, expiresAt: now + nineAndHalfDays };

    console.log('✅ Shiprocket token refreshed successfully.');
    return token;
  } catch (err) {
    console.error('❌ Shiprocket login failed:', err.response?.data?.message || err.message);
    throw new Error('Could not connect to Shiprocket. Check your credentials in .env');
  }
};

// ── Helper: get authenticated Axios headers ──────────────────
const getAuthHeaders = async () => {
  const token = await getToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
};

// ── createOrder ───────────────────────────────────────────────
// Creates a shipment in Shiprocket after a successful payment.
// Returns the AWB number (tracking number) and shipment ID.
//
// @param {object} orderData — Our Order document from MongoDB
// @returns {object}         — { shipmentId, awbNumber, courierName, trackingUrl }
const createOrder = async (orderData) => {
  try {
    const headers = await getAuthHeaders();

    // Build the payload in Shiprocket's format
    const payload = {
      order_id:             orderData.orderId,
      order_date:           new Date(orderData.createdAt).toISOString().split('T')[0],
      pickup_location:      'Primary', // Your Shiprocket warehouse name
      channel_id:           process.env.SHIPROCKET_CHANNEL_ID,
      comment:              `Special One Custom Shirt — ${orderData.items.length} shirt(s)`,
      billing_customer_name:  orderData.customerSnapshot.name,
      billing_last_name:      '',
      billing_address:        orderData.customerSnapshot.address.line1,
      billing_address_2:      orderData.customerSnapshot.address.line2 || '',
      billing_city:           orderData.customerSnapshot.address.city,
      billing_pincode:        orderData.customerSnapshot.address.pincode,
      billing_state:          orderData.customerSnapshot.address.state,
      billing_country:        'India',
      billing_email:          orderData.customerSnapshot.email,
      billing_phone:          orderData.customerSnapshot.phone,
      shipping_is_billing:    true,
      order_items: orderData.items.map((item, idx) => ({
        name:         `Custom Shirt — ${item.shirtConfig.collar.name}, ${item.shirtConfig.fabric.name}`,
        sku:          `SO-SHIRT-${item.shirtConfig.size}-${idx + 1}`,
        units:        item.quantity,
        selling_price: item.price,
        discount:     0,
        tax:          item.price * 0.18,
        hsn:          '62052090', // HSN code for men's shirts in India
      })),
      payment_method: 'Prepaid',
      sub_total:      orderData.subtotal,
      length:         30,  // Package dimensions in cm
      breadth:        25,
      height:         5,
      weight:         0.5, // Weight in kg (one shirt ≈ 500g)
    };

    const response = await axios.post(`${SHIPROCKET_API}/orders/create/adhoc`, payload, { headers });
    const data = response.data;

    console.log(`✅ Shiprocket order created: ${data.shipment_id}`);

    return {
      shiprocketOrderId:  data.order_id?.toString(),
      shiprocketShipmentId: data.shipment_id?.toString(),
      awbNumber:          data.awb_code || null,
      courierName:        data.courier_name || null,
      trackingUrl:        data.awb_code ? `https://shiprocket.co/tracking/${data.awb_code}` : null,
    };
  } catch (err) {
    console.error('❌ Shiprocket createOrder failed:', err.response?.data || err.message);
    throw new Error(
      err.response?.data?.message || 'Could not create Shiprocket order. Please try again.'
    );
  }
};

// ── trackShipment ─────────────────────────────────────────────
// Gets real-time tracking status for a shipment.
//
// @param {string} awbNumber — The tracking number (from createOrder response)
// @returns {object}         — { status, lastUpdate, activity[] }
const trackShipment = async (awbNumber) => {
  try {
    const headers = await getAuthHeaders();

    const response = await axios.get(
      `${SHIPROCKET_API}/courier/track/awb/${awbNumber}`,
      { headers }
    );

    return response.data?.tracking_data || {};
  } catch (err) {
    console.error('❌ Shiprocket tracking failed:', err.message);
    throw new Error('Could not retrieve shipment tracking. The AWB may be invalid.');
  }
};

// ── cancelOrder ───────────────────────────────────────────────
// Cancels a shipment. Only works before the courier picks it up.
//
// @param {string[]} shiprocketOrderIds — Array of Shiprocket order IDs to cancel
const cancelOrder = async (shiprocketOrderIds) => {
  try {
    const headers = await getAuthHeaders();

    const response = await axios.post(
      `${SHIPROCKET_API}/orders/cancel`,
      { ids: shiprocketOrderIds },
      { headers }
    );

    console.log(`✅ Shiprocket orders cancelled:`, shiprocketOrderIds);
    return response.data;
  } catch (err) {
    console.error('❌ Shiprocket cancel failed:', err.response?.data || err.message);
    throw new Error('Could not cancel Shiprocket order.');
  }
};

// ── getAllShipments ───────────────────────────────────────────
// Fetches a list of all shipments for the admin dashboard.
const getAllShipments = async (page = 1, perPage = 20) => {
  try {
    const headers = await getAuthHeaders();

    const response = await axios.get(
      `${SHIPROCKET_API}/shipments?page=${page}&per_page=${perPage}`,
      { headers }
    );

    return response.data;
  } catch (err) {
    console.error('❌ Shiprocket getAllShipments failed:', err.message);
    throw new Error('Could not fetch shipments from Shiprocket.');
  }
};

// ── Auto-refresh on startup ───────────────────────────────────
// Pre-fetch the token when the server starts so the first order doesn't have to wait
(async () => {
  if (process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD) {
    try {
      await getToken();
    } catch {
      // Non-fatal: token will be fetched on first actual shipment request
    }
  }
})();

module.exports = {
  getToken,
  createOrder,
  trackShipment,
  cancelOrder,
  getAllShipments,
};
