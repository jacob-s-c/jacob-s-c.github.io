/* Tide pool about-me page.
 * The photo is shown in an SVG whose coordinates match the original photo
 * (see PHOTO). Each hotspot below is traced in those coordinates. On hover,
 * a feathered cut-out of that spot lifts off the photo and its note appears.
 * Add ?debug to the URL to see the outlines.
 */
(() => {
  'use strict';

  // turn: rotate the photo a quarter turn on screens whose orientation doesn't match it.
  // zoom: on wide screens, zoom in so the hotspots fill more of the view.
  const PHOTO = { src: 'images/canal.jpg', w: 2880, h: 2160, turn: true, zoom: false };

  // Hotspots. ellipse: [cx, cy, rx, ry]   poly: [[x, y], ...] (smoothed into a curve)
  // sci is optional; the card shows it (or the common name) in the top-right corner.
  const SPOTS = {
    'left':   { name: 'Sea anemone', sci: '', accent: '#5e8f9a', ellipse: [952, 1429, 168, 146] },
    'middle': { name: 'Sea anemone', sci: '', accent: '#4f8f78', ellipse: [1428, 1359, 184, 176] },
    'right':  { name: 'Sea anemone', sci: '', accent: '#7c9a5e', ellipse: [1823, 1506, 186, 148] },
  };

  // ?fx=glisten switches back to the light-sweep effect
  const params = new URLSearchParams(location.search);
  const FX = params.get('fx') === 'glisten' ? 'glisten' : 'ripple';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const NS = 'http://www.w3.org/2000/svg';
  const $ = (id) => document.getElementById(id);
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

    const pad = 40; // room for the feathered edge; keeping the mask small keeps the lift fast
    const mask = el('mask', { id: `m-${key}`, maskUnits: 'userSpaceOnUse', x: box[0] - pad, y: box[1] - pad, width: box[2] - box[0] + pad * 2, height: box[3] - box[1] + pad * 2 }, defs);
    el('path', { d, fill: '#fff', filter: 'url(#feather)' }, mask);

    const g = el('g', { class: 'spot', tabindex: 0, role: 'button', 'aria-controls': 'card', 'aria-label': `${data.name}: ${article.querySelector('h2')?.textContent || ''}` }, spotsLayer);
    const at = el('g', { transform: `translate(${cx},${cy})` }, g);
    el('path', { d, fill: '#000', filter: 'url(#softShadow)', transform: back }, el('g', { class: 'shadow' }, at));
    const lift = el('g', { class: 'lift' }, at);
    el('image', { href: PHOTO.src, width: PHOTO.w, height: PHOTO.h, preserveAspectRatio: 'none' }, el('g', { transform: back, mask: `url(#m-${key})` }, lift));

    // glisten (?fx=glisten): a soft band of light sweeps across the creature, plus a few twinkles
    if (FX === 'glisten') {
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
    }
    const hit = el('path', { d, class: 'hit' }, g);

    spots.push({ key, data, article, index, g, hit, box, cx, cy, r: Math.max(box[2] - box[0], box[3] - box[1]) / 2 });
  });

  /* ---------- layout ----------
     Rotate the photo when its orientation doesn't match the screen, scale it to
     cover the screen, and pan so the hotspots sit in the middle of the view. */
  let W = 0, H = 0;
  const view = { x0: 0, y0: 0, scale: 1, rotate: false };
  const headerH = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72;
  const allBox = spots.reduce((b, s) => [Math.min(b[0], s.box[0]), Math.min(b[1], s.box[1]), Math.max(b[2], s.box[2]), Math.max(b[3], s.box[3])], [Infinity, Infinity, -Infinity, -Infinity]);
  function layout() {
    W = scene.clientWidth;
    H = scene.clientHeight;
    const rotate = PHOTO.turn !== false && (PHOTO.h > PHOTO.w) !== (H > W);
    const cw = rotate ? PHOTO.h : PHOTO.w, ch = rotate ? PHOTO.w : PHOTO.h;
    const map = rotate ? ([x, y]) => [PHOTO.h - y, x] : (q) => q; // quarter turn clockwise
    if (rotate) world.setAttribute('transform', `translate(${PHOTO.h},0) rotate(90)`);
    else world.removeAttribute('transform');
    // shadow falls down-right on screen whichever way the photo is turned
    svg.style.setProperty('--sx', rotate ? '40px' : '26px');
    svg.style.setProperty('--sy', rotate ? '-26px' : '40px');

    const [ax, ay] = map([allBox[0], allBox[1]]), [bx, by] = map([allBox[2], allBox[3]]);
    const fx = (ax + bx) / 2, fy = (ay + by) / 2;
    // cover the screen, unless that would cut off a hotspot; then shrink a little
    // (at most 15%) and let the blurred backdrop fill the edges
    const cover = Math.max(W / cw, H / ch);
    const bw = Math.abs(bx - ax), m = 0.1;
    const fit = W / (bw * (1 + m)); // only narrow screens need this
    // on wide screens, zoom in until the hotspots span ~60% of the width
    const zoom = !PHOTO.zoom ? cover : Math.max(cover, Math.min(W * 0.6 / bw, (H - headerH()) * 0.6 / Math.abs(by - ay)));
    const scale = clamp(fit, cover * 0.85, zoom);
    const vw = W / scale, vh = H / scale, hh = headerH() / scale;
    const x0 = vw >= cw ? (cw - vw) / 2 : clamp(fx - vw / 2, 0, cw - vw);
    const y0 = vh >= ch ? ch / 2 - (vh + hh) / 2 : clamp(fy - (vh + hh) / 2, 0, ch - vh);
    svg.setAttribute('viewBox', `${r1(x0)} ${r1(y0)} ${r1(vw)} ${r1(vh)}`);
    Object.assign(view, { x0, y0, scale, rotate });
    if (water) water.render();
    const k = (W <= 640 ? 6.5 : 8.5) / (10 * scale); // sparkle radius in screen px
    svg.querySelectorAll('.spark-size').forEach((g) => g.setAttribute('transform', `scale(${k.toFixed(3)})`));
    if (current) placeCard(current);
  }

  /* ---------- card ---------- */
  let current = null, pinned = false, closeTimer = 0;

  function placeCard(s) {
    const r = s.hit.getBoundingClientRect(), ex = r.width * 0.08, ey = r.height * 0.08; // room for the lift
    const rect = { left: r.left - ex, right: r.right + ex, top: r.top - ey, bottom: r.bottom + ey, width: r.width + 2 * ex, height: r.height + 2 * ey };
    if (W <= 640) {
      card.classList.toggle('at-top', rect.top + rect.height / 2 > H * 0.55);
      return;
    }
    const cw = card.offsetWidth, ch = card.offsetHeight, gap = 20, pad = 16, top = headerH() + 8;
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const avoid = [rect, ...spots.filter((o) => o !== s).map((o) => o.hit.getBoundingClientRect())];
    const fitX = (x) => clamp(x, pad, W - cw - pad), fitY = (y) => clamp(y, top, H - ch - pad);
    // candidates: the side away from the middle, the other side, below, above
    const tries = [
      ['left center', fitX(rect.right + gap), fitY(cy - ch / 2)],
      ['right center', fitX(rect.left - gap - cw), fitY(cy - ch / 2)],
      ['center top', fitX(cx - cw / 2), fitY(rect.bottom + gap)],
      ['center bottom', fitX(cx - cw / 2), fitY(rect.top - gap - ch)],
    ];
    if (cx <= W / 2) tries.unshift(tries.splice(1, 1)[0]);
    // pick the one that covers the least of any hotspot (ties keep the order above)
    const cover = ([, x, y]) => avoid.reduce((a, o) =>
      a + Math.max(0, Math.min(x + cw, o.right) - Math.max(x, o.left)) * Math.max(0, Math.min(y + ch, o.bottom) - Math.max(y, o.top)), 0);
    const [origin, x, y] = tries.reduce((best, t) => (cover(t) < cover(best) - 1 ? t : best));
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
    if (water) water.drop(s.cx, s.cy, 1.4);
    svg.classList.add('has-lift');

    card.style.setProperty('--accent', s.data.accent);
    card.querySelector('.card-no').textContent = `No. ${String(s.index + 1).padStart(2, '0')} / ${String(spots.length).padStart(2, '0')}`;
    card.querySelector('.card-sci').textContent = s.data.sci || s.data.name;
    card.querySelector('.card-body').innerHTML = s.article.innerHTML;
    placeCard(s);
    card.classList.add('open');
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

  /* ---------- water ----------
     The photo is drawn into a WebGL canvas under the SVG. Rings spread out from
     each anemone and bend the photo like real water: refraction, a little shading
     on each slope, caustic light where the surface focuses it, and a glint on the
     crests. If WebGL or the image isn't available the plain SVG photo stays. */
  let water = null;
  function startWater() {
    const canvas = $('water');
    const gl = canvas && canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false, alpha: true });
    if (!gl) return;
    const MAX = 10, LIFE = 3.8;
    const VS = 'attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }';
    // Each ripple is a short train of rings. Slopes and curvature are computed
    // directly from the ring formula (no extra samples), and pixels that no ring
    // is near are skipped, so this stays cheap.
    const FS = `
      precision highp float;
      uniform sampler2D img;
      uniform vec2 res, photo;
      uniform float dpr, rot, time;
      uniform vec3 view;
      uniform int count;
      uniform vec4 rip[${MAX}];            // x, y (photo px), start time, strength
      const float SPEED = 210.0;           // photo px per second
      const float LAMBDA = 34.0;           // ring spacing, photo px
      const float K = 6.2831853 / LAMBDA;
      const float LAG = LAMBDA * 1.2, SPREAD = LAMBDA * 1.25;
      const float LIFE = ${LIFE.toFixed(2)}, FADE = 0.85, FALLOFF = 110.0;
      void main() {
        vec2 css = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) / dpr;
        vec2 w = view.xy + css / view.z;
        vec2 p = rot > 0.5 ? vec2(w.y, photo.y - w.x) : w;
        vec2 g = vec2(0.0);                // surface slope
        float lap = 0.0;                   // surface curvature
        for (int i = 0; i < ${MAX}; i++) {
          if (i >= count) break;
          vec4 r = rip[i];
          float age = time - r.z;
          if (age < 0.0 || age > LIFE) continue;
          vec2 v = p - r.xy;
          float dist = length(v);
          float d = dist - age * SPEED;    // distance behind the wave front
          float u = (d + LAG) / SPREAD;
          if (abs(u) > 3.0) continue;      // no ring here
          float amp = 2.1 * r.w * exp(-age * FADE) * smoothstep(0.0, 0.3, age) / sqrt(1.0 + dist / FALLOFF);
          float tr = exp(-u * u), tr1 = -2.0 * u / SPREAD * tr, tr2 = (4.0 * u * u - 2.0) / (SPREAD * SPREAD) * tr;
          float sn = sin(K * d), cs = cos(K * d);
          float f1 = amp * (tr1 * sn + tr * K * cs);
          float f2 = amp * (tr2 * sn + 2.0 * tr1 * K * cs - tr * K * K * sn);
          float rr = max(dist, 1.0);
          g += f1 * v / rr;
          lap += f2 + f1 / rr;
        }
        vec2 uv = (p - g * 24.0) / photo;  // refraction
        if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0); return; }
        vec3 col = texture2D(img, uv).rgb;
        if (count > 0) {
          vec3 n = normalize(vec3(-g * 2.4, 1.0));
          vec3 L = normalize(vec3(0.55, -0.3, 1.0));          // sun from the right, as in the photo
          col *= 1.0 + 0.55 * (dot(n, L) / L.z - 1.0);       // slopes facing the sun are brighter
          col *= 1.0 + clamp(-lap * 9.0, -0.15, 0.35);        // caustics
          float spec = pow(max(dot(n, normalize(L + vec3(0.0, 0.0, 1.0))), 0.0), 180.0);
          col += vec3(1.0, 0.98, 0.92) * spec * 0.45;
        }
        gl_FragColor = vec4(col, 1.0);
      }`;
    const sh = (type, src) => {
      const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o));
      return o;
    };
    const prog = gl.createProgram();
    try {
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (err) { console.warn('water:', err); return; }
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aLoc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(aLoc);
    gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
    const U = {};
    for (const n of ['res', 'photo', 'dpr', 'rot', 'time', 'view', 'rip', 'count']) U[n] = gl.getUniformLocation(prog, n);

    const ripples = [];
    const t0 = performance.now();
    // ?t=<seconds> freezes the water at that moment (for screenshots)
    const freeze = params.has('t') ? parseFloat(params.get('t')) || 0 : null;
    const now = () => freeze ?? (performance.now() - t0) / 1000;
    const drop = (x, y, strength = 1) => {
      ripples.push({ x, y, t: now(), w: strength });
      if (ripples.length > MAX) ripples.shift();
    };
    // each anemone sends out a ring every few seconds, staggered
    for (const s of spots) s.nextRipple = 0.5 + s.index * 1.7;
    if (freeze !== null) for (const s of spots) { drop(s.cx, s.cy, 1); ripples[ripples.length - 1].t = freeze - (params.has('age') ? parseFloat(params.get('age')) : 0.7 + s.index * 0.9); s.nextRipple = Infinity; }

    const img = new Image();
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      } catch (err) { console.warn('water: photo unavailable to WebGL (open the site through a web server)', err); return; }
      water = { drop, render };
      render();
      requestAnimationFrame(frame);
    };
    img.src = PHOTO.src;

    const buf = new Float32Array(MAX * 4);
    let shown = false, wasActive = true;
    function frame() {
      requestAnimationFrame(frame);
      if (document.hidden || document.body.dataset.view !== 'about') return;
      const t = now();
      if (!svg.classList.contains('has-lift')) {
        for (const s of spots) {
          if (t < s.nextRipple) continue;
          const a = Math.random() * Math.PI * 2, j = Math.random() * s.r * 0.25;
          drop(s.cx + Math.cos(a) * j, s.cy + Math.sin(a) * j, 0.8 + Math.random() * 0.4);
          s.nextRipple = t + 7 + Math.random() * 3.5;
        }
      }
      while (ripples.length && t - ripples[0].t > LIFE) ripples.shift();
      // only draw while rings are moving (plus one clean frame after the last fades)
      if (ripples.length || wasActive) render();
      wasActive = ripples.length > 0;
    }
    function render() {
      const t = now();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      const cw = Math.round(W * dpr), ch = Math.round(H * dpr);
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
      gl.viewport(0, 0, cw, ch);
      buf.fill(0);
      ripples.forEach((r, i) => buf.set([r.x, r.y, r.t, r.w], i * 4));
      gl.uniform2f(U.res, cw, ch);
      gl.uniform2f(U.photo, PHOTO.w, PHOTO.h);
      gl.uniform1f(U.dpr, dpr);
      gl.uniform1f(U.rot, view.rotate ? 1 : 0);
      gl.uniform1f(U.time, t);
      gl.uniform3f(U.view, view.x0, view.y0, view.scale);
      gl.uniform1i(U.count, ripples.length);
      gl.uniform4fv(U.rip, buf);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!shown) { shown = true; svg.classList.add('gl'); }
    }
    canvas.addEventListener('webglcontextlost', () => { svg.classList.remove('gl'); water = null; });
  }

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
  if (window.ResizeObserver) new ResizeObserver(() => layout()).observe(scene);
  else window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(layout, 100); });
  window.addEventListener('hashchange', setView);

  if (params.has('debug')) svg.classList.add('debug');
  layout();
  setView();
  if (FX === 'ripple' && !reduceMotion) startWater();

  // ?peek=<creature> opens that note on load (handy for previews)
  const peek = spots.find((s) => s.key === params.get('peek'));
  if (peek) requestAnimationFrame(() => open(peek, true));
})();
