// ============================================================
// GLOBAL JS — Special One
// ============================================================
// This file runs on EVERY page. It handles:
// 1. Gold cursor trail
// 2. Scroll reveal (fade-up animations)
// 3. Navigation (sticky + mobile menu)
// 4. Promo banner (show/hide with localStorage)
// 5. Page transitions
// 6. Toast notifications
// 7. Active nav link
// ============================================================

(function () {
  'use strict';

  // ── 1. Gold Cursor ──────────────────────────────────────────
  // Creates a custom gold dot + ring that follows the mouse.
  // Only runs on non-touch devices.
  const initCursor = () => {
    if (window.matchMedia('(hover: none)').matches) return; // Skip on mobile/touch

    const dot  = document.getElementById('cursor-dot');
    const ring = document.getElementById('cursor-ring');
    if (!dot || !ring) return;

    let mouseX = 0, mouseY = 0;
    let ringX   = 0, ringY   = 0;
    let rafId;

    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      dot.style.left = mouseX + 'px';
      dot.style.top  = mouseY + 'px';
    });

    // The ring follows with a slight lag — makes it feel luxurious
    const animateRing = () => {
      ringX += (mouseX - ringX) * 0.12;
      ringY += (mouseY - ringY) * 0.12;
      ring.style.left = ringX + 'px';
      ring.style.top  = ringY + 'px';
      rafId = requestAnimationFrame(animateRing);
    };
    animateRing();

    // Cursor state changes for interactive elements
    const interactives = document.querySelectorAll('a, button, [role="button"], input, select, textarea, .cursor-pointer');
    interactives.forEach(el => {
      el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
      el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
    });

    document.addEventListener('mousedown', () => document.body.classList.add('cursor-click'));
    document.addEventListener('mouseup',   () => document.body.classList.remove('cursor-click'));
    document.addEventListener('mouseleave', () => { dot.style.opacity = '0'; ring.style.opacity = '0'; });
    document.addEventListener('mouseenter', () => { dot.style.opacity = '1'; ring.style.opacity = '0.7'; });
  };

  // ── 2. Scroll Reveal ─────────────────────────────────────────
  // Elements with class "reveal" fade up when they enter the viewport.
  const initScrollReveal = () => {
    const elements = document.querySelectorAll('.reveal');
    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            // Once revealed, we stop observing it
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    elements.forEach(el => observer.observe(el));
  };

  // ── 3. Navigation ─────────────────────────────────────────────
  const initNav = () => {
    const nav  = document.querySelector('.nav');
    const hamburger = document.querySelector('.nav__hamburger');
    const links     = document.querySelector('.nav__links');
    if (!nav) return;

    // Sticky: add class when scrolled past 80px
    const handleScroll = () => {
      nav.classList.toggle('nav--scrolled', window.scrollY > 80);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    // Mobile hamburger toggle
    if (hamburger && links) {
      hamburger.addEventListener('click', () => {
        links.classList.toggle('nav__links--open');
        const bars = hamburger.querySelectorAll('span');
        const isOpen = links.classList.contains('nav__links--open');
        if (isOpen) {
          bars[0].style.transform = 'translateY(6.5px) rotate(45deg)';
          bars[1].style.opacity = '0';
          bars[2].style.transform = 'translateY(-6.5px) rotate(-45deg)';
        } else {
          bars[0].style.transform = '';
          bars[1].style.opacity = '';
          bars[2].style.transform = '';
        }
      });

      // Close menu on link click
      links.querySelectorAll('.nav__link').forEach(link => {
        link.addEventListener('click', () => {
          links.classList.remove('nav__links--open');
        });
      });
    }

    // Highlight active nav link based on current page
    const currentPath = window.location.pathname;
    document.querySelectorAll('.nav__link').forEach(link => {
      const href = link.getAttribute('href') || '';
      if (href && currentPath.endsWith(href)) {
        link.style.color = 'var(--ivory)';
        link.style.setProperty('--underline-width', '100%');
      }
    });
  };

  // ── 4. Promo Banner ───────────────────────────────────────────
  const initPromoBanner = () => {
    const banner = document.querySelector('.promo-banner');
    const closeBtn = document.querySelector('.promo-banner__close');
    if (!banner || !closeBtn) return;

    // If user already dismissed it, hide immediately
    if (localStorage.getItem('so-promo-dismissed') === '1') {
      banner.classList.add('hidden');
      return;
    }

    closeBtn.addEventListener('click', () => {
      banner.classList.add('hidden');
      localStorage.setItem('so-promo-dismissed', '1');
    });
  };

  // ── 5. Page Transitions ───────────────────────────────────────
  const initPageTransitions = () => {
    const overlay = document.getElementById('page-transition');
    if (!overlay) return;

    // Fade in on page load
    overlay.classList.remove('active');

    // Fade out on internal link clicks
    document.querySelectorAll('a[href]').forEach(link => {
      const href = link.getAttribute('href');
      // Only intercept same-origin, non-anchor links
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto') || href.startsWith('tel')) return;
      if (link.hasAttribute('download') || link.target === '_blank') return;

      link.addEventListener('click', (e) => {
        e.preventDefault();
        overlay.classList.add('active');
        setTimeout(() => { window.location.href = href; }, 400);
      });
    });
  };

  // ── 6. Toast Notifications ────────────────────────────────────
  // Global function: showToast('message', 'success' | 'error' | 'warning')
  window.showToast = (message, type = 'success', duration = 3000) => {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    // Auto-remove after duration + animation time
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, duration + 300);
  };

  // ── 7. Cart Badge ─────────────────────────────────────────────
  const updateCartBadge = () => {
    const badge = document.querySelector('.cart-badge');
    if (!badge) return;
    const cart = JSON.parse(localStorage.getItem('so-cart') || '[]');
    badge.textContent = cart.length;
    badge.style.display = cart.length > 0 ? 'flex' : 'none';
  };

  // Update cart badge whenever localStorage changes
  window.addEventListener('storage', updateCartBadge);
  updateCartBadge();

  // ── 8. Smooth Parallax Helper ─────────────────────────────────
  // Called by pages that have parallax elements
  window.initParallax = (selector, speed = 0.4) => {
    const el = document.querySelector(selector);
    if (!el) return;

    window.addEventListener('scroll', () => {
      const scrolled = window.scrollY;
      el.style.transform = `translateY(${scrolled * speed}px)`;
    }, { passive: true });
  };

  // ── Init ───────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    initCursor();
    initScrollReveal();
    initNav();
    initPromoBanner();
    initPageTransitions();
  });

})();
