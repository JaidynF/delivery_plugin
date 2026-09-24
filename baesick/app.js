/* BAESICK storefront — catalog, filters, quick view, bag. No dependencies. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const SHADES = [
    { id: 'bone',  name: 'Bone',  hex: '#E7E0D4' },
    { id: 'sand',  name: 'Sand',  hex: '#CDB79B' },
    { id: 'clay',  name: 'Clay',  hex: '#A87C5F' },
    { id: 'cocoa', name: 'Cocoa', hex: '#5F4033' },
    { id: 'slate', name: 'Slate', hex: '#7A7D7E' },
    { id: 'onyx',  name: 'Onyx',  hex: '#1D1C1A' },
  ];
  const shadeById = Object.fromEntries(SHADES.map(s => [s.id, s]));
  const SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2X', '3X', '4X'];
  const ALL = SHADES.map(s => s.id);

  // soldOut: sizes unavailable, just to make the size picker feel real
  const PRODUCTS = [
    { id: 'heavy-hoodie',   name: 'Heavyweight Hoodie',     cat: 'tops',      g: 'hoodie',     price: 98,  shades: ALL, badge: 'Bestseller', order: 1,
      desc: '480 gsm brushed fleece, dropped shoulder, double-layer hood with no drawcord. Boxy and cropped just above the hip.' },
    { id: 'everyday-tee',   name: 'Everyday Tee',           cat: 'tops',      g: 'tee',        price: 38,  shades: ALL, badge: 'Bestseller', order: 2,
      desc: '220 gsm combed cotton jersey with a tight 1×1 rib collar. Slightly boxy, sits at the hip.' },
    { id: 'lounge-pant',    name: 'Lounge Sweatpant',       cat: 'bottoms',   g: 'sweatpant',  price: 88,  shades: ALL, order: 3,
      desc: 'Matching fleece to the Heavyweight Hoodie. Relaxed through the thigh, stacked at a ribbed ankle.' },
    { id: 'second-skin',    name: 'Second Skin Bodysuit',   cat: 'intimates', g: 'bodysuit',   price: 62,  shades: ['bone','sand','clay','cocoa','onyx'], badge: 'New', order: 4, isNew: true,
      desc: 'Sculpting modal-elastane blend with a scoop neck and thong back. Smooths without squeezing.' },
    { id: 'rib-tank',       name: 'Rib Tank',               cat: 'tops',      g: 'tank',       price: 28,  shades: ALL, order: 5,
      desc: 'Stretch cotton rib, slim through the body, high neck. Built to layer.' },
    { id: 'long-sleeve',    name: 'Long Sleeve Tee',        cat: 'tops',      g: 'longsleeve', price: 48,  shades: ['bone','sand','slate','onyx'], order: 6,
      desc: 'Same 220 gsm jersey as the Everyday Tee, with longer sleeves that stack at the wrist.' },
    { id: 'fleece-short',   name: 'Fleece Short',           cat: 'bottoms',   g: 'shorts',     price: 58,  shades: ALL, badge: 'New', order: 7, isNew: true,
      desc: 'Seven-inch inseam in 480 gsm fleece with a raw hem and a covered elastic waist.' },
    { id: 'cotton-boxer',   name: 'Cotton Boxer Brief',     cat: 'intimates', g: 'boxer',      price: 24,  shades: ALL, order: 8,
      desc: 'Soft pima cotton with a wide covered waistband. No logo, no itch.' },
    { id: 'crew-sock',      name: 'Crew Sock 3-Pack',       cat: 'intimates', g: 'sock',       price: 22,  shades: ['bone','slate','onyx'], order: 9,
      desc: 'Cushioned footbed and ribbed calf. Three pairs in one shade.' },
    { id: 'studio-tee',     name: 'Studio Crop Tee',        cat: 'tops',      g: 'tee',        price: 36,  shades: ['bone','sand','clay','cocoa'], badge: 'New', order: 10, isNew: true, soldOut: ['XXS'],
      desc: 'Our Everyday Tee, cropped to the natural waist, with a slightly wider sleeve.' },
    { id: 'wide-pant',      name: 'Wide Leg Sweatpant',     cat: 'bottoms',   g: 'sweatpant',  price: 92,  shades: ['sand','cocoa','slate','onyx'], order: 11, soldOut: ['4X'],
      desc: 'Straight wide leg, high rise, pooling hem. The dressed-up version of the lounge pant.' },
    { id: 'zip-hoodie',     name: 'Zip Hoodie',             cat: 'tops',      g: 'hoodie',     price: 108, shades: ['bone','clay','slate','onyx'], order: 12,
      desc: 'The Heavyweight Hoodie with a two-way metal zip, finished in a shade-matched tone.' },
  ];
  // Spread default shades across the grid so the whole palette shows at a glance
  const ROTATION = ['bone', 'onyx', 'sand', 'cocoa', 'slate', 'clay'];
  PRODUCTS.forEach((p, i) => { p.def = p.shades.includes(ROTATION[i % 6]) ? ROTATION[i % 6] : p.shades[0]; });
  const byId = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));
  const FREE_SHIP = 100;

  const state = {
    cat: 'all',
    shade: 'all',
    sort: 'featured',
    cardShade: {},        // product id -> selected shade in the grid
    qv: null,             // { id, shade, size }
    cart: load(),
  };

  function load() {
    try { return JSON.parse(localStorage.getItem('baesick.bag') || '[]'); } catch { return []; }
  }
  function save() {
    try { localStorage.setItem('baesick.bag', JSON.stringify(state.cart)); } catch {}
  }
  const money = n => '$' + n.toFixed(0);
  const garment = (g, hex) => `<svg style="--shade:${hex}" viewBox="0 0 200 240" aria-hidden="true"><use href="#g-${g}"/></svg>`;

  // ---------- Shade row ----------
  function renderShadeRow() {
    const counts = id => PRODUCTS.filter(p => id === 'all' || p.shades.includes(id)).length;
    $('[data-shade-row]').innerHTML =
      `<button class="shade-chip all" role="radio" aria-checked="${state.shade === 'all'}" data-shade="all">
        <span class="sw"></span><span class="lbl"><span>All</span><span>${counts('all')}</span></span></button>` +
      SHADES.map(s => `<button class="shade-chip" role="radio" style="--c:${s.hex}" aria-checked="${state.shade === s.id}" data-shade="${s.id}">
        <span class="sw"></span><span class="lbl"><span>${s.name}</span><span>${counts(s.id)}</span></span></button>`).join('');
  }

  // ---------- Grid ----------
  function visibleProducts() {
    let list = PRODUCTS.filter(p =>
      (state.cat === 'all' || p.cat === state.cat) &&
      (state.shade === 'all' || p.shades.includes(state.shade)));
    const sorters = {
      featured: (a, b) => a.order - b.order,
      low: (a, b) => a.price - b.price,
      high: (a, b) => b.price - a.price,
      new: (a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0) || a.order - b.order,
    };
    return list.sort(sorters[state.sort]);
  }

  function shadeFor(p) {
    if (state.shade !== 'all' && p.shades.includes(state.shade)) return state.shade;
    return state.cardShade[p.id] && p.shades.includes(state.cardShade[p.id]) ? state.cardShade[p.id] : p.def;
  }

  function renderGrid() {
    const list = visibleProducts();
    $('[data-result-count]').textContent = `(${list.length})`;
    $('[data-empty]').hidden = list.length > 0;
    $('[data-grid]').innerHTML = list.map((p, i) => {
      const sh = shadeFor(p);
      return `<li class="card" style="animation-delay:${i * 40}ms" data-id="${p.id}">
        <button class="card-media" data-open="${p.id}" aria-label="View ${p.name}">
          ${garment(p.g, shadeById[sh].hex)}
          ${p.badge ? `<span class="card-badge">${p.badge}</span>` : ''}
        </button>
        <div class="quick" aria-label="Quick add ${p.name}">
          <span>Quick add — ${shadeById[sh].name}</span>
          ${SIZES.map(z => `<button data-quick="${p.id}" data-size="${z}" ${p.soldOut?.includes(z) ? 'disabled' : ''}>${z}</button>`).join('')}
        </div>
        <div class="card-meta"><span class="name">${p.name}</span><span>${money(p.price)}</span></div>
        <div class="card-sub">
          <span>${p.shades.length} shade${p.shades.length > 1 ? 's' : ''}</span>
          <span class="mini-sw">${p.shades.map(s =>
            `<button style="--c:${shadeById[s].hex}" aria-label="${shadeById[s].name}" aria-pressed="${s === sh}" data-card-shade="${p.id}:${s}"></button>`).join('')}</span>
        </div>
      </li>`;
    }).join('');
  }

  function setCat(cat) {
    state.cat = cat;
    $$('[data-filter]').forEach(b => b.setAttribute('aria-selected', b.dataset.filter === cat));
    const names = { all: 'All products', tops: 'Tops', bottoms: 'Bottoms', intimates: 'Intimates' };
    $('#shop-h').firstChild.textContent = names[cat] + ' ';
    renderGrid();
  }
  function setShade(shade) {
    state.shade = shade;
    renderShadeRow();
    renderGrid();
  }

  // ---------- Overlays ----------
  let lastFocus = null;
  function openLayer(el) {
    lastFocus = document.activeElement;
    $('[data-overlay]').hidden = false;
    el.hidden = false;
    document.body.style.overflow = 'hidden';
    (el.querySelector('input, [data-close]') || el).focus();
  }
  function closeLayers() {
    ['[data-modal]', '[data-drawer]', '[data-search]', '[data-overlay]'].forEach(s => $(s).hidden = true);
    document.body.style.overflow = '';
    state.qv = null;
    lastFocus?.focus?.();
  }

  // ---------- Quick view ----------
  function openQuickView(id, shade) {
    const p = byId[id];
    state.qv = { id, shade: shade || shadeFor(p), size: null };
    $('[data-qv-cat]').textContent = p.cat;
    $('[data-qv-name]').textContent = p.name;
    $('[data-qv-price]').textContent = money(p.price);
    $('[data-qv-desc]').textContent = p.desc;
    $('[data-qv-use]').setAttribute('href', '#g-' + p.g);
    renderQuickView();
    $$('[data-modal], [data-drawer], [data-search]').forEach(e => e.hidden = true);
    openLayer($('[data-modal]'));
  }
  function renderQuickView() {
    const p = byId[state.qv.id];
    $('[data-qv-media]').style.setProperty('--shade', shadeById[state.qv.shade].hex);
    $('[data-qv-shade-name]').textContent = shadeById[state.qv.shade].name;
    $('[data-qv-shades]').innerHTML = p.shades.map(s =>
      `<button style="--c:${shadeById[s].hex}" aria-label="${shadeById[s].name}" aria-pressed="${s === state.qv.shade}" data-qv-shade="${s}"></button>`).join('');
    $('[data-qv-sizes]').innerHTML = SIZES.map(z =>
      `<button aria-pressed="${z === state.qv.size}" data-qv-size="${z}" ${p.soldOut?.includes(z) ? 'disabled aria-label="' + z + ', sold out"' : ''}>${z}</button>`).join('');
    const add = $('[data-qv-add]');
    add.disabled = !state.qv.size;
    add.textContent = state.qv.size ? `Add to bag — ${money(p.price)}` : 'Select a size';
  }

  // ---------- Bag ----------
  function addToCart(id, shade, size) {
    const line = state.cart.find(l => l.id === id && l.shade === shade && l.size === size);
    if (line) line.qty++; else state.cart.push({ id, shade, size, qty: 1 });
    save(); renderCart();
    toast(`${byId[id].name} · ${shadeById[shade].name} · ${size} added to bag`);
  }
  function renderCart() {
    const count = state.cart.reduce((n, l) => n + l.qty, 0);
    const subtotal = state.cart.reduce((n, l) => n + l.qty * byId[l.id].price, 0);
    $$('[data-cart-count]').forEach(e => e.textContent = count);
    $('[data-subtotal]').textContent = money(subtotal);
    $('[data-checkout]').disabled = count === 0;
    const left = FREE_SHIP - subtotal;
    $('[data-ship-bar]').style.width = Math.min(100, (subtotal / FREE_SHIP) * 100) + '%';
    $('[data-ship-msg]').textContent = left > 0 ? `${money(left)} away from free shipping` : 'You’ve unlocked free shipping';
    $('[data-cart-lines]').innerHTML = state.cart.length ? state.cart.map((l, i) => {
      const p = byId[l.id];
      return `<li class="line">
        <div class="line-media">${garment(p.g, shadeById[l.shade].hex)}</div>
        <div class="line-info">
          <div class="n">${p.name}</div>
          <div class="v">${shadeById[l.shade].name} / ${l.size}</div>
          <div class="qty"><button aria-label="Decrease" data-qty="${i}:-1">−</button><span>${l.qty}</span><button aria-label="Increase" data-qty="${i}:1">+</button></div>
        </div>
        <div class="line-end"><span>${money(p.price * l.qty)}</span><button class="rm" data-rm="${i}">Remove</button></div>
      </li>`;
    }).join('') : '<li class="cart-empty">Your bag is empty.</li>';
  }

  // ---------- Search ----------
  function renderSearch(q) {
    q = q.trim().toLowerCase();
    const hits = !q ? PRODUCTS.slice(0, 6) : PRODUCTS.filter(p =>
      (p.name + ' ' + p.cat + ' ' + p.shades.join(' ')).toLowerCase().includes(q));
    $('[data-search-results]').innerHTML = hits.length ? hits.map(p =>
      `<li><button data-open="${p.id}"><div class="card-media">${garment(p.g, shadeById[p.def].hex)}</div><p>${p.name} — ${money(p.price)}</p></button></li>`
    ).join('') : `<li class="muted">No results for “${q.replace(/[<>&"]/g, '')}”</li>`;
  }

  // ---------- Toast ----------
  let toastTimer;
  function toast(msg) {
    const t = $('[data-toast]');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  }

  // ---------- Hero: slowly cycle through the shades ----------
  function heroCycle() {
    const hero = $('[data-hero]');
    let i = 0;
    const tick = () => {
      const s = SHADES[i % SHADES.length];
      hero.style.setProperty('--shade', s.hex);
      $('[data-hero-shade]').textContent = `${String(i % SHADES.length + 1).padStart(2, '0')} / ${s.name}`;
      i++;
    };
    tick();
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) setInterval(tick, 3200);
  }

  // ---------- Events ----------
  document.addEventListener('click', e => {
    const t = e.target.closest('button, a');
    if (!t) {
      if (e.target.matches('[data-overlay]')) closeLayers();
      return;
    }
    const d = t.dataset;

    if (d.cat) { setCat(d.cat); $('[data-mobile-menu]').hidden = true; $('[data-menu-toggle]').setAttribute('aria-expanded', 'false'); return; }
    if (d.filter) return setCat(d.filter);
    if (d.shade) return setShade(d.shade);
    if ('clear' in d) { setShade('all'); return setCat('all'); }
    if (d.cardShade) {
      const [id, s] = d.cardShade.split(':');
      state.cardShade[id] = s;
      if (state.shade !== 'all' && state.shade !== s) { state.shade = 'all'; renderShadeRow(); }
      return renderGrid();
    }
    if (d.quick) return addToCart(d.quick, shadeFor(byId[d.quick]), d.size);
    if (d.open) return openQuickView(d.open);
    if (d.qvShade) { state.qv.shade = d.qvShade; return renderQuickView(); }
    if (d.qvSize) { state.qv.size = d.qvSize; return renderQuickView(); }
    if ('qvAdd' in d) {
      const { id, shade, size } = state.qv;
      addToCart(id, shade, size);
      closeLayers();
      return openLayer($('[data-drawer]'));
    }
    if ('sizeGuide' in d) return toast('XXS 00 · XS 0–2 · S 4–6 · M 8–10 · L 12–14 · XL 16 · 2X 18–20 · 3X 22–24 · 4X 26–28');
    if ('cartOpen' in d) { closeLayers(); return openLayer($('[data-drawer]')); }
    if ('searchOpen' in d) { closeLayers(); renderSearch(''); $('[data-search-input]').value = ''; return openLayer($('[data-search]')); }
    if ('close' in d) return closeLayers();
    if (d.qty) {
      const [i, delta] = d.qty.split(':').map(Number);
      state.cart[i].qty += delta;
      if (state.cart[i].qty <= 0) state.cart.splice(i, 1);
      save(); return renderCart();
    }
    if (d.rm) { state.cart.splice(+d.rm, 1); save(); return renderCart(); }
    if ('checkout' in d) return toast('Checkout is a demo — connect Shopify or Stripe to go live.');
    if ('menuToggle' in d) {
      const m = $('[data-mobile-menu]');
      m.hidden = !m.hidden;
      t.setAttribute('aria-expanded', String(!m.hidden));
      t.textContent = m.hidden ? 'Menu' : 'Close';
    }
  });

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLayers(); });
  $('[data-sort]').addEventListener('change', e => { state.sort = e.target.value; renderGrid(); });
  $('[data-search-input]').addEventListener('input', e => renderSearch(e.target.value));

  $('[data-signup]').addEventListener('submit', e => {
    e.preventDefault();
    const input = $('#email');
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value);
    $('[data-signup-msg]').textContent = ok ? 'You’re on the list.' : 'Enter a valid email address.';
    if (ok) input.value = '';
  });

  const header = $('.header');
  addEventListener('scroll', () => header.classList.toggle('scrolled', scrollY > 10), { passive: true });

  // ---------- Init ----------
  $('[data-year]').textContent = new Date().getFullYear();
  renderShadeRow();
  renderGrid();
  renderCart();
  heroCycle();
})();
