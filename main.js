/* Tide pool about-me page.
 * The photo is shown in an SVG whose coordinates match the original photo
 * (2160 x 2880). Each hotspot below is traced in those coordinates. On hover,
 * a feathered cut-out of that spot lifts off the photo and its note appears.
 * Add ?debug to the URL to see the outlines.
 */
(() => {
  'use strict';

  const PHOTO = { src: 'images/tidepool.jpg', w: 2160, h: 2880 };

  // Hotspots. ellipse: [cx, cy, rx, ry]   poly: [[x, y], ...] (smoothed into a curve)
  // sci is optional; the card shows it (or the common name) in the top-right corner.
  const SPOTS = {
    'coral': { name: 'Purple coral', sci: '', accent: '#9a7bb8',
      poly: [[876, 1766], [888, 1670], [930, 1598], [984, 1550], [990, 1454], [1038, 1406], [1110, 1412], [1146, 1460], [1218, 1508], [1314, 1508], [1398, 1538], [1458, 1610], [1494, 1706], [1524, 1826], [1530, 1946], [1506, 2042], [1434, 2078], [1350, 2090], [1254, 2114], [1170, 2120], [1110, 2078], [1026, 2030], [954, 1946], [900, 1850]] },
    'urchin': { name: 'Sea urchin', sci: '', accent: '#9c5a4a',
      poly: [[27, 1600], [60, 1520], [100, 1500], [160, 1513], [207, 1473], [220, 1507], [307, 1540], [347, 1667], [393, 1713], [347, 1773], [340, 1820], [267, 1853], [200, 1867], [160, 1880], [100, 1827], [40, 1800], [20, 1720]] },
    'seaweed': { name: 'Spiky brown seaweed', sci: '', accent: '#a8963a',
      poly: [[243, 283], [290, 209], [355, 162], [430, 171], [514, 227], [551, 293], [589, 358], [570, 442], [505, 489], [430, 498], [355, 470], [299, 423], [253, 358]] },
  };

  const NS = 'http://www.w3.org/2000/svg';
  const $ = (id) => document.getElementById(id);
  const noHover = matchMedia('(hover: none)').matches;
  const scene = $('scene'), svg = $('pool'), world = $('world'), spotsLayer = $('spots'), defs = $('poolDefs');
  const card = $('card');

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  const r1 = (n) => Math.round(n * 10) / 10;
  function seeded(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function smoothClosed(pts) {
    const n = pts.length, p = (q) => `${r1(q[0])},${r1(q[1])}`;
    let d = `M${p(pts[0])}`;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      d += `C${p([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${p([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${p(p2)}`;
    }
    return d + 'Z';
  }
  function shapeOf(s) {
    if (s.ellipse) {
      const [cx, cy, rx, ry] = s.ellipse;
      return { cx, cy, box: [cx - rx, cy - ry, cx + rx, cy + ry], d: `M${cx - rx},${cy}a${rx},${ry} 0 1,0 ${rx * 2},0a${rx},${ry} 0 1,0 ${-rx * 2},0Z` };
    }
    const xs = s.poly.map((q) => q[0]), ys = s.poly.map((q) => q[1]);
    const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    return { cx: (box[0] + box[2]) / 2, cy: (box[1] + box[3]) / 2, box, d: smoothClosed(s.poly) };
  }

  /* ---------- build hotspots ---------- */
  const spots = [];
  document.querySelectorAll('#notes article[data-creature]').forEach((article, index) => {
    const key = article.dataset.creature;
    const data = SPOTS[key];
    if (!data) return;
    const { cx, cy, d, box } = shapeOf(data);
    const back = `translate(${-cx},${-cy})`;

    const mask = el('mask', { id: `m-${key}`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: PHOTO.w, height: PHOTO.h }, defs);
    el('path', { d, fill: '#fff', filter: 'url(#feather)' }, mask);

    const g = el('g', { class: 'spot', tabindex: 0, role: 'button', 'aria-controls': 'card', 'aria-label': `${data.name}: ${article.querySelector('h2')?.textContent || ''}` }, spotsLayer);
    const at = el('g', { transform: `translate(${cx},${cy})` }, g);
    el('path', { d, fill: '#000', filter: 'url(#softShadow)', transform: back }, el('g', { class: 'shadow' }, at));
    const lift = el('g', { class: 'lift' }, at);
    el('image', { href: PHOTO.src, width: PHOTO.w, height: PHOTO.h, preserveAspectRatio: 'none' }, el('g', { transform: back, mask: `url(#m-${key})` }, lift));

    // glisten: a soft band of light sweeps across the creature, plus a few twinkles
    const bw = box[2] - box[0], bh = box[3] - box[1], band = Math.max(bw, bh) * 0.42;
    const glint = el('g', { class: 'glint', transform: back, mask: `url(#m-${key})` }, at);
    const sweep = el('g', { class: 'sweep', style: `--dist:${r1(bw + band * 3)}px;animation-delay:${(index * 1.4).toFixed(1)}s` }, glint);
    el('rect', { x: r1(box[0] - band * 2), y: r1(box[1] - bh * 0.5), width: r1(band), height: r1(bh * 2), fill: 'url(#glintGrad)', transform: `rotate(18 ${r1(box[0] - band * 1.5)} ${r1(cy)})` }, sweep);
    const rand = seeded(index * 977 + 13);
    const sparkles = el('g', { class: 'sparkles', transform: back }, at);
    for (let i = 0; i < 4; i++) {
      const a = rand() * Math.PI * 2, k = Math.sqrt(rand()) * 0.34;
      const sp = el('g', { transform: `translate(${r1(cx + Math.cos(a) * bw * k)},${r1(cy + Math.sin(a) * bh * k)})` }, sparkles);
      const tw = el('g', { class: 'twinkle', style: `animation-delay:${(rand() * 4).toFixed(2)}s;animation-duration:${(2.4 + rand() * 1.4).toFixed(2)}s` }, el('g', { class: 'spark-size' }, sp));
      el('circle', { r: 4.5, class: 'spark-glow', filter: 'url(#sparkGlow)' }, tw);
      el('path', { d: 'M0,-10C1,-2 2,-1 10,0C2,1 1,2 0,10C-1,2 -2,1 -10,0C-2,-1 -1,-2 0,-10Z', class: 'spark' }, tw);
    }
    const hit = el('path', { d, class: 'hit' }, g);

    spots.push({ key, data, article, index, g, hit, box });
  });

  const dots = $('foundDots');
  for (const s of spots) {
    const i = document.createElement('i');
    i.style.setProperty('--c', s.data.accent);
    dots.appendChild(i);
    s.dot = i;
  }
  $('foundText').textContent = `0 of ${spots.length} found`;

  /* ---------- layout ----------
     Rotate the photo when its orientation doesn't match the screen, scale it to
     cover the screen, and pan so the hotspots sit in the middle of the view. */
  let W = 0, H = 0;
  const headerH = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72;
  const allBox = spots.reduce((b, s) => [Math.min(b[0], s.box[0]), Math.min(b[1], s.box[1]), Math.max(b[2], s.box[2]), Math.max(b[3], s.box[3])], [Infinity, Infinity, -Infinity, -Infinity]);
  function layout() {
    W = scene.clientWidth;
    H = scene.clientHeight;
    const rotate = (PHOTO.h > PHOTO.w) !== (H > W);
    const cw = rotate ? PHOTO.h : PHOTO.w, ch = rotate ? PHOTO.w : PHOTO.h;
    const map = rotate ? ([x, y]) => [y, PHOTO.w - x] : (q) => q;
    if (rotate) world.setAttribute('transform', `translate(0,${PHOTO.w}) rotate(-90)`);
    else world.removeAttribute('transform');
    // shadow falls down-right on screen whichever way the photo is turned
    svg.style.setProperty('--sx', rotate ? '-40px' : '26px');
    svg.style.setProperty('--sy', rotate ? '26px' : '40px');

    const [ax, ay] = map([allBox[0], allBox[1]]), [bx, by] = map([allBox[2], allBox[3]]);
    const fx = (ax + bx) / 2, fy = (ay + by) / 2;
    // cover the screen, unless that would cut off a hotspot; then shrink a little
    // (at most 15%) and let the blurred backdrop fill the edges
    const cover = Math.max(W / cw, H / ch);
    const bw = Math.abs(bx - ax), m = 0.1;
    const fit = W / (bw * (1 + m)); // only narrow screens need this
    const scale = clamp(fit, cover * 0.85, cover);
    const vw = W / scale, vh = H / scale, hh = headerH() / scale;
    const x0 = vw >= cw ? (cw - vw) / 2 : clamp(fx - vw / 2, 0, cw - vw);
    const y0 = vh >= ch ? ch / 2 - (vh + hh) / 2 : clamp(fy - (vh + hh) / 2, 0, ch - vh);
    svg.setAttribute('viewBox', `${r1(x0)} ${r1(y0)} ${r1(vw)} ${r1(vh)}`);
    const k = (W <= 640 ? 11 : 15) / (10 * scale); // sparkle radius in screen px
    svg.querySelectorAll('.spark-size').forEach((g) => g.setAttribute('transform', `scale(${k.toFixed(3)})`));
    if (current) placeCard(current);
  }

  /* ---------- card ---------- */
  let current = null, pinned = false, closeTimer = 0;
  const found = new Set();

  function placeCard(s) {
    const rect = s.hit.getBoundingClientRect();
    if (W <= 640) {
      card.classList.toggle('at-top', rect.top + rect.height / 2 > H * 0.55);
      return;
    }
    const cw = card.offsetWidth, ch = card.offsetHeight, gap = 20, need = cw + gap + 16;
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const roomRight = W - rect.right, roomLeft = rect.left;
    let x, origin;
    if ((cx > W / 2 && roomRight >= need) || (roomLeft < need && roomRight >= need)) {
      x = rect.right + gap; origin = 'left center';
    } else if (roomLeft >= need) {
      x = rect.left - gap - cw; origin = 'right center';
    } else {
      x = clamp(cx - cw / 2, 16, W - cw - 16); origin = 'center top';
    }
    let y = origin === 'center top' ? rect.bottom + 12 : cy - ch / 2;
    y = clamp(y, headerH() + 8, H - ch - 16);
    card.style.left = `${Math.round(x)}px`;
    card.style.top = `${Math.round(y)}px`;
    card.style.transformOrigin = origin;
  }

  function open(s, pin = false) {
    clearTimeout(closeTimer);
    if (pin) pinned = true;
    if (current === s) return;
    if (current) current.g.classList.remove('lifted');
    current = s;
    requestAnimationFrame(() => s.g.classList.add('lifted'));
    svg.classList.add('has-lift');

    card.style.setProperty('--accent', s.data.accent);
    card.querySelector('.card-no').textContent = `No. ${String(s.index + 1).padStart(2, '0')} / ${String(spots.length).padStart(2, '0')}`;
    card.querySelector('.card-sci').textContent = s.data.sci || s.data.name;
    card.querySelector('.card-body').innerHTML = s.article.innerHTML;
    placeCard(s);
    card.classList.add('open');

    if (!found.has(s.key)) {
      found.add(s.key);
      s.g.classList.add('found');
      s.dot.classList.add('on');
      const n = found.size, total = spots.length;
      $('foundText').textContent = n === total ? 'You met everyone. Thanks for visiting!' : `${n} of ${total} found`;
      $('hint').style.opacity = '0';
    }
  }

  function close() {
    clearTimeout(closeTimer);
    pinned = false;
    if (!current) return;
    current.g.classList.remove('lifted');
    current = null;
    svg.classList.remove('has-lift');
    card.classList.remove('open');
  }
  const scheduleClose = () => {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => { if (!pinned) close(); }, 380);
  };

  for (const s of spots) {
    s.g.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') open(s); });
    s.g.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !pinned) scheduleClose(); });
    s.g.addEventListener('click', (e) => {
      e.stopPropagation();
      if (current === s && pinned) close();
      else open(s, true);
    });
    s.g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(s, true); }
    });
    s.g.addEventListener('focus', () => { if (s.g.matches(':focus-visible')) open(s); });
  }
  card.addEventListener('pointerenter', () => clearTimeout(closeTimer));
  card.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !pinned) scheduleClose(); });
  card.addEventListener('click', (e) => e.stopPropagation());
  scene.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  /* ---------- views ---------- */
  function setView() {
    const view = location.hash === '#research' ? 'research' : 'about';
    document.body.dataset.view = view;
    document.querySelectorAll('.tabs a').forEach((a) => {
      if (a.dataset.tab === view) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    scene.inert = view !== 'about';
    $('research').inert = view !== 'research';
    if (view !== 'about') close();
    document.title = view === 'research' ? 'Research · Jacob Chen' : 'Jacob Chen';
  }

  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(layout, 100); });
  window.addEventListener('hashchange', setView);

  if (noHover) $('hint').textContent = 'Tap a creature to say hello';
  const params = new URLSearchParams(location.search);
  if (params.has('debug')) svg.classList.add('debug');
  layout();
  setView();

  // ?peek=<creature> opens that note on load (handy for previews)
  const peek = spots.find((s) => s.key === params.get('peek'));
  if (peek) requestAnimationFrame(() => open(peek, true));
})();
