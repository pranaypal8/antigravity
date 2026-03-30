// ============================================================
// CUSTOMIZER JS — Special One Real-Time Shirt Customizer
// ============================================================
// 6-step wizard with real-time SVG shirt preview.
// Each selection instantly updates the shirt preview with
// a smooth fade/morph transition.
// ============================================================

(function () {
  'use strict';

  // ── Fixed Constants ───────────────────────────────────────
  const SHIRT_PRICE = 3999;
  const SIZES = ['S','S.5','M','M.5','L','L.5','XL','XL.5','XXL','XXL.5','XXXL','XXXL.5'];
  const TOTAL_STEPS = 6;

  // ── Shirt Config State ────────────────────────────────────
  let shirtConfig = {
    fabric:  null,
    collar:  null,
    cuffs:   null,
    buttons: null,
    monogram:'',
    size:    null,
    price:   SHIRT_PRICE,
  };

  let currentStep = 1;

  // ── Options Data ──────────────────────────────────────────
  const FABRICS = [
    { id: 'oxford-navy',        name: 'Oxford Navy',         color: '#0A1628', tags: 'Formal · Breathable', desc: 'Classic Oxford weave. Structured grip, breathable finish.' },
    { id: 'ivory-linen',        name: 'Ivory Linen',         color: '#F5F0E8', tags: 'Casual · Summer',     desc: 'Pure linen. Light as air, textured to perfection.' },
    { id: 'charcoal-herring',   name: 'Charcoal Herringbone',color: '#2C2C2C', tags: 'Formal · Premium',    desc: 'A power fabric. Charcoal herringbone for commanding rooms.' },
    { id: 'chambray-blue',      name: 'Chambray Blue',       color: '#5C7994', tags: 'Smart Casual',        desc: 'Chambray plain weave. The blue that does everything.' },
    { id: 'white-poplin',       name: 'White Poplin',        color: '#FAFAFA', tags: 'Classic · Formal',    desc: 'Crisp white poplin. The foundation of every wardrobe.' },
    { id: 'burgundy-twill',     name: 'Burgundy Twill',      color: '#6B2737', tags: 'Evening · Occasion',  desc: 'Rich burgundy twill. Authority meets sophistication.' },
  ];

  const COLLARS = [
    { id: 'spread',       name: 'Spread Collar',       desc: 'Wide spread. Suited for ties and tie-less formal looks.', svgKey: 'spread' },
    { id: 'button-down',  name: 'Button Down',          desc: 'Classic Ivy League. Smart-casual perfection.',            svgKey: 'button-down' },
    { id: 'mandarin',     name: 'Mandarin Collar',      desc: 'Band only. Bold, minimal, and contemporary.',             svgKey: 'mandarin' },
    { id: 'cutaway',      name: 'Cutaway Collar',       desc: 'Extreme spread. Strong, confident statement.',            svgKey: 'cutaway' },
  ];

  const CUFFS = [
    { id: 'barrel-1btn', name: 'Barrel — 1 Button',    desc: 'Clean and classic. The everyday standard.',      svgKey: 'barrel' },
    { id: 'french',      name: 'French Cuff',           desc: 'Double back with cufflinks. Elevated elegance.', svgKey: 'french' },
    { id: 'convertible', name: 'Convertible Cuff',      desc: 'Works with or without cufflinks. Versatile.',    svgKey: 'convertible' },
    { id: 'barrel-2btn', name: 'Barrel — 2 Button',     desc: 'Two buttons. Slightly more structured look.',    svgKey: 'barrel2' },
  ];

  const BUTTONS = [
    { id: 'white-mop',  name: 'White MOP',    color: '#F8F8F8', desc: 'White Mother of Pearl. Luminous and classic.' },
    { id: 'navy-mat',   name: 'Navy Matte',   color: '#1C2E4A', desc: 'Navy matte. Subtle and coordinated.' },
    { id: 'gold-tonal', name: 'Gold Tonal',   color: '#C9A84C', desc: 'Gold tone. A refined statement detail.' },
    { id: 'black-horn', name: 'Black Horn',   color: '#1A1A1A', desc: 'Black horn effect. Dramatic and precise.' },
    { id: 'clear-crys', name: 'Clear Crystal',color: '#D8EAF8', desc: 'Clear crystal. Timeless and understated.' },
    { id: 'ivory-tag',  name: 'Ivory Tagua',  color: '#E8DDD0', desc: 'Ivory tagua nut. Natural, sustainable, beautiful.' },
  ];

  // ── SVG Shirt Definition ──────────────────────────────────
  // A composited SVG that updates in real-time as options are selected.
  // The shirt is made of multiple SVG paths layered on top of each other.

  const buildShirtSVG = () => {
    const fabricColor  = shirtConfig.fabric?.color || '#2C3E55'; // Default navy
    const buttonColor  = shirtConfig.buttons?.color || '#F8F8F8';
    const collarType   = shirtConfig.collar?.svgKey || 'spread';
    const cuffType     = shirtConfig.cuffs?.svgKey  || 'barrel';
    const monogram     = shirtConfig.monogram || '';

    // Calculate lighter shade for shirt highlights
    const lighterFabric = lightenColor(fabricColor, 20);

    return `<svg viewBox="0 0 200 260" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
  <defs>
    <linearGradient id="shirtGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${lighterFabric};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${fabricColor};stop-opacity:1" />
    </linearGradient>
    <linearGradient id="collarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${lighterFabric};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${fabricColor};stop-opacity:1" />
    </linearGradient>
    <filter id="shirtShadow">
      <feDropShadow dx="2" dy="4" stdDeviation="4" flood-opacity="0.3"/>
    </filter>
  </defs>

  <!-- Shirt Body -->
  <path d="M 40 70 L 20 50 L 0 70 L 10 240 L 190 240 L 200 70 L 180 50 L 160 70
           L 155 80 L 155 240 L 45 240 L 45 80 Z"
        fill="url(#shirtGrad)" filter="url(#shirtShadow)" />

  <!-- Left Shoulder/Sleeve -->
  <path d="M 40 70 L 20 50 L 0 70 L 10 110 L 45 100 L 45 80 Z"
        fill="url(#shirtGrad)" />

  <!-- Right Shoulder/Sleeve -->
  <path d="M 160 70 L 180 50 L 200 70 L 190 110 L 155 100 L 155 80 Z"
        fill="url(#shirtGrad)" />

  <!-- Left Cuff -->
  ${getCuffSVG(cuffType, 'left', fabricColor, buttonColor)}

  <!-- Right Cuff -->
  ${getCuffSVG(cuffType, 'right', fabricColor, buttonColor)}

  <!-- Shirt Front Placket (button strip) -->
  <rect x="93" y="70" width="14" height="170" fill="${lightenColor(fabricColor, 10)}" rx="1" />

  <!-- Buttons on placket -->
  <circle cx="100" cy="90"  r="3.5" fill="${buttonColor}" stroke="rgba(0,0,0,0.2)" stroke-width="0.5"/>
  <circle cx="100" cy="110" r="3.5" fill="${buttonColor}" stroke="rgba(0,0,0,0.2)" stroke-width="0.5"/>
  <circle cx="100" cy="130" r="3.5" fill="${buttonColor}" stroke="rgba(0,0,0,0.2)" stroke-width="0.5"/>
  <circle cx="100" cy="150" r="3.5" fill="${buttonColor}" stroke="rgba(0,0,0,0.2)" stroke-width="0.5"/>
  <circle cx="100" cy="170" r="3.5" fill="${buttonColor}" stroke="rgba(0,0,0,0.2)" stroke-width="0.5"/>
  <circle cx="100" cy="190" r="3.5" fill="${buttonColor}" stroke="rgba(0,0,0,0.2)" stroke-width="0.5"/>

  <!-- Collar Layer -->
  ${getCollarSVG(collarType, fabricColor, lighterFabric, buttonColor)}

  <!-- Monogram (if set) -->
  ${monogram ? `
  <text x="65" y="108" font-family="Georgia, serif" font-size="7" font-style="italic"
        fill="${buttonColor}" opacity="0.9" text-anchor="middle" letter-spacing="1">${monogram}</text>
  ` : ''}
</svg>`;
  };

  // Collar SVG paths by type
  const getCollarSVG = (type, fabricColor, lighter, buttonColor) => {
    const base = `fill="url(#collarGrad)" stroke="${lightenColor(fabricColor, 30)}" stroke-width="0.5"`;

    const collars = {
      'spread': `
        <!-- Spread Collar -->
        <path d="M 80 70 L 100 85 L 120 70 L 115 62 L 100 72 L 85 62 Z" ${base}/>
        <path d="M 85 62 L 100 72 L 70 50 Z" ${base}/>
        <path d="M 115 62 L 100 72 L 130 50 Z" ${base}/>
        <!-- Collar button -->
        <circle cx="100" cy="75" r="2.5" fill="${buttonColor}" stroke="rgba(0,0,0,0.2)" stroke-width="0.5"/>
      `,
      'button-down': `
        <path d="M 82 70 L 100 84 L 118 70 L 114 62 L 100 70 L 86 62 Z" ${base}/>
        <path d="M 86 62 L 100 70 L 75 52 Z" ${base}/>
        <path d="M 114 62 L 100 70 L 125 52 Z" ${base}/>
        <!-- Button-through detail -->
        <circle cx="83" cy="56" r="1.5" fill="${buttonColor}" stroke="rgba(0,0,0,0.2)" stroke-width="0.5"/>
        <circle cx="117" cy="56" r="1.5" fill="${buttonColor}" stroke="rgba(0,0,0,0.2)" stroke-width="0.5"/>
        <circle cx="100" cy="76" r="2.5" fill="${buttonColor}" stroke="rgba(0,0,0,0.2)" stroke-width="0.5"/>
      `,
      'mandarin': `
        <!-- Mandarin / band collar -->
        <rect x="87" y="52" width="26" height="20" rx="4" fill="url(#collarGrad)" stroke="${lightenColor(fabricColor, 30)}" stroke-width="0.5"/>
        <circle cx="100" cy="60" r="2.5" fill="${buttonColor}" stroke="rgba(0,0,0,0.2)" stroke-width="0.5"/>
      `,
      'cutaway': `
        <!-- Cutaway — very wide spread -->
        <path d="M 78 70 L 100 86 L 122 70 L 116 60 L 100 72 L 84 60 Z" ${base}/>
        <path d="M 84 60 L 100 72 L 60 44 Z" ${base}/>
        <path d="M 116 60 L 100 72 L 140 44 Z" ${base}/>
        <circle cx="100" cy="76" r="2.5" fill="${buttonColor}" stroke="rgba(0,0,0,0.2)" stroke-width="0.5"/>
      `,
    };

    return collars[type] || collars['spread'];
  };

  // Cuff SVG paths by type
  const getCuffSVG = (type, side, fabricColor, buttonColor) => {
    const isLeft = side === 'left';
    const x = isLeft ? 5 : 155;
    const lighter = lightenColor(fabricColor, 15);

    if (type === 'french') {
      return `
        <rect x="${x}" y="${isLeft ? 100 : 100}" width="40" height="20" rx="3"
              fill="${lighter}" stroke="${lightenColor(fabricColor, 30)}" stroke-width="0.5"/>
        <rect x="${x+2}" y="${isLeft ? 105 : 105}" width="36" height="10" rx="2" fill="${fabricColor}" opacity="0.3"/>
        <!-- Cufflink -->
        <circle cx="${x+20}" cy="${isLeft ? 110 : 110}" r="3" fill="${buttonColor}" stroke="rgba(0,0,0,0.2)" stroke-width="0.5"/>
      `;
    }

    if (type === 'convertible') {
      return `
        <rect x="${x}" y="100" width="40" height="18" rx="3"
              fill="${lighter}" stroke="${lightenColor(fabricColor, 30)}" stroke-width="0.5"/>
        <circle cx="${x+32}" cy="109" r="2" fill="${buttonColor}" stroke="rgba(0,0,0,0.2)" stroke-width="0.5"/>
        <circle cx="${x+26}" cy="109" r="2" fill="${buttonColor}" stroke="rgba(0,0,0,0.2)" stroke-width="0.5"/>
      `;
    }

    // Default barrel cuff (1 or 2 button)
    return `
      <rect x="${x}" y="100" width="40" height="16" rx="3"
            fill="${lighter}" stroke="${lightenColor(fabricColor, 30)}" stroke-width="0.5"/>
      <circle cx="${x+30}" cy="108" r="2.5" fill="${buttonColor}" stroke="rgba(0,0,0,0.2)" stroke-width="0.5"/>
      ${type === 'barrel2' ? `<circle cx="${x+20}" cy="108" r="2.5" fill="${buttonColor}" stroke="rgba(0,0,0,0.2)" stroke-width="0.5"/>` : ''}
    `;
  };

  // Utility: lighten a hex color by a given percentage
  const lightenColor = (hex, percent) => {
    const num = parseInt(hex.replace('#',''), 16);
    const r = Math.min(255, (num >> 16) + percent * 2.55);
    const g = Math.min(255, ((num >> 8) & 0x00FF) + percent * 2.55);
    const b = Math.min(255, (num & 0x0000FF) + percent * 2.55);
    return '#' + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1);
  };

  // ── Update Preview ────────────────────────────────────────
  const updatePreview = () => {
    const container = document.getElementById('shirtSvgContainer');
    if (!container) return;

    // Fade out → update → fade in
    container.style.opacity = '0';
    container.style.transform = 'scale(0.97)';

    setTimeout(() => {
      container.innerHTML = buildShirtSVG();
      container.style.opacity = '1';
      container.style.transform = 'scale(1)';
    }, 200);

    updateSummaryPanel();
  };

  // ── Update Summary Panel ──────────────────────────────────
  const updateSummaryPanel = () => {
    const setVal = (id, value) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = value || '—';
      el.classList.toggle('is-set', !!value);
    };

    setVal('sel-fabric',  shirtConfig.fabric?.name);
    setVal('sel-collar',  shirtConfig.collar?.name);
    setVal('sel-cuffs',   shirtConfig.cuffs?.name);
    setVal('sel-buttons', shirtConfig.buttons?.name);
    setVal('sel-mono',    shirtConfig.monogram || null);
    setVal('sel-size',    shirtConfig.size);
  };

  // ── Render Step ───────────────────────────────────────────
  const renderStep = (step) => {
    const container = document.getElementById('stepContent');
    const counter   = document.getElementById('stepCounter');
    const title     = document.getElementById('stepTitle');
    const subtitle  = document.getElementById('stepSubtitle');
    const prevBtn   = document.getElementById('prevBtn');
    const nextBtn   = document.getElementById('nextBtn');
    const addCartBtn= document.getElementById('addCartBtn');

    // Update progress bar
    document.querySelectorAll('.progress-step').forEach((dot, i) => {
      dot.classList.toggle('active', i + 1 === step);
      dot.classList.toggle('done', i + 1 < step);
    });

    // Show/hide navigation buttons
    if (prevBtn) prevBtn.style.display = step === 1 ? 'none' : 'inline-flex';
    if (nextBtn) nextBtn.style.display = step === TOTAL_STEPS ? 'none' : 'inline-flex';
    if (addCartBtn) addCartBtn.style.display = step === TOTAL_STEPS ? 'inline-flex' : 'none';

    // Step-specific content
    const stepData = [
      { title: 'Choose Your Fabric', subtitle: 'The foundation of your shirt. Select a fabric that represents you.' },
      { title: 'Collar Style',        subtitle: 'The collar frames your face. Choose your signature look.' },
      { title: 'Cuff Style',          subtitle: 'Cuffs are noticed. Choose yours with intention.' },
      { title: 'Button Type',         subtitle: 'The final structural detail. Every button tells a story.' },
      { title: 'Your Monogram',       subtitle: 'Up to 3 initials. Embroidered on your collar. Optional.' },
      { title: 'Select Your Size',    subtitle: 'All 12 sizes available. If between sizes, go one up.' },
    ];

    if (counter) counter.textContent = `Step ${step} of ${TOTAL_STEPS}`;
    if (title)   title.textContent   = stepData[step - 1]?.title || '';
    if (subtitle) subtitle.textContent= stepData[step - 1]?.subtitle || '';

    // Animate content in
    if (container) {
      container.style.opacity = '0';
      container.style.transform = 'translateX(20px)';
      setTimeout(() => {
        container.innerHTML = getStepHTML(step);
        container.style.opacity = '1';
        container.style.transform = 'translateX(0)';
        attachStepListeners(step);
      }, 200);
    }
  };

  // ── Step HTML Generators ──────────────────────────────────
  const getStepHTML = (step) => {
    switch (step) {
      case 1: return getFabricHTML();
      case 2: return getCollarHTML();
      case 3: return getCuffHTML();
      case 4: return getButtonHTML();
      case 5: return getMonogramHTML();
      case 6: return getSizeHTML();
      default: return '';
    }
  };

  const getFabricHTML = () => `
    <div class="options-grid">
      ${FABRICS.map(f => `
        <div class="option-card ${shirtConfig.fabric?.id === f.id ? 'selected' : ''}"
             data-step="1" data-id="${f.id}">
          <div class="option-card__swatch" style="background:linear-gradient(135deg,${lightenColor(f.color,20)},${f.color})"></div>
          <div class="option-card__name">${f.name}</div>
          <div class="option-card__desc">${f.desc}</div>
          <div style="margin-top:0.4rem"><span class="badge badge--gold" style="font-size:0.5rem">${f.tags}</span></div>
        </div>
      `).join('')}
    </div>`;

  const getCollarHTML = () => `
    <div class="options-grid">
      ${COLLARS.map(c => `
        <div class="option-card ${shirtConfig.collar?.id === c.id ? 'selected' : ''}"
             data-step="2" data-id="${c.id}">
          <div class="option-card__visual">👔</div>
          <div class="option-card__name">${c.name}</div>
          <div class="option-card__desc">${c.desc}</div>
        </div>
      `).join('')}
    </div>`;

  const getCuffHTML = () => `
    <div class="options-grid">
      ${CUFFS.map(c => `
        <div class="option-card ${shirtConfig.cuffs?.id === c.id ? 'selected' : ''}"
             data-step="3" data-id="${c.id}">
          <div class="option-card__visual">🔗</div>
          <div class="option-card__name">${c.name}</div>
          <div class="option-card__desc">${c.desc}</div>
        </div>
      `).join('')}
    </div>`;

  const getButtonHTML = () => `
    <div class="options-grid">
      ${BUTTONS.map(b => `
        <div class="option-card ${shirtConfig.buttons?.id === b.id ? 'selected' : ''}"
             data-step="4" data-id="${b.id}">
          <div class="option-card__swatch" style="background:${b.color};border:2px solid rgba(128,128,128,0.3)"></div>
          <div class="option-card__name">${b.name}</div>
          <div class="option-card__desc">${b.desc}</div>
        </div>
      `).join('')}
    </div>`;

  const getMonogramHTML = () => `
    <div class="monogram-input-wrapper">
      <input type="text" id="monogramInput" class="form-input monogram-input"
             maxlength="3" placeholder="ABC" value="${shirtConfig.monogram}"
             autocomplete="off" aria-label="Enter up to 3 initials">
      <p class="monogram-count" id="monogramCount">${shirtConfig.monogram.length}/3 characters</p>
      <p style="text-align:center;font-family:var(--font-body);font-size:0.85rem;color:var(--text-muted);margin-top:var(--space-md)">
        Leave empty to skip the monogram. Initials appear on your collar area.
      </p>
    </div>`;

  const getSizeHTML = () => `
    <div class="size-grid">
      ${SIZES.map(s => `
        <button class="size-btn ${shirtConfig.size === s ? 'selected' : ''}"
                data-size="${s}" aria-label="Size ${s}">${s}</button>
      `).join('')}
    </div>
    <p style="font-family:var(--font-body);font-size:0.85rem;color:var(--text-muted);margin-top:var(--space-lg);line-height:1.8">
      Half sizes (S.5, M.5, etc.) sit between standard sizes — ideal if you're a classic in-betweener.
      If unsure, go one size up.
    </p>`;

  // ── Attach Step Listeners ─────────────────────────────────
  const attachStepListeners = (step) => {
    // Option card selections (steps 1–4)
    if (step <= 4) {
      document.querySelectorAll('[data-step]').forEach(card => {
        card.addEventListener('click', () => {
          const id = card.dataset.id;
          selectOption(step, id);
          // Visual feedback
          document.querySelectorAll('[data-step]').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          updatePreview();
        });
      });
    }

    // Monogram step (step 5)
    if (step === 5) {
      const input = document.getElementById('monogramInput');
      if (input) {
        input.addEventListener('input', (e) => {
          // Strip HTML and non-letter characters, max 3 chars, uppercase
          const raw = e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3);
          e.target.value = raw;
          shirtConfig.monogram = raw;
          const cnt = document.getElementById('monogramCount');
          if (cnt) cnt.textContent = `${raw.length}/3 characters`;
          updatePreview();
        });
      }
    }

    // Size step (step 6)
    if (step === 6) {
      document.querySelectorAll('.size-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          shirtConfig.size = btn.dataset.size;
          updateSummaryPanel();
        });
      });
    }
  };

  // ── Select Option by Step ─────────────────────────────────
  const selectOption = (step, id) => {
    switch (step) {
      case 1: {
        const f = FABRICS.find(f => f.id === id);
        if (f) shirtConfig.fabric = { id: f.id, name: f.name, color: f.color, texture: f.tags };
        break;
      }
      case 2: {
        const c = COLLARS.find(c => c.id === id);
        if (c) shirtConfig.collar = { id: c.id, name: c.name, svgLayer: c.svgKey };
        break;
      }
      case 3: {
        const c = CUFFS.find(c => c.id === id);
        if (c) shirtConfig.cuffs = { id: c.id, name: c.name, svgLayer: c.svgKey };
        break;
      }
      case 4: {
        const b = BUTTONS.find(b => b.id === id);
        if (b) shirtConfig.buttons = { id: b.id, name: b.name, color: b.color };
        break;
      }
    }
  };

  // ── Navigation ────────────────────────────────────────────
  const goNext = () => {
    // Validate current step
    if (!validateStep(currentStep)) return;
    if (currentStep < TOTAL_STEPS) {
      currentStep++;
      renderStep(currentStep);
    }
  };

  const goPrev = () => {
    if (currentStep > 1) {
      currentStep--;
      renderStep(currentStep);
    }
  };

  const validateStep = (step) => {
    const validations = {
      1: () => shirtConfig.fabric !== null,
      2: () => shirtConfig.collar !== null,
      3: () => shirtConfig.cuffs  !== null,
      4: () => shirtConfig.buttons!== null,
      5: () => true, // Monogram is optional
      6: () => shirtConfig.size   !== null,
    };

    const messages = {
      1: 'Please choose a fabric before continuing.',
      2: 'Please choose a collar style.',
      3: 'Please choose a cuff style.',
      4: 'Please choose a button type.',
      6: 'Please select your size.',
    };

    if (!validations[step]()) {
      if (window.showToast) window.showToast(messages[step] || 'Please make a selection.', 'warning');
      return false;
    }
    return true;
  };

  // ── Add to Cart ───────────────────────────────────────────
  const addToCart = () => {
    if (!validateStep(TOTAL_STEPS)) return;

    // Final config
    const config = { ...shirtConfig, addedAt: Date.now() };

    // Get existing cart or start fresh
    const cart = JSON.parse(localStorage.getItem('so-cart') || '[]');
    cart.push(config);
    localStorage.setItem('so-cart', JSON.stringify(cart));

    // Show success + redirect
    if (window.showToast) window.showToast('Shirt added to cart! ✓', 'success');
    setTimeout(() => { window.location.href = 'cart.html'; }, 1000);
  };

  // ── DOM Init ──────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    // Initial SVG render
    const shirtContainer = document.getElementById('shirtSvgContainer');
    if (shirtContainer) {
      shirtContainer.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    }
    renderStep(1);
    updatePreview();

    // Navigation buttons
    document.getElementById('nextBtn')?.addEventListener('click', goNext);
    document.getElementById('prevBtn')?.addEventListener('click', goPrev);
    document.getElementById('addCartBtn')?.addEventListener('click', addToCart);
  });

})();
