/* Tide pool about-me page.
 * The photo is shown in an SVG whose coordinates match the original photo
 * (2880 x 2160). Each hotspot below is traced in those coordinates. On hover,
 * a feathered cut-out of that spot lifts off the photo and its note appears.
 * Add ?debug to the URL to see the outlines.
 */
(() => {
  'use strict';

  const PHOTO = { src: 'images/tidepool.jpg', w: 2880, h: 2160 };

  // Hotspots. ellipse: [cx, cy, rx, ry]   poly: [[x, y], ...] (smoothed into a curve)
  const SPOTS = {
    'giant-anemone': { name: 'Giant green anemone', sci: 'Anthopleura xanthogrammica', accent: '#4f8f78', ellipse: [1428, 1359, 184, 176] },
    'green-anemone': { name: 'Giant green anemone', sci: 'Anthopleura xanthogrammica', accent: '#5e8f9a', ellipse: [952, 1429, 168, 146] },
    'sunburst':      { name: 'Sunburst anemone', sci: 'Anthopleura sola', accent: '#7c9a5e', ellipse: [1823, 1506, 186, 148] },
    'aggregating':   { name: 'Aggregating anemones', sci: 'Anthopleura elegantissima', accent: '#b08a3e',
      poly: [[1236, 580], [1325, 520], [1444, 513], [1545, 548], [1645, 583], [1758, 620], [1788, 695], [1772, 784], [1685, 850], [1584, 871], [1484, 850], [1378, 836], [1284, 786], [1234, 704]] },
    'sponge':        { name: 'Orange encrusting sponge', sci: 'Porifera (ID unconfirmed)', accent: '#c9772a',
      poly: [[296, 1230], [320, 1193], [353, 1160], [392, 1153], [426, 1165], [462, 1181], [491, 1202], [495, 1223], [469, 1255], [459, 1292], [459, 1343], [444, 1386], [426, 1423], [400, 1442], [371, 1406], [355, 1363], [340, 1320], [320, 1291], [300, 1269]] },
    'mussels':       { name: 'California mussels', sci: 'Mytilus californianus', accent: '#3b5677',
      poly: [[2396, 1014], [2520, 984], [2614, 1036], [2656, 1150], [2626, 1274], [2542, 1336], [2438, 1326], [2374, 1244], [2364, 1118]] },
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
      return { cx, cy, d: `M${cx - rx},${cy}a${rx},${ry} 0 1,0 ${rx * 2},0a${rx},${ry} 0 1,0 ${-rx * 2},0Z` };
    }
    const xs = s.poly.map((q) => q[0]), ys = s.poly.map((q) => q[1]);
    return { cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2, d: smoothClosed(s.poly) };
  }

  /* ---------- build hotspots ---------- */
  const spots = [];
  document.querySelectorAll('#notes article[data-creature]').forEach((article, index) => {
    const key = article.dataset.creature;
    const data = SPOTS[key];
    if (!data) return;
    const { cx, cy, d } = shapeOf(data);
    const back = `translate(${-cx},${-cy})`;

    const mask = el('mask', { id: `m-${key}`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: PHOTO.w, height: PHOTO.h }, defs);
    el('path', { d, fill: '#fff', filter: 'url(#feather)' }, mask);

    const g = el('g', { class: 'spot', tabindex: 0, role: 'button', 'aria-controls': 'card', 'aria-label': `${data.name}: ${article.querySelector('h2')?.textContent || ''}` }, spotsLayer);
    const at = el('g', { transform: `translate(${cx},${cy})` }, g);
    el('path', { d, fill: '#000', filter: 'url(#softShadow)', transform: back }, el('g', { class: 'shadow' }, at));
    const lift = el('g', { class: 'lift' }, at);
    el('image', { href: PHOTO.src, width: PHOTO.w, height: PHOTO.h, preserveAspectRatio: 'none' }, el('g', { transform: back, mask: `url(#m-${key})` }, lift));
    el('path', { d, class: 'pulse-line', transform: back }, el('g', { class: 'pulse', style: `animation-delay:${(index * 0.8).toFixed(1)}s` }, at));
    const hit = el('path', { d, class: 'hit' }, g);

    spots.push({ key, data, article, index, g, hit });
  });

  const dots = $('foundDots');
  for (const s of spots) {
    const i = document.createElement('i');
    i.style.setProperty('--c', s.data.accent);
    dots.appendChild(i);
    s.dot = i;
  }
  $('foundText').textContent = `0 of ${spots.length} found`;

  /* ---------- layout: rotate the photo on tall screens ---------- */
  let W = 0, H = 0;
  function layout() {
    W = scene.clientWidth;
    H = scene.clientHeight;
    const tall = W / H < 0.8;
    if (tall) {
      svg.setAttribute('viewBox', `0 0 ${PHOTO.h} ${PHOTO.w}`);
      world.setAttribute('transform', `translate(${PHOTO.h},0) rotate(90)`);
      svg.style.setProperty('--sx', '40px'); svg.style.setProperty('--sy', '-26px');
    } else {
      svg.setAttribute('viewBox', `0 0 ${PHOTO.w} ${PHOTO.h}`);
      world.removeAttribute('transform');
      svg.style.setProperty('--sx', '26px'); svg.style.setProperty('--sy', '40px');
    }
    if (current) placeCard(current);
  }

  /* ---------- card ---------- */
  let current = null, pinned = false, closeTimer = 0;
  const found = new Set();
  const headerH = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72;

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
    card.querySelector('.card-sci').textContent = s.data.sci;
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
