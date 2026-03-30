// ============================================================
// CART JS — Special One
// ============================================================

(function () {
  'use strict';

  const SHIRT_PRICE = 3999;
  const GST_RATE    = 0.18;

  const PROMO_CODES = {
    'SPECIALONE10': { type: 'percent', value: 10, label: '10% off' },
    'FIRST500':     { type: 'flat',    value: 500, label: '₹500 off' },
    'NEWUSER':      { type: 'percent', value: 15,  label: '15% off' },
  };

  let cart = [];
  let appliedPromo = null;

  const loadCart = () => {
    cart = JSON.parse(localStorage.getItem('so-cart') || '[]');
  };

  const saveCart = () => {
    localStorage.setItem('so-cart', JSON.stringify(cart));
  };

  const removeItem = (index) => {
    cart.splice(index, 1);
    saveCart();
    renderCart();
  };

  const editItem = (index) => {
    // Save the selected config and its index back to localStorage for re-editing
    localStorage.setItem('so-edit-config', JSON.stringify({ config: cart[index], index }));
    window.location.href = 'customizer.html';
  };

  const calcPricing = () => {
    const subtotal = cart.length * SHIRT_PRICE;
    let discount = 0;
    if (appliedPromo) {
      const promo = PROMO_CODES[appliedPromo];
      discount = promo.type === 'percent'
        ? Math.round(subtotal * promo.value / 100)
        : Math.min(promo.value, subtotal);
    }
    const discounted = subtotal - discount;
    const gst   = Math.round(discounted * GST_RATE * 100) / 100;
    const total = discounted + gst;
    return { subtotal, discount, gst, total };
  };

  const applyPromo = () => {
    const input = document.getElementById('promoInput');
    const code  = (input?.value || '').trim().toUpperCase();
    const msgEl = document.getElementById('promoMsg');

    if (!code) { msgEl.textContent = 'Please enter a promo code.'; msgEl.style.color = '#fc8181'; return; }

    if (PROMO_CODES[code]) {
      appliedPromo = code;
      msgEl.textContent = `✓ Code "${code}" applied — ${PROMO_CODES[code].label}`;
      msgEl.style.color = '#68d391';
      renderPricing();
    } else {
      msgEl.textContent = 'Invalid promo code.';
      msgEl.style.color = '#fc8181';
    }
  };

  const renderCart = () => {
    const container = document.getElementById('cartItems');
    const emptyState= document.getElementById('emptyCart');
    const cartMain  = document.getElementById('cartMain');

    if (cart.length === 0) {
      if (emptyState) emptyState.style.display = 'flex';
      if (cartMain)   cartMain.style.display   = 'none';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (cartMain)   cartMain.style.display   = 'grid';

    if (!container) return;

    container.innerHTML = cart.map((item, i) => `
      <div class="cart-item" id="cart-item-${i}" style="border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:var(--space-xl);background:rgba(255,255,255,0.02);display:flex;gap:var(--space-xl);align-items:flex-start;margin-bottom:var(--space-lg);transition:border-color var(--transition-base)" onmouseenter="this.style.borderColor='var(--gold)'" onmouseleave="this.style.borderColor='var(--border-subtle)'">
        <!-- Mini shirt preview -->
        <div style="width:80px;height:100px;flex-shrink:0;border:1px solid var(--border-subtle);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;background:${item.fabric?.color || '#0A1628'};font-size:2rem;overflow:hidden">
          <span style="opacity:0.6">👔</span>
        </div>

        <div style="flex:1">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--space-md)">
            <div>
              <div style="font-family:var(--font-display);font-size:1.2rem;letter-spacing:0.05em;color:var(--ivory)">Custom Shirt ${i + 1}</div>
              <div style="font-family:var(--font-accent);font-size:0.6rem;color:var(--gold);letter-spacing:0.15em;text-transform:uppercase">${item.fabric?.name || 'No fabric'}</div>
            </div>
            <div style="font-family:var(--font-display);font-size:1.3rem;color:var(--gold)">₹${SHIRT_PRICE.toLocaleString('en-IN')}</div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-sm);margin-bottom:var(--space-lg)">
            ${[
              ['Collar',   item.collar?.name   || '—'],
              ['Cuffs',    item.cuffs?.name    || '—'],
              ['Buttons',  item.buttons?.name  || '—'],
              ['Monogram', item.monogram        || 'None'],
              ['Size',     item.size            || '—'],
            ].map(([label, val]) => `
              <div style="border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:0.35rem 0.5rem;text-align:center">
                <div style="font-family:var(--font-accent);font-size:0.5rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.1em">${label}</div>
                <div style="font-family:var(--font-body);font-size:0.8rem;color:var(--ivory);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${val}</div>
              </div>
            `).join('')}
          </div>

          <div style="display:flex;gap:var(--space-md)">
            <button onclick="window.cartActions.edit(${i})" class="btn btn--dark btn--sm" aria-label="Edit shirt ${i+1}">Edit</button>
            <button onclick="window.cartActions.remove(${i})" class="btn btn--sm" style="background:transparent;border:1px solid rgba(252,129,129,0.3);color:#fc8181" aria-label="Remove shirt ${i+1}">Remove</button>
          </div>
        </div>
      </div>
    `).join('');

    renderPricing();
  };

  const renderPricing = () => {
    const { subtotal, discount, gst, total } = calcPricing();
    const fmt = (n) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    set('price-subtotal',  fmt(subtotal));
    set('price-discount',  discount > 0 ? `−${fmt(discount)}` : '—');
    set('price-gst',       fmt(gst));
    set('price-total',     fmt(total));
    set('item-count',      `${cart.length} shirt${cart.length !== 1 ? 's' : ''}`);

    const discountRow = document.getElementById('discountRow');
    if (discountRow) discountRow.style.display = discount > 0 ? 'flex' : 'none';
  };

  // Expose actions globally so inline onclick can call them
  window.cartActions = { remove: removeItem, edit: editItem };

  document.addEventListener('DOMContentLoaded', () => {
    loadCart();
    renderCart();

    document.getElementById('applyPromoBtn')?.addEventListener('click', applyPromo);
    document.getElementById('promoInput')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyPromo(); });

    document.getElementById('checkoutBtn')?.addEventListener('click', () => {
      if (cart.length === 0) { window.showToast('Your cart is empty.', 'warning'); return; }
      // Save applied promo to localStorage for checkout page
      if (appliedPromo) localStorage.setItem('so-promo', appliedPromo);
      window.location.href = 'checkout.html';
    });
  });

})();
