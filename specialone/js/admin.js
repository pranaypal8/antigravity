// ============================================================
// ADMIN JS — Special One Admin Panel
// ============================================================
// Runs on all admin pages. Handles:
// 1. Auth guard (redirect to login if not authenticated)
// 2. Dashboard stats loading
// 3. Orders table with status updates
// 4. Revenue chart
// 5. Low-stock alerts
// 6. Role-based sidebar visibility
// 7. Logout
// ============================================================

(function () {
  'use strict';

  // ── Auth Guard ────────────────────────────────────────────
  // Every admin page calls this on load.
  // JWT is in an httpOnly cookie — we just call a protected endpoint.
  const guardAuth = async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (!res.ok) throw new Error('Unauthorized');
      const data = await res.json();
      if (!data.success) throw new Error('Unauthorized');

      const admin = data.admin;
      // Cache in sessionStorage for UI display only
      sessionStorage.setItem('so-admin-role', admin.role || '');
      sessionStorage.setItem('so-admin-name', admin.name || admin.email);

      renderSidebarUser(admin);
      applyRoleVisibility(admin.role);
      return admin;
    } catch (err) {
      // Not authenticated → redirect
      window.location.href = 'login.html';
      return null;
    }
  };

  // ── Sidebar User Display ──────────────────────────────────
  const renderSidebarUser = (admin) => {
    const nameEl   = document.getElementById('sidebarName');
    const roleEl   = document.getElementById('sidebarRole');
    const initEl   = document.getElementById('sidebarInitial');
    if (!nameEl) return;
    nameEl.textContent  = admin.name || admin.email;
    roleEl.textContent  = admin.role || '';
    if (initEl) initEl.textContent = (admin.name || admin.email || '?')[0].toUpperCase();
  };

  // ── Role-Based Sidebar Visibility ─────────────────────────
  const applyRoleVisibility = (role) => {
    const superAdminOnly = ['super_admin'];
    if (superAdminOnly.includes(role)) {
      document.getElementById('superAdminSection')?.style.setProperty('display', 'block');
      document.getElementById('nav-admins')?.style.setProperty('display', 'flex');
      document.getElementById('nav-audit')?.style.setProperty('display', 'flex');
    }
  };

  // ── Date Display ──────────────────────────────────────────
  const setDateDisplay = () => {
    const el = document.getElementById('dateDisplay');
    if (!el) return;
    el.textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  // ── API Helper ────────────────────────────────────────────
  const apiGet = async (path) => {
    const res = await fetch(`/api${path}`, { credentials: 'include' });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  };

  const apiPost = async (path, body) => {
    const res = await fetch(`/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  };

  const apiPut = async (path, body) => {
    const res = await fetch(`/api${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  };

  // ── Status Badge HTML ─────────────────────────────────────
  const statusBadge = (status) => {
    const map = {
      pending:            'badge--warning',
      payment_received:   'badge--gold',
      in_production:      'badge--gold',
      quality_check:      'badge--gold',
      dispatched:         'badge--success',
      delivered:          'badge--success',
      cancelled:          'badge--danger',
      refund_initiated:   'badge--warning',
      refunded:           'badge--neutral',
    };
    const cls = map[status] || 'badge--neutral';
    return `<span class="badge ${cls}">${status.replace(/_/g, ' ')}</span>`;
  };

  // ── Format Currency ───────────────────────────────────────
  const fmtINR = (n) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  // ── Dashboard: Load Stats ─────────────────────────────────
  const loadDashboardStats = async () => {
    try {
      const data = await apiGet('/analytics/dashboard');
      if (!data.success) return;

      const { todayRevenue, totalOrders, pendingOrders, totalCustomers, openTickets, urgentTickets } = data;

      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

      set('stat-revenue',   fmtINR(todayRevenue || 0));
      set('stat-orders',    totalOrders || 0);
      set('stat-pending',   `${pendingOrders || 0}`);
      set('stat-customers', totalCustomers || 0);
      set('stat-tickets',   openTickets || 0);
      set('stat-urgent',    `${urgentTickets || 0}`);
      set('pendingOrdersCount', pendingOrders || 0);
      set('openTicketsCount',   openTickets   || 0);

      const lastRefresh = document.getElementById('lastRefreshed');
      if (lastRefresh) lastRefresh.textContent = `Last updated: ${new Date().toLocaleTimeString('en-IN')}`;
    } catch (err) {
      console.error('Stats error:', err);
    }
  };

  // ── Dashboard: Load Recent Orders ─────────────────────────
  const loadRecentOrders = async () => {
    const tbody = document.getElementById('recentOrdersBody');
    if (!tbody) return;

    try {
      const data = await apiGet('/orders?limit=8&sortBy=createdAt&sortOrder=desc');
      if (!data.success || !data.orders?.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted);font-family:var(--font-accent);font-size:0.75rem">No orders yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = DOMPurify.sanitize(data.orders.map(order => `
        <tr>
          <td><span class="table-id">${order.orderId || order._id?.slice(-8)}</span></td>
          <td>
            <div class="table-name">${order.customerDetails?.name || '—'}</div>
            <div style="font-family:var(--font-accent);font-size:0.6rem;color:var(--text-muted)">${order.customerDetails?.email || ''}</div>
          </td>
          <td style="font-family:var(--font-accent);font-size:0.75rem">${order.items?.length || 1} shirt${(order.items?.length || 1) !== 1 ? 's' : ''}</td>
          <td style="font-family:var(--font-display);font-size:0.9rem;color:var(--gold)">${fmtINR(order.pricing?.total || 0)}</td>
          <td>${statusBadge(order.status)}</td>
          <td style="font-family:var(--font-accent);font-size:0.65rem">${fmtDate(order.createdAt)}</td>
          <td>
            <div class="table-actions">
              <a href="orders.html?id=${order._id}" class="btn-action-view">View</a>
              <button class="btn-action-edit" onclick="window.adminActions.openStatusModal('${order._id}','${order.status}')">Status</button>
            </div>
          </td>
        </tr>
      `).join(''));
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:#fc8181;font-family:var(--font-accent);font-size:0.75rem">Error loading orders.</td></tr>`;
    }
  };

  // ── Dashboard: Revenue Chart ──────────────────────────────
  const renderRevenueChart = async () => {
    const container = document.getElementById('revenueChart');
    if (!container) return;

    try {
      const data = await apiGet('/analytics/revenue?period=30');
      if (!data.success) return;

      const days = data.data || [];
      const maxRevenue = Math.max(...days.map(d => d.revenue), 1);

      container.innerHTML = DOMPurify.sanitize(days.map(day => {
        const heightPct = Math.max(4, Math.round((day.revenue / maxRevenue) * 100));
        return `
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px" title="${fmtInr(day.revenue)} on ${fmtDate(day.date)}">
            <div style="width:100%;height:${heightPct}%;background:${day.revenue > 0 ? 'linear-gradient(to top,var(--gold),var(--gold-light))' : 'var(--border-subtle)'};border-radius:2px 2px 0 0;transition:height 0.5s ease;opacity:${day.revenue > 0 ? 1 : 0.3}"></div>
          </div>
        `;
      }).join(''));
    } catch (err) {
      console.error('Revenue chart error:', err);
    }
  };

  // ── Dashboard: Stock Alerts ───────────────────────────────
  const loadStockAlerts = async () => {
    const container = document.getElementById('stockAlerts');
    if (!container) return;

    try {
      const data = await apiGet('/products/fabrics?stockStatus=low_stock,out_of_stock&limit=5');
      if (!data.success || !data.fabrics?.length) {
        container.innerHTML = `<p style="font-family:var(--font-accent);font-size:0.75rem;color:#68d391">✓ All fabrics well-stocked</p>`;
        return;
      }

      container.innerHTML = DOMPurify.sanitize(data.fabrics.map(f => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid var(--border-subtle);margin-bottom:0.3rem">
          <div>
            <div style="font-family:var(--font-accent);font-size:0.75rem;color:var(--ivory)">${f.name}</div>
            <div style="font-family:var(--font-accent);font-size:0.6rem;color:var(--text-muted)">${f.stockQuantity} units left</div>
          </div>
          <span class="badge ${f.stockStatus === 'out_of_stock' ? 'badge--danger' : 'badge--warning'}">${f.stockStatus === 'out_of_stock' ? 'Out' : 'Low'}</span>
        </div>
      `).join(''));
    } catch (err) {
      container.innerHTML = `<p style="font-family:var(--font-accent);font-size:0.75rem;color:var(--text-muted)">Could not load stock data.</p>`;
    }
  };

  // ── Status Update Modal ───────────────────────────────────
  const ORDER_STATUSES = ['pending','payment_received','in_production','quality_check','dispatched','delivered','cancelled','refund_initiated','refunded'];

  window.adminActions = {
    openStatusModal: (orderId, currentStatus) => {
      const overlay = document.getElementById('statusModal');
      if (!overlay) return;
      document.getElementById('statusModalOrderId').textContent = orderId;
      document.getElementById('statusSelect').value = currentStatus;
      document.getElementById('statusModal').dataset.orderId = orderId;
      overlay.classList.add('active');
    },
  };

  // ── Orders Page ───────────────────────────────────────────
  // (Used when orders.html loads)
  const initOrdersPage = async () => {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    const urlId = new URLSearchParams(window.location.search).get('id');

    const loadOrders = async (page = 1, search = '', status = '') => {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;font-family:var(--font-accent);font-size:0.75rem;color:var(--text-muted)">Loading...</td></tr>`;
      try {
        const params = new URLSearchParams({ page, limit: 20, search, ...(status && { status }) });
        const data = await apiGet(`/orders?${params}`);
        if (!data.success) throw new Error('Load failed');

        if (!data.orders?.length) {
          tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;font-family:var(--font-accent);font-size:0.75rem;color:var(--text-muted)">No orders found.</td></tr>`;
          return;
        }

        tbody.innerHTML = DOMPurify.sanitize(data.orders.map(order => `
          <tr>
            <td><span class="table-id">${order.orderId || order._id?.slice(-8)}</span></td>
            <td>
              <div class="table-name">${order.customerDetails?.name || '—'}</div>
              <div style="font-family:var(--font-accent);font-size:0.6rem;color:var(--text-muted)">${order.customerDetails?.phone || ''}</div>
            </td>
            <td style="font-family:var(--font-accent);font-size:0.75rem">${order.items?.length || 1}</td>
            <td style="font-family:var(--font-display);font-size:0.9rem;color:var(--gold)">${fmtINR(order.pricing?.total || 0)}</td>
            <td>${statusBadge(order.status)}</td>
            <td style="font-family:var(--font-accent);font-size:0.65rem">${order.shipping?.awb || '—'}</td>
            <td style="font-family:var(--font-accent);font-size:0.65rem">${fmtDate(order.createdAt)}</td>
            <td>
              <div class="table-actions">
                <button class="btn-action-view" onclick="window.adminActions.viewOrder('${order._id}')">View</button>
                <button class="btn-action-edit" onclick="window.adminActions.openStatusModal('${order._id}','${order.status}')">Status</button>
              </div>
            </td>
          </tr>
        `).join(''));

        // Pagination
        const paginationInfo = document.getElementById('paginationInfo');
        if (paginationInfo) paginationInfo.textContent = `${data.total} total orders`;

        // If specific order passed in URL, open it
        if (urlId) {
          const order = data.orders.find(o => o._id === urlId);
          if (order) window.adminActions.viewOrder(urlId);
        }
      } catch (err) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;font-family:var(--font-accent);font-size:0.75rem;color:#fc8181">Error: ${err.message}</td></tr>`;
      }
    };

    window.adminActions.viewOrder = async (id) => {
      try {
        const data = await apiGet(`/orders/${id}`);
        if (!data.success) return;
        const o = data.order;

        const overlay = document.getElementById('orderModal');
        if (!overlay) return;

        document.getElementById('orderModalBody').innerHTML = DOMPurify.sanitize(`
          <div style="display:grid;gap:var(--space-lg)">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div>
                <div style="font-family:var(--font-display);font-size:1.2rem;color:var(--ivory)">${o.orderId}</div>
                <div style="font-family:var(--font-accent);font-size:0.65rem;color:var(--text-muted)">${fmtDate(o.createdAt)}</div>
              </div>
              ${statusBadge(o.status)}
            </div>

            <div class="glass-card" style="padding:var(--space-md)">
              <div style="font-family:var(--font-accent);font-size:0.6rem;color:var(--gold);letter-spacing:0.15em;text-transform:uppercase;margin-bottom:var(--space-md)">Customer</div>
              <div style="font-family:var(--font-accent);font-size:0.8rem;color:var(--ivory)">${o.customerDetails?.name}</div>
              <div style="font-family:var(--font-accent);font-size:0.7rem;color:var(--text-muted)">${o.customerDetails?.email}</div>
              <div style="font-family:var(--font-accent);font-size:0.7rem;color:var(--text-muted)">${o.customerDetails?.phone}</div>
              <div style="font-family:var(--font-body);font-size:0.85rem;color:var(--text-muted);margin-top:var(--space-sm)">${o.customerDetails?.address?.line1}, ${o.customerDetails?.address?.city}, ${o.customerDetails?.address?.pincode}</div>
            </div>

            ${o.items?.map((item, i) => `
            <div style="border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:var(--space-md)">
              <div style="font-family:var(--font-display);font-size:0.9rem;color:var(--ivory);margin-bottom:var(--space-sm)">Shirt ${i+1}</div>
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-sm)">
                ${[['Fabric',item.fabric?.name],['Collar',item.collar?.name],['Cuffs',item.cuffs?.name],['Buttons',item.buttons?.name],['Monogram',item.monogram||'None'],['Size',item.size]].map(([l,v])=>`
                  <div style="text-align:center;border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:0.4rem">
                    <div style="font-family:var(--font-accent);font-size:0.5rem;color:var(--text-muted);text-transform:uppercase">${l}</div>
                    <div style="font-family:var(--font-body);font-size:0.8rem;color:var(--ivory)">${v||'—'}</div>
                  </div>`).join('')}
              </div>
            </div>`).join('') || ''}

            <div style="display:flex;justify-content:space-between;border-top:1px solid var(--border-subtle);padding-top:var(--space-md)">
              <span style="font-family:var(--font-display);font-size:1rem;color:var(--ivory)">Total Paid</span>
              <span style="font-family:var(--font-display);font-size:1.2rem;color:var(--gold)">${fmtINR(o.pricing?.total || 0)}</span>
            </div>

            ${o.shipping?.awb ? `
            <div style="border:1px solid rgba(104,211,145,0.3);border-radius:var(--radius-md);padding:var(--space-md);background:rgba(104,211,145,0.05)">
              <div style="font-family:var(--font-accent);font-size:0.65rem;color:var(--text-muted)">Tracking Number</div>
              <div style="font-family:var(--font-display);font-size:1rem;color:#68d391">${o.shipping.awb}</div>
            </div>` : ''}
          </div>
        `);
        overlay.classList.add('active');
      } catch (err) {
        window.showToast('Error loading order details.', 'error');
      }
    };

    // Status update function
    window.adminActions.openStatusModal = (orderId, currentStatus) => {
      const overlay = document.getElementById('statusModal');
      if (!overlay) return;
      document.getElementById('statusModalOrderId').textContent = orderId;
      document.getElementById('statusSelect').value = currentStatus;
      document.getElementById('statusModal').dataset.orderId = orderId;
      overlay.classList.add('active');
    };

    // Search / Filter
    document.getElementById('orderSearch')?.addEventListener('input', debounce((e) => {
      loadOrders(1, e.target.value, document.getElementById('statusFilter')?.value || '');
    }, 400));

    document.getElementById('statusFilter')?.addEventListener('change', (e) => {
      loadOrders(1, document.getElementById('orderSearch')?.value || '', e.target.value);
    });

    loadOrders();
  };

  // ── Update Order Status ───────────────────────────────────
  const bindStatusModal = () => {
    document.getElementById('saveStatusBtn')?.addEventListener('click', async () => {
      const overlay  = document.getElementById('statusModal');
      const orderId  = overlay?.dataset.orderId;
      const newStatus= document.getElementById('statusSelect')?.value;
      const awb      = document.getElementById('awbInput')?.value.trim();

      if (!orderId || !newStatus) return;

      try {
        const body = { status: newStatus };
        if (awb) body.awb = awb;
        const data = await apiPut(`/orders/${orderId}/status`, body);
        if (!data.success) throw new Error(data.message);
        window.showToast('Order status updated! ✓', 'success');
        overlay.classList.remove('active');
        // Reload page data
        if (document.getElementById('recentOrdersBody')) loadRecentOrders();
        if (document.getElementById('ordersTableBody')) initOrdersPage();
      } catch (err) {
        window.showToast(`Error: ${err.message}`, 'error');
      }
    });
  };

  // ── Debounce ──────────────────────────────────────────────
  const debounce = (fn, wait) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
  };

  // ── Logout ────────────────────────────────────────────────
  const initLogout = () => {
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      } catch (e) { /* silently fail */ }
      sessionStorage.clear();
      window.location.href = 'login.html';
    });
  };

  // ── Modal Close ───────────────────────────────────────────
  const initModalClose = () => {
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.modal-overlay')?.classList.remove('active');
      });
    });
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('active');
      });
    });
  };

  // ── Active Nav Highlighter ────────────────────────────────
  const highlightActiveNav = () => {
    const page = window.location.pathname.split('/').pop();
    document.querySelectorAll('.sidebar-nav__item').forEach(item => {
      const href = (item.getAttribute('href') || '').split('/').pop();
      item.classList.toggle('active', href === page);
    });
  };

  // ── Init ──────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', async () => {
    const currentPage = window.location.pathname.split('/').pop();

    // Skip auth guard on login page
    if (currentPage === 'login.html') return;

    await guardAuth();
    setDateDisplay();
    initLogout();
    initModalClose();
    highlightActiveNav();
    bindStatusModal();

    // Page-specific initialization
    if (currentPage === 'dashboard.html') {
      await Promise.all([loadDashboardStats(), loadRecentOrders(), renderRevenueChart(), loadStockAlerts()]);
      document.getElementById('refreshBtn')?.addEventListener('click', async () => {
        await Promise.all([loadDashboardStats(), loadRecentOrders()]);
        window.showToast('Dashboard refreshed ✓', 'success');
      });
    }

    if (currentPage === 'orders.html') {
      initOrdersPage();
    }

    if (currentPage === 'customers.html') {
      initCustomersPage();
    }

    if (currentPage === 'support.html') {
      initSupportPage();
    }

    if (currentPage === 'analytics.html') {
      initAnalyticsPage();
    }

    if (currentPage === 'fabrics.html') {
      initFabricsPage();
    }

    if (currentPage === 'products.html') {
      initProductsPage();
    }
  });

})();

// ============================================================
// CUSTOMERS PAGE
// ============================================================
(function initCustomersPage() {
  if (!document.getElementById('customersTableBody')) return;

  let currentPage = 1;
  let searchQuery = '';
  const PAGE_SIZE = 20;

  const apiGet = async (path) => {
    const res = await fetch(`/api${path}`, { credentials: 'include' });
    return res.json();
  };
  const apiPut = async (path, body) => {
    const res = await fetch(`/api${path}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
    return res.json();
  };
  const fmtINR  = (n) => `₹${(n||0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const loadCustomers = async () => {
    const tbody = document.getElementById('customersTableBody');
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:2rem;color:var(--text-muted);font-family:var(--font-accent);font-size:0.75rem">Loading...</td></tr>`;
    try {
      const params = new URLSearchParams({ page: currentPage, limit: PAGE_SIZE, ...(searchQuery && { search: searchQuery }) });
      const data = await apiGet(`/customers?${params}`);
      if (!data.success) throw new Error('Failed to load');

      const count = document.getElementById('customerCount');
      if (count) count.textContent = `${data.total} customers`;

      const paginationInfo = document.getElementById('paginationInfo');
      if (paginationInfo) paginationInfo.textContent = `Page ${currentPage} of ${Math.ceil((data.total||1)/PAGE_SIZE)}`;

      if (!data.customers?.length) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:3rem;color:var(--text-muted);font-family:var(--font-accent);font-size:0.75rem">No customers yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = DOMPurify.sanitize(data.customers.map((c, i) => `
        <tr>
          <td style="font-family:var(--font-accent);font-size:0.65rem;color:var(--text-muted)">${((currentPage-1)*PAGE_SIZE)+i+1}</td>
          <td><div style="font-family:var(--font-display);font-size:0.9rem;color:var(--ivory)">${c.name}</div></td>
          <td style="font-family:var(--font-accent);font-size:0.7rem;color:var(--text-muted)">${c.email}</td>
          <td style="font-family:var(--font-accent);font-size:0.7rem">${c.phone||'—'}</td>
          <td style="font-family:var(--font-display);font-size:0.85rem;color:var(--ivory)">${c.totalOrders||0}</td>
          <td style="font-family:var(--font-display);font-size:0.9rem;color:var(--gold)">${fmtINR(c.totalSpent)}</td>
          <td><span class="badge ${c.isBlacklisted ? 'badge--danger' : 'badge--success'}">${c.isBlacklisted ? 'Blacklisted' : 'Active'}</span></td>
          <td style="font-family:var(--font-accent);font-size:0.65rem">${fmtDate(c.createdAt)}</td>
          <td>
            <div class="table-actions">
              <button class="btn-action-view" onclick="openCustomerModal('${c._id}')">View</button>
              <button class="btn-action-edit" onclick="toggleBlacklist('${c._id}', ${c.isBlacklisted})">${c.isBlacklisted ? 'Unblock' : 'Block'}</button>
            </div>
          </td>
        </tr>
      `).join(''));
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:2rem;color:#fc8181;font-family:var(--font-accent);font-size:0.75rem">Error loading customers.</td></tr>`;
    }
  };

  window.openCustomerModal = async (id) => {
    const overlay = document.getElementById('customerModal');
    const body    = document.getElementById('customerModalBody');
    if (!overlay || !body) return;
    body.innerHTML = `<p style="font-family:var(--font-accent);font-size:0.75rem;color:var(--text-muted)">Loading...</p>`;
    overlay.classList.add('active');

    try {
      const data = await apiGet(`/customers/${id}`);
      if (!data.success) throw new Error('Not found');
      const c = data.customer;
      const orders = data.recentOrders || [];

      body.innerHTML = DOMPurify.sanitize(`
        <div style="display:grid;gap:var(--space-lg)">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:var(--space-md)">
            <div>
              <div style="font-family:var(--font-display);font-size:1.4rem;color:var(--ivory)">${c.name}</div>
              <div style="font-family:var(--font-accent);font-size:0.7rem;color:var(--text-muted)">${c.email} · ${c.phone||'—'}</div>
              <div style="font-family:var(--font-accent);font-size:0.65rem;color:var(--text-muted);margin-top:4px">Joined ${fmtDate(c.createdAt)}</div>
            </div>
            <span class="badge ${c.isBlacklisted ? 'badge--danger' : 'badge--success'}" style="font-size:0.7rem">${c.isBlacklisted ? 'Blacklisted' : 'Active Customer'}</span>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--space-md)">
            <div style="text-align:center;border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:var(--space-md)">
              <div style="font-family:var(--font-display);font-size:1.5rem;color:var(--ivory)">${c.totalOrders||0}</div>
              <div style="font-family:var(--font-accent);font-size:0.55rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.1em">Orders</div>
            </div>
            <div style="text-align:center;border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:var(--space-md)">
              <div style="font-family:var(--font-display);font-size:1.5rem;color:var(--gold)">${fmtINR(c.totalSpent)}</div>
              <div style="font-family:var(--font-accent);font-size:0.55rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.1em">Total Spent</div>
            </div>
            <div style="text-align:center;border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:var(--space-md)">
              <div style="font-family:var(--font-display);font-size:1.5rem;color:var(--ivory)">${fmtINR((c.totalOrders||0) > 0 ? Math.round(c.totalSpent/c.totalOrders) : 0)}</div>
              <div style="font-family:var(--font-accent);font-size:0.55rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.1em">Avg Spend</div>
            </div>
          </div>

          ${c.addresses?.length ? `
          <div style="border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:var(--space-md)">
            <div style="font-family:var(--font-accent);font-size:0.6rem;color:var(--gold);letter-spacing:0.15em;text-transform:uppercase;margin-bottom:var(--space-sm)">Saved Address</div>
            <div style="font-family:var(--font-body);color:var(--text-muted);font-size:0.85rem;line-height:1.6">${c.addresses[0].line1}${c.addresses[0].line2 ? ', '+c.addresses[0].line2 : ''}, ${c.addresses[0].city}, ${c.addresses[0].state} — ${c.addresses[0].pincode}</div>
          </div>` : ''}

          ${orders.length ? `
          <div>
            <div style="font-family:var(--font-accent);font-size:0.6rem;color:var(--gold);letter-spacing:0.15em;text-transform:uppercase;margin-bottom:var(--space-md)">Recent Orders</div>
            ${orders.map(o => `
              <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border-subtle);padding:0.5rem 0">
                <div>
                  <div style="font-family:var(--font-display);font-size:0.85rem;color:var(--ivory)">${o.orderId}</div>
                  <div style="font-family:var(--font-accent);font-size:0.6rem;color:var(--text-muted)">${fmtDate(o.createdAt)}</div>
                </div>
                <div style="text-align:right">
                  <div style="font-family:var(--font-display);font-size:0.9rem;color:var(--gold)">${fmtINR(o.totalAmount||0)}</div>
                  <span class="badge" style="font-size:0.55rem">${(o.orderStatus||'').replace(/_/g,' ')}</span>
                </div>
              </div>
            `).join('')}
          </div>` : ''}

          ${c.isBlacklisted && c.blacklistReason ? `
          <div style="background:rgba(252,129,129,0.08);border:1px solid rgba(252,129,129,0.2);border-radius:var(--radius-md);padding:var(--space-md)">
            <div style="font-family:var(--font-accent);font-size:0.6rem;color:#fc8181;margin-bottom:4px">Blacklist Reason</div>
            <div style="font-family:var(--font-body);color:var(--ivory);font-size:0.85rem">${c.blacklistReason}</div>
          </div>` : ''}

          ${c.internalNotes ? `
          <div style="border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:var(--space-md)">
            <div style="font-family:var(--font-accent);font-size:0.6rem;color:var(--gold);margin-bottom:4px">Internal Notes</div>
            <div style="font-family:var(--font-body);color:var(--text-muted);font-size:0.85rem">${c.internalNotes}</div>
          </div>` : ''}
        </div>
      `);
    } catch (err) {
      body.innerHTML = `<p style="color:#fc8181;font-family:var(--font-accent);font-size:0.75rem">Could not load customer details.</p>`;
    }
  };

  window.toggleBlacklist = async (id, isBlacklisted) => {
    const reason = isBlacklisted ? '' : (prompt('Reason for blacklisting (required):') || '').trim();
    if (!isBlacklisted && !reason) { window.showToast('Reason is required to blacklist.', 'error'); return; }
    try {
      const data = await apiPut(`/customers/${id}/blacklist`, { blacklist: !isBlacklisted, reason });
      if (data.success) { window.showToast(isBlacklisted ? 'Customer unblocked ✓' : 'Customer blacklisted ✓', 'success'); loadCustomers(); }
      else throw new Error(data.message);
    } catch (err) { window.showToast(`Error: ${err.message}`, 'error'); }
  };

  // Search
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  document.getElementById('customerSearch')?.addEventListener('input', debounce((e) => { searchQuery = e.target.value; currentPage = 1; loadCustomers(); }, 400));

  // Modal close
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.modal-overlay')?.classList.remove('active'));
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('active'); });
  });

  loadCustomers();
})();

// ============================================================
// SUPPORT PAGE
// ============================================================
(function initSupportPage() {
  if (!document.getElementById('ticketsTableBody')) return;

  const apiGet = async (path) => { const res = await fetch(`/api${path}`, { credentials: 'include' }); return res.json(); };
  const apiPut = async (path, body) => { const res = await fetch(`/api${path}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) }); return res.json(); };
  const apiPost = async (path, body) => { const res = await fetch(`/api${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) }); return res.json(); };
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const priorityBadge = (p) => {
    const map = { low: 'badge--neutral', medium: 'badge--gold', high: 'badge--warning', urgent: 'badge--danger' };
    return `<span class="badge ${map[p]||'badge--neutral'}">${p||'—'}</span>`;
  };
  const statusBadge = (s) => {
    const map = { open: 'badge--warning', in_progress: 'badge--gold', resolved: 'badge--success', closed: 'badge--neutral' };
    return `<span class="badge ${map[s]||'badge--neutral'}">${(s||'').replace(/_/g,' ')}</span>`;
  };

  const loadTickets = async () => {
    const tbody = document.getElementById('ticketsTableBody');
    const status   = document.getElementById('ticketStatusFilter')?.value   || '';
    const priority = document.getElementById('ticketPriorityFilter')?.value || '';
    const count    = document.getElementById('ticketCount');

    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;font-family:var(--font-accent);font-size:0.75rem;color:var(--text-muted)">Loading...</td></tr>`;
    try {
      const params = new URLSearchParams({ ...(status && { status }), ...(priority && { priority }) });
      const data   = await apiGet(`/support/tickets?${params}`);
      if (!data.success) throw new Error('Failed');
      if (count) count.textContent = `${data.total||0} tickets`;

      if (!data.tickets?.length) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:3rem;color:var(--text-muted);font-family:var(--font-accent);font-size:0.75rem">No tickets found.</td></tr>`;
        return;
      }

      tbody.innerHTML = DOMPurify.sanitize(data.tickets.map(t => `
        <tr>
          <td><span class="table-id">${t.ticketId||t._id?.slice(-6)}</span></td>
          <td>
            <div style="font-family:var(--font-body);font-size:0.85rem;color:var(--ivory)">${t.customerName||'—'}</div>
            <div style="font-family:var(--font-accent);font-size:0.6rem;color:var(--text-muted)">${t.customerEmail||''}</div>
          </td>
          <td style="font-family:var(--font-body);font-size:0.8rem;color:var(--ivory);max-width:200px">${t.subject||'—'}</td>
          <td style="font-family:var(--font-accent);font-size:0.7rem">${(t.type||'general').replace(/_/g,' ')}</td>
          <td>${priorityBadge(t.priority)}</td>
          <td>${statusBadge(t.status)}</td>
          <td style="font-family:var(--font-accent);font-size:0.65rem">${fmtDate(t.createdAt)}</td>
          <td>
            <div class="table-actions">
              <button class="btn-action-view" onclick="openTicketModal('${t._id}')">View</button>
            </div>
          </td>
        </tr>
      `).join(''));
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:#fc8181;font-family:var(--font-accent);font-size:0.75rem">Error: ${err.message}</td></tr>`;
    }
  };

  window.openTicketModal = async (id) => {
    const overlay = document.getElementById('ticketModal');
    const body    = document.getElementById('ticketModalBody');
    if (!overlay || !body) return;
    body.innerHTML = `<p style="font-family:var(--font-accent);font-size:0.75rem;color:var(--text-muted)">Loading...</p>`;
    overlay.classList.add('active');

    try {
      const data = await apiGet(`/support/tickets/${id}`);
      if (!data.success) throw new Error('Not found');
      const t = data.ticket;
      const messages = t.messages || [];

      body.innerHTML = DOMPurify.sanitize(`
        <div style="display:grid;gap:var(--space-lg)">
          <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:var(--space-md)">
            <div>
              <div style="font-family:var(--font-display);font-size:1.1rem;color:var(--ivory)">${t.subject}</div>
              <div style="font-family:var(--font-accent);font-size:0.65rem;color:var(--text-muted)">${t.customerName} · ${t.customerEmail}</div>
            </div>
            <div style="display:flex;gap:var(--space-sm);align-items:center">
              ${priorityBadge(t.priority)}
              ${statusBadge(t.status)}
            </div>
          </div>

          ${t.orderId ? `<div style="font-family:var(--font-accent);font-size:0.7rem;color:var(--gold)">Linked Order: <strong>${t.orderId}</strong></div>` : ''}

          <div style="max-height:280px;overflow-y:auto;display:grid;gap:var(--space-md)">
            ${messages.map(m => `
              <div style="border-left:3px solid ${m.sender==='admin' ? 'var(--gold)' : 'var(--border-subtle)'};padding:var(--space-sm) var(--space-md);background:${m.sender==='admin' ? 'rgba(212,175,55,0.05)' : 'transparent'}">
                <div style="font-family:var(--font-accent);font-size:0.55rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px">${m.sender==='admin' ? 'Support Team' : t.customerName} · ${fmtDate(m.createdAt)}</div>
                <div style="font-family:var(--font-body);font-size:0.85rem;color:var(--ivory);white-space:pre-wrap">${m.content}</div>
              </div>
            `).join('')}
            ${messages.length === 0 ? `<p style="font-family:var(--font-accent);font-size:0.75rem;color:var(--text-muted)">No messages yet.</p>` : ''}
          </div>

          ${t.status !== 'closed' ? `
          <div style="border-top:1px solid var(--border-subtle);padding-top:var(--space-lg)">
            <div style="font-family:var(--font-accent);font-size:0.6rem;color:var(--gold);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:var(--space-sm)">Reply to Customer</div>
            <textarea id="ticketReply" style="width:100%;background:var(--navy);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:var(--space-md);color:var(--ivory);font-family:var(--font-body);font-size:0.85rem;resize:vertical;min-height:100px;box-sizing:border-box" placeholder="Type your reply..."></textarea>
            <div style="display:flex;gap:var(--space-md);margin-top:var(--space-md)">
              <select id="ticketStatusUpdate" style="background:var(--navy);border:1px solid var(--border-subtle);color:var(--ivory);font-family:var(--font-accent);font-size:0.7rem;padding:0.5rem;border-radius:var(--radius-md);flex:1">
                <option value="${t.status}">${t.status} (no change)</option>
                <option value="in_progress">Mark In Progress</option>
                <option value="resolved">Mark Resolved</option>
                <option value="closed">Close Ticket</option>
              </select>
              <button class="btn btn--primary" onclick="sendTicketReply('${t._id}')">Send Reply</button>
            </div>
          </div>` : `<div style="text-align:center;font-family:var(--font-accent);font-size:0.75rem;color:var(--text-muted)">This ticket is closed.</div>`}
        </div>
      `);
    } catch (err) {
      body.innerHTML = `<p style="color:#fc8181;font-family:var(--font-accent);font-size:0.75rem">Could not load ticket.</p>`;
    }
  };

  window.sendTicketReply = async (id) => {
    const reply  = document.getElementById('ticketReply')?.value.trim();
    const status = document.getElementById('ticketStatusUpdate')?.value;
    if (!reply) { window.showToast('Please type a reply.', 'error'); return; }
    try {
      const data = await apiPost(`/support/tickets/${id}/reply`, { message: reply, status });
      if (!data.success) throw new Error(data.message);
      window.showToast('Reply sent ✓', 'success');
      document.getElementById('ticketModal')?.classList.remove('active');
      loadTickets();
    } catch (err) { window.showToast(`Error: ${err.message}`, 'error'); }
  };

  document.getElementById('ticketStatusFilter')?.addEventListener('change', loadTickets);
  document.getElementById('ticketPriorityFilter')?.addEventListener('change', loadTickets);

  document.querySelectorAll('.modal-close').forEach(btn => { btn.addEventListener('click', () => btn.closest('.modal-overlay')?.classList.remove('active')); });
  document.querySelectorAll('.modal-overlay').forEach(overlay => { overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('active'); }); });

  loadTickets();
})();

// ============================================================
// ANALYTICS PAGE
// ============================================================
(function initAnalyticsPage() {
  if (!document.getElementById('kpiRow')) return;

  const apiGet = async (path) => { const res = await fetch(`/api${path}`, { credentials: 'include' }); return res.json(); };
  const fmtINR = (n) => `₹${Math.round(n||0).toLocaleString('en-IN')}`;

  const STATUS_COLORS = {
    received:       '#D4AF37',
    in_production:  '#F6E05E',
    quality_check:  '#90CDF4',
    dispatched:     '#68D391',
    delivered:      '#48BB78',
    cancelled:      '#FC8181',
    refunded:       '#A0AEC0',
  };

  const loadAnalytics = async () => {
    const days    = parseInt(document.getElementById('periodFilter')?.value || '30');
    const period  = days === 7 ? 'week' : days === 90 ? 'quarter' : 'month';
    const periodLabel = `Last ${days} days`;
    const subtitle = document.getElementById('chartSubtitle');
    const kpiPeriodLabel = document.getElementById('kpi-period-label');
    if (subtitle) subtitle.textContent = periodLabel;
    if (kpiPeriodLabel) kpiPeriodLabel.textContent = periodLabel;

    try {
      // Load all data in parallel
      const [statsData, chartData, statusData, fabricData] = await Promise.all([
        apiGet(`/payment/stats?period=${period}`),
        apiGet(`/analytics/revenue?period=${days}`),
        apiGet('/analytics/order-status'),
        apiGet('/analytics/top-fabrics?limit=5'),
      ]);

      // KPI Row
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      if (statsData.success) {
        const s = statsData.stats;
        set('kpi-revenue', fmtINR(s.totalRevenue));
        set('kpi-period',  fmtINR(s.totalRevenue));
        set('kpi-aov',     fmtINR(s.avgOrderValue));
        set('kpi-gst',     fmtINR(s.totalGST));
      }

      // Revenue Bar Chart
      const chart = document.getElementById('revenueBarChart');
      if (chart && chartData.success) {
        const days_arr = chartData.data || [];
        const max = Math.max(...days_arr.map(d => d.revenue), 1);
        chart.innerHTML = DOMPurify.sanitize(days_arr.map(day => {
          const pct = Math.max(2, Math.round((day.revenue / max) * 100));
          const label = new Date(day.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
          return `
            <div class="chart-bar-col" title="${fmtINR(day.revenue)} on ${label}">
              <div class="chart-bar" style="height:${pct}%;opacity:${day.revenue > 0 ? 1 : 0.3}"></div>
              <div class="chart-bar-label">${label}</div>
            </div>
          `;
        }).join('') || `<p style="font-family:var(--font-accent);font-size:0.75rem;color:var(--text-muted);align-self:center;width:100%;text-align:center">No revenue data yet.</p>`);
      }

      // Status Donut
      const legendEl  = document.getElementById('statusLegend');
      const donutEl   = document.getElementById('statusDonut');
      const centerEl  = document.getElementById('donutCenter');
      if (legendEl && statusData.success) {
        const statuses = statusData.breakdown || [];
        const total    = statuses.reduce((sum, s) => sum + s.count, 0);
        if (centerEl) centerEl.textContent = total;

        // Draw SVG arcs
        let offset = 0;
        const cx = 60, cy = 60, r = 52, circ = 2 * Math.PI * r;
        const arcs = statuses.map(s => {
          const pct  = total > 0 ? s.count / total : 0;
          const dash = pct * circ;
          const arc  = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${STATUS_COLORS[s._id]||'#4A5568'}" stroke-width="16" stroke-dasharray="${dash} ${circ-dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"/>`;
          offset += dash;
          return arc;
        }).join('');
        if (donutEl) donutEl.innerHTML = DOMPurify.sanitize(`${arcs}<text x="${cx}" y="${cy+5}" text-anchor="middle" font-family="var(--font-display)" font-size="14" fill="var(--gold)">${total}</text>`, { USE_PROFILES: { html: true, svg: true } });

        legendEl.innerHTML = DOMPurify.sanitize(statuses.map(s => `
          <div class="donut-legend-item">
            <div class="donut-legend-dot" style="background:${STATUS_COLORS[s._id]||'#4A5568'}"></div>
            <span class="donut-legend-label">${(s._id||'unknown').replace(/_/g,' ')}</span>
            <span class="donut-legend-pct">${s.count}</span>
          </div>
        `).join('') || `<p style="font-family:var(--font-accent);font-size:0.75rem;color:var(--text-muted)">No orders yet.</p>`);
      }

      // Top Fabrics
      const fabricsEl = document.getElementById('topFabrics');
      if (fabricsEl && fabricData.success) {
        const fabrics = fabricData.data || [];
        const maxCount = Math.max(...fabrics.map(f => f.count), 1);
        fabricsEl.innerHTML = DOMPurify.sanitize(fabrics.map(f => `
          <div style="margin-bottom:var(--space-md)">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="font-family:var(--font-body);font-size:0.8rem;color:var(--ivory)">${f.name||f._id}</span>
              <span style="font-family:var(--font-accent);font-size:0.7rem;color:var(--gold)">${f.count} orders</span>
            </div>
            <div style="height:6px;background:var(--border-subtle);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${Math.round((f.count/maxCount)*100)}%;background:linear-gradient(to right,var(--gold),var(--gold-light));border-radius:3px;transition:width 0.6s ease"></div>
            </div>
          </div>
        `).join('') || `<p style="font-family:var(--font-accent);font-size:0.75rem;color:var(--text-muted)">No fabric data yet.</p>`);
      }

    } catch (err) {
      console.error('Analytics load error:', err);
    }
  };

  // Export CSV
  document.getElementById('exportBtn')?.addEventListener('click', async () => {
    try {
      const data = await apiGet('/orders?limit=1000&format=csv-data');
      if (!data.success || !data.orders?.length) { window.showToast('No orders to export.', 'error'); return; }
      const fmtD = (d) => new Date(d).toLocaleDateString('en-IN');
      const rows = [
        ['Order ID','Customer','Email','Phone','Amount','Status','Date'],
        ...data.orders.map(o => [o.orderId,o.customerDetails?.name,o.customerDetails?.email,o.customerDetails?.phone,o.totalAmount||0,o.orderStatus||'',fmtD(o.createdAt)])
      ];
      const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `specialone-orders-${Date.now()}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { window.showToast('Export failed.', 'error'); }
  });

  document.getElementById('periodFilter')?.addEventListener('change', loadAnalytics);
  loadAnalytics();
})();

// ============================================================
// FABRICS PAGE
// ============================================================
(function initFabricsPage() {
  if (!document.getElementById('fabricsTableBody')) return;

  const apiGet    = async (path) => { const res = await fetch(`/api${path}`, { credentials: 'include' }); return res.json(); };
  const apiPost   = async (path, body) => { const res = await fetch(`/api${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) }); return res.json(); };
  const apiPut    = async (path, body) => { const res = await fetch(`/api${path}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) }); return res.json(); };
  const apiDelete = async (path) => { const res = await fetch(`/api${path}`, { method: 'DELETE', credentials: 'include' }); return res.json(); };

  let deleteTarget = null;

  const loadFabrics = async () => {
    const tbody  = document.getElementById('fabricsTableBody');
    const search = document.getElementById('fabricSearch')?.value || '';
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;font-family:var(--font-accent);font-size:0.75rem;color:var(--text-muted)">Loading...</td></tr>`;
    try {
      const params = new URLSearchParams({ ...(search && { search }) });
      const data   = await apiGet(`/products/fabrics?${params}`);
      if (!data.success) throw new Error('Failed');

      if (!data.fabrics?.length) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:3rem;color:var(--text-muted);font-family:var(--font-accent);font-size:0.75rem">No fabrics found. Click "+ Add Fabric" to create one.</td></tr>`;
        return;
      }

      tbody.innerHTML = DOMPurify.sanitize(data.fabrics.map(f => `
        <tr>
          <td style="font-family:var(--font-display);font-size:0.9rem;color:var(--ivory)">${f.name}</td>
          <td style="font-family:var(--font-accent);font-size:0.7rem;text-transform:capitalize">${f.type||'—'}</td>
          <td>
            <div style="display:flex;align-items:center;gap:var(--space-sm)">
              <div style="width:20px;height:20px;border-radius:50%;background:${f.color||'#333'};border:1px solid var(--border-subtle)"></div>
              <span style="font-family:var(--font-accent);font-size:0.65rem;color:var(--text-muted)">${f.color||'—'}</span>
            </div>
          </td>
          <td>
            <div style="display:flex;align-items:center;gap:var(--space-sm)">
              <span style="font-family:var(--font-display);font-size:0.9rem;color:${(f.stockQuantity||0)<=(f.lowStockThreshold||10) ? '#fc8181' : 'var(--ivory)'}">${f.stockQuantity||0}</span>
              ${(f.stockQuantity||0)<=(f.lowStockThreshold||10) ? '<span style="font-size:0.65rem">⚠️</span>' : ''}
            </div>
          </td>
          <td style="font-family:var(--font-accent);font-size:0.7rem">${f.lowStockThreshold||10}</td>
          <td>
            <span class="badge ${f.stockStatus==='out_of_stock' ? 'badge--danger' : f.stockStatus==='low_stock' ? 'badge--warning' : 'badge--success'}">
              ${(f.stockStatus||'in_stock').replace(/_/g,' ')}
            </span>
          </td>
          <td><span class="badge ${f.isAvailable ? 'badge--success' : 'badge--neutral'}">${f.isAvailable ? 'Visible' : 'Hidden'}</span></td>
          <td>
            <div class="table-actions">
              <button class="btn-action-edit" onclick="openFabricModal('${f._id}')">Edit</button>
              <button class="btn-action-view" style="color:#fc8181" onclick="confirmDeleteFabric('${f._id}','${f.name}')">Delete</button>
            </div>
          </td>
        </tr>
      `).join(''));
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:#fc8181;font-family:var(--font-accent);font-size:0.75rem">Error loading fabrics.</td></tr>`;
    }
  };

  window.openFabricModal = async (id = null) => {
    const overlay = document.getElementById('fabricModal');
    const title   = document.getElementById('fabricModalTitle');
    if (!overlay) return;

    // Reset form
    document.getElementById('fabricId').value = '';
    document.getElementById('fabricName').value = '';
    document.getElementById('fabricType').value = '';
    document.getElementById('fabricDescription').value = '';
    document.getElementById('fabricColor').value = '#1C1C2E';
    document.getElementById('fabricColorPicker').value = '#1C1C2E';
    document.getElementById('fabricStock').value = '';
    document.getElementById('fabricThreshold').value = '10';
    document.getElementById('fabricTags').value = '';
    document.getElementById('fabricAvailable').checked = true;
    const errEl = document.getElementById('fabricFormError');
    if (errEl) errEl.style.display = 'none';

    if (id) {
      if (title) title.textContent = 'Edit Fabric';
      try {
        const data = await apiGet(`/products/fabrics/${id}`);
        if (data.success && data.fabric) {
          const f = data.fabric;
          document.getElementById('fabricId').value = f._id;
          document.getElementById('fabricName').value = f.name || '';
          document.getElementById('fabricType').value = f.type || '';
          document.getElementById('fabricDescription').value = f.description || '';
          document.getElementById('fabricColor').value = f.color || '#1C1C2E';
          document.getElementById('fabricColorPicker').value = f.color || '#1C1C2E';
          document.getElementById('fabricStock').value = f.stockQuantity ?? '';
          document.getElementById('fabricThreshold').value = f.lowStockThreshold ?? 10;
          document.getElementById('fabricTags').value = (f.tags||[]).join(', ');
          document.getElementById('fabricAvailable').checked = f.isAvailable !== false;
        }
      } catch (err) { console.error(err); }
    } else {
      if (title) title.textContent = 'Add Fabric';
    }

    overlay.classList.add('active');
  };

  // Color picker sync
  document.getElementById('fabricColorPicker')?.addEventListener('input', (e) => {
    const inp = document.getElementById('fabricColor');
    if (inp) inp.value = e.target.value;
  });
  document.getElementById('fabricColor')?.addEventListener('input', (e) => {
    const picker = document.getElementById('fabricColorPicker');
    if (picker && /^#[0-9A-Fa-f]{6}$/.test(e.target.value)) picker.value = e.target.value;
  });

  // Save fabric
  document.getElementById('fabricForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl  = document.getElementById('fabricFormError');
    const btn    = document.getElementById('saveFabricBtn');
    const id     = document.getElementById('fabricId').value.trim();
    const name   = document.getElementById('fabricName').value.trim();
    const type   = document.getElementById('fabricType').value;
    const stock  = parseInt(document.getElementById('fabricStock').value);

    if (!name || !type || isNaN(stock)) {
      if (errEl) { errEl.textContent = 'Name, type, and stock are required.'; errEl.style.display = 'block'; }
      return;
    }

    const body = {
      name,
      type,
      description: document.getElementById('fabricDescription').value.trim(),
      color:         document.getElementById('fabricColor').value.trim(),
      stockQuantity: stock,
      lowStockThreshold: parseInt(document.getElementById('fabricThreshold').value) || 10,
      tags: document.getElementById('fabricTags').value.split(',').map(t => t.trim()).filter(Boolean),
      isAvailable: document.getElementById('fabricAvailable').checked,
    };

    try {
      if (btn) btn.textContent = 'Saving...';
      const data = id ? await apiPut(`/products/fabrics/${id}`, body) : await apiPost('/products/fabrics', body);
      if (!data.success) throw new Error(data.message || 'Save failed');
      window.showToast(`Fabric ${id ? 'updated' : 'added'} ✓`, 'success');
      document.getElementById('fabricModal')?.classList.remove('active');
      loadFabrics();
    } catch (err) {
      if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; }
    } finally {
      if (btn) btn.textContent = 'Save Fabric';
    }
  });

  window.confirmDeleteFabric = (id, name) => {
    deleteTarget = id;
    const nameEl = document.getElementById('deleteFabricName');
    if (nameEl) nameEl.textContent = name;
    document.getElementById('deleteFabricModal')?.classList.add('active');
  };

  document.getElementById('confirmDeleteFabricBtn')?.addEventListener('click', async () => {
    if (!deleteTarget) return;
    try {
      const data = await apiDelete(`/products/fabrics/${deleteTarget}`);
      if (!data.success) throw new Error(data.message);
      window.showToast('Fabric deleted ✓', 'success');
      document.getElementById('deleteFabricModal')?.classList.remove('active');
      deleteTarget = null;
      loadFabrics();
    } catch (err) { window.showToast(`Error: ${err.message}`, 'error'); }
  });

  document.getElementById('addFabricBtn')?.addEventListener('click', () => openFabricModal(null));

  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  document.getElementById('fabricSearch')?.addEventListener('input', debounce(loadFabrics, 350));

  document.querySelectorAll('.modal-close').forEach(btn => { btn.addEventListener('click', () => btn.closest('.modal-overlay')?.classList.remove('active')); });
  document.querySelectorAll('.modal-overlay').forEach(overlay => { overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('active'); }); });

  loadFabrics();
})();

// ============================================================
// PRODUCTS PAGE
// ============================================================
(function initProductsPage() {
  if (!document.getElementById('collarList')) return;

  const CUSTOMIZER_OPTIONS = {
    collar:  [
      { id: 'spread', name: 'Spread Collar', desc: 'Classic wide spread — professional & versatile' },
      { id: 'mandarin', name: 'Mandarin Collar', desc: 'Elegant collarless stand — modern luxe' },
      { id: 'button_down', name: 'Button-Down', desc: 'Casual yet polished, secured collar points' },
      { id: 'cutaway', name: 'Cutaway Collar', desc: 'Wide angle spread — ultra contemporary' },
    ],
    cuff: [
      { id: 'barrel', name: 'Barrel Cuff', desc: 'Classic single button — everyday elegance' },
      { id: 'french', name: 'French Cuff', desc: 'Double fold — wear with cufflinks for formal events' },
      { id: 'convertible', name: 'Convertible Cuff', desc: 'Versatile — barrel or cufflink, your choice' },
    ],
    button: [
      { id: 'white_mop', name: 'White MOP', desc: 'Pearl white mother-of-pearl — refined classic' },
      { id: 'black_mop', name: 'Black MOP', desc: 'Dark mother-of-pearl — sophisticated evenings' },
      { id: 'gold_metal', name: 'Gold Metal', desc: 'Brushed gold — statement luxury detailing' },
      { id: 'silver_metal', name: 'Silver Metal', desc: 'Polished silver — clean modern finish' },
    ],
  };

  const renderOptionList = (containerId, type) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    const options = CUSTOMIZER_OPTIONS[type] || [];
    container.innerHTML = DOMPurify.sanitize(options.map(opt => `
      <div style="display:flex;align-items:center;justify-content:space-between;border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:var(--space-sm) var(--space-md);margin-bottom:var(--space-sm)">
        <div>
          <div style="font-family:var(--font-body);font-size:0.85rem;color:var(--ivory)">${opt.name}</div>
          <div style="font-family:var(--font-accent);font-size:0.6rem;color:var(--text-muted)">${opt.desc}</div>
        </div>
        <span class="badge badge--success" style="font-size:0.55rem">Active</span>
      </div>
    `).join('') || `<p style="font-family:var(--font-accent);font-size:0.75rem;color:var(--text-muted)">No options configured.</p>`);
  };

  renderOptionList('collarList', 'collar');
  renderOptionList('cuffList', 'cuff');
  renderOptionList('buttonList', 'button');

  // Add option modal handlers
  ['addCollarBtn','addCuffBtn','addButtonBtn'].forEach((btnId, i) => {
    const types = ['collar','cuff','button'];
    document.getElementById(btnId)?.addEventListener('click', () => {
      const overlay = document.getElementById('optionModal');
      const title   = document.getElementById('optionModalTitle');
      const typeEl  = document.getElementById('optionType');
      if (!overlay) return;
      document.getElementById('optionName').value = '';
      document.getElementById('optionDesc').value = '';
      if (title) title.textContent = `Add ${types[i].charAt(0).toUpperCase()+types[i].slice(1)} Option`;
      if (typeEl) typeEl.value = types[i];
      overlay.classList.add('active');
    });
  });

  document.getElementById('optionForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('optionName')?.value.trim();
    const type = document.getElementById('optionType')?.value;
    if (!name) return;
    window.showToast(`${type} option "${name}" added. Update customizer.js to make it live.`, 'success');
    document.getElementById('optionModal')?.classList.remove('active');
  });

  document.querySelectorAll('.modal-close').forEach(btn => { btn.addEventListener('click', () => btn.closest('.modal-overlay')?.classList.remove('active')); });
  document.querySelectorAll('.modal-overlay').forEach(overlay => { overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('active'); }); });
})();


// -- Mobile Sidebar Drawer Toggle ---------------------------
(function() {
  'use strict';
  const initMobileSidebar = () => {
    const menuBtn = document.getElementById('adminMenuBtn');
    const sidebar = document.getElementById('adminSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (!menuBtn || !sidebar) return;
    const open = () => { sidebar.classList.add('sidebar--open'); overlay && overlay.classList.add('active'); menuBtn.classList.add('open'); menuBtn.setAttribute('aria-expanded','true'); document.body.style.overflow='hidden'; };
    const close = () => { sidebar.classList.remove('sidebar--open'); overlay && overlay.classList.remove('active'); menuBtn.classList.remove('open'); menuBtn.setAttribute('aria-expanded','false'); document.body.style.overflow=''; };
    menuBtn.addEventListener('click', () => sidebar.classList.contains('sidebar--open') ? close() : open());
    overlay && overlay.addEventListener('click', close);
    sidebar.querySelectorAll('.sidebar-nav__item').forEach(i => i.addEventListener('click', close));
    document.addEventListener('keydown', e => { if (e.key==='Escape') close(); });
  };
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initMobileSidebar); } else { initMobileSidebar(); }
})();
