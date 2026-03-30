// ============================================================
// CHECKOUT JS — Special One
// ============================================================

(function () {
  'use strict';

  const SHIRT_PRICE = 3999;
  const GST_RATE    = 0.18;
  const PROMO_CODES = {
    'SPECIALONE10': { type: 'percent', value: 10 },
    'FIRST500':     { type: 'flat',    value: 500 },
    'NEWUSER':      { type: 'percent', value: 15  },
  };

  const cart   = JSON.parse(localStorage.getItem('so-cart')  || '[]');
  const promoCode = localStorage.getItem('so-promo') || null;

  // ── Calculate Pricing ─────────────────────────────────────
  const calcPricing = () => {
    const subtotal = cart.length * SHIRT_PRICE;
    let discount = 0;
    if (promoCode && PROMO_CODES[promoCode]) {
      const promo = PROMO_CODES[promoCode];
      discount = promo.type === 'percent'
        ? Math.round(subtotal * promo.value / 100)
        : Math.min(promo.value, subtotal);
    }
    const discounted = subtotal - discount;
    const gst   = Math.round(discounted * GST_RATE * 100) / 100;
    const total = discounted + gst;
    return { subtotal, discount, gst, total, promoCode };
  };

  // ── Form Validation ───────────────────────────────────────
  const getFormData = () => ({
    name:    document.getElementById('field-name')?.value.trim(),
    email:   document.getElementById('field-email')?.value.trim().toLowerCase(),
    phone:   document.getElementById('field-phone')?.value.trim(),
    line1:   document.getElementById('field-addr1')?.value.trim(),
    line2:   document.getElementById('field-addr2')?.value.trim(),
    city:    document.getElementById('field-city')?.value.trim(),
    state:   document.getElementById('field-state')?.value.trim(),
    pincode: document.getElementById('field-pincode')?.value.trim(),
  });

  const showFieldError = (id, msg) => {
    const el = document.getElementById(`err-${id}`);
    if (el) { el.textContent = msg; el.style.display = 'block'; }
    const field = document.getElementById(`field-${id}`);
    if (field) field.style.borderColor = '#fc8181';
  };

  const clearErrors = () => {
    document.querySelectorAll('.form-error').forEach(el => { el.textContent = ''; el.style.display = 'none'; });
    document.querySelectorAll('.form-input, .form-select').forEach(el => el.style.borderColor = '');
  };

  const validateForm = (data) => {
    clearErrors();
    let valid = true;

    if (!data.name || data.name.length < 2) { showFieldError('name', 'Full name is required.'); valid = false; }
    if (!data.email || !/^\S+@\S+\.\S+$/.test(data.email)) { showFieldError('email', 'A valid email is required.'); valid = false; }
    if (!data.phone || !/^\d{10}$/.test(data.phone)) { showFieldError('phone', 'Phone must be exactly 10 digits.'); valid = false; }
    if (!data.line1) { showFieldError('addr1', 'Address Line 1 is required.'); valid = false; }
    if (!data.city)  { showFieldError('city',  'City is required.'); valid = false; }
    if (!data.state) { showFieldError('state', 'State is required.'); valid = false; }
    if (!data.pincode || !/^\d{6}$/.test(data.pincode)) { showFieldError('pincode', 'Pincode must be 6 digits.'); valid = false; }

    return valid;
  };

  // ── Render Order Summary ──────────────────────────────────
  const renderSummary = () => {
    const { subtotal, discount, gst, total } = calcPricing();
    const fmt = (n) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('ck-subtotal', fmt(subtotal));
    set('ck-gst',      fmt(gst));
    set('ck-total',    fmt(total));
    set('ck-items',    `${cart.length} Custom Shirt${cart.length !== 1 ? 's' : ''}`);

    const discEl = document.getElementById('ck-discount-row');
    if (discount > 0 && discEl) {
      discEl.style.display = 'flex';
      set('ck-discount', `−${fmt(discount)}`);
    }
  };

  // ── Initiate Payment ──────────────────────────────────────
  const initiatePayment = async () => {
    if (cart.length === 0) { window.showToast('Your cart is empty.', 'warning'); return; }

    const formData = getFormData();
    if (!validateForm(formData)) return;

    const payBtn = document.getElementById('payBtn');
    if (payBtn) { payBtn.disabled = true; payBtn.textContent = 'Processing...'; }

    try {
      const pricing = calcPricing();

      // Step 1: Create Razorpay order on our server
      const createRes = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart,
          promoCode: pricing.promoCode,
          customerDetails: {
            name:    formData.name,
            email:   formData.email,
            phone:   formData.phone,
            address: {
              line1:   formData.line1,
              line2:   formData.line2,
              city:    formData.city,
              state:   formData.state,
              pincode: formData.pincode,
            },
          },
        }),
      });

      const createData = await createRes.json();
      if (!createData.success) {
        throw new Error(createData.message || 'Could not create payment order.');
      }

      // Step 2: Open Razorpay checkout
      const options = {
        key:         createData.keyId,
        amount:      Math.round(createData.amount * 100), // in paise
        currency:    'INR',
        name:        'Special One',
        description: `${cart.length} Custom Shirt${cart.length !== 1 ? 's' : ''}`,
        order_id:    createData.razorpayOrderId,
        prefill: {
          name:    formData.name,
          email:   formData.email,
          contact: formData.phone,
        },
        theme: { color: '#C9A84C' },
        modal: {
          ondismiss: () => {
            if (payBtn) { payBtn.disabled = false; payBtn.textContent = 'Pay Securely →'; }
            window.showToast('Payment cancelled.', 'warning');
          },
        },
        handler: async (response) => {
          // Step 3: Verify payment on server
          try {
            const verifyRes = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpayOrderId:   response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                items: cart,
                customerDetails: {
                  name: formData.name, email: formData.email, phone: formData.phone,
                  address: { line1: formData.line1, line2: formData.line2, city: formData.city, state: formData.state, pincode: formData.pincode },
                },
                pricing,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyData.success) throw new Error(verifyData.message);

            // Clear cart
            localStorage.removeItem('so-cart');
            localStorage.removeItem('so-promo');

            // Redirect to success page
            window.location.href = `order-success.html?orderId=${verifyData.orderId}`;
          } catch (verifyErr) {
            window.showToast(`Payment verification failed: ${verifyErr.message}. Contact support.`, 'error');
            if (payBtn) { payBtn.disabled = false; payBtn.textContent = 'Pay Securely →'; }
          }
        },
      };

      // Load Razorpay script dynamically if not present
      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = resolve;
          script.onerror = () => reject(new Error('Could not load payment gateway.'));
          document.head.appendChild(script);
        });
      }

      new window.Razorpay(options).open();
    } catch (err) {
      window.showToast(err.message || 'Payment failed. Please try again.', 'error');
      if (payBtn) { payBtn.disabled = false; payBtn.textContent = 'Pay Securely →'; }
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (cart.length === 0) { window.location.href = 'cart.html'; return; }
    renderSummary();
    document.getElementById('payBtn')?.addEventListener('click', initiatePayment);
  });

})();
