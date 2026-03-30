const fs = require('fs');
const pages = ['orders', 'customers', 'fabrics', 'products', 'support', 'analytics'];
pages.forEach(p => {
  const path = 'admin/' + p + '.html';
  let html = fs.readFileSync(path, 'utf8');
  if (!html.includes('sidebarOverlay')) {
    // Add overlay before admin-layout
    html = html.replace(
      '<div class="admin-layout">',
      '<div class="sidebar-overlay" id="sidebarOverlay"></div>\n<div class="admin-layout">'
    );
    // Add id to sidebar aside
    html = html.replace(
      '<aside class="admin-sidebar"',
      '<aside class="admin-sidebar" id="adminSidebar"'
    );
    // Add hamburger button as first child of topbar
    html = html.replace(
      '<header class="admin-topbar">',
      '<header class="admin-topbar">\n      <button class="admin-menu-btn" id="adminMenuBtn" aria-label="Toggle navigation" aria-expanded="false"><span></span><span></span><span></span></button>'
    );
    fs.writeFileSync(path, html, 'utf8');
    console.log('Updated: ' + path);
  } else {
    console.log('Already done: ' + path);
  }
});
