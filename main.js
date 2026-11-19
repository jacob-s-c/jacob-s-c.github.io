/* Tide pool about-me page.
 * Everything in the pool is drawn here as SVG in screen pixels, then laid
 * out to fit the window. Creatures are built once; layout() only moves them.
 */
(() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const TAU = Math.PI * 2;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const noHover = matchMedia('(hover: none)').matches;

  const $ = (id) => document.getElementById(id);
  const scene = $('scene');
  const floorSvg = $('floor');
  const creatureLayer = $('creatureLayer');
  const fishLayer = $('fishLayer');
  const rippleLayer = $('rippleLayer');
  const caustics = $('caustics');
  const card = $('card');

  /* ---------- helpers ---------- */
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function rng(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const r1 = (n) => Math.round(n * 10) / 10;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const pt = (p) => `${r1(p[0])},${r1(p[1])}`;

  function smoothClosed(pts) {
    const n = pts.length;
    let d = `M${pt(pts[0])}`;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
    }
    return d + 'Z';
  }
  const polyPath = (pts) => 'M' + pts.map(pt).join('L') + 'Z';

  /* ---------- creature art (local units, ~50 radius, centered on 0,0) ---------- */

  function drawStar(g) {
    const rand = rng(7);
    const arms = [1, 0.93, 1.05, 0.96, 1.02];
    const curl = [0.1, -0.08, 0.06, -0.12, 0.09];
    const rin = 16, rout = 50;
    const s = el('g', { transform: 'rotate(-90)' }, g);
    const pts = [];
    for (let i = 0; i < 300; i++) {
      const t = (i / 300) * TAU;
      const ai = ((Math.round(t / (TAU / 5)) % 5) + 5) % 5;
      const f = Math.pow((1 + Math.cos(5 * t)) / 2, 1.25);
      const r = rin + (rout * arms[ai] - rin) * f;
      const tt = t + curl[ai] * f;
      pts.push([Math.cos(tt) * r, Math.sin(tt) * r]);
    }
    el('path', { d: polyPath(pts), fill: 'url(#g-star)', stroke: '#3b1647', 'stroke-width': 1.2, 'stroke-linejoin': 'round' }, s);
    // raised ridge + reticulated white spines along each arm
    for (let i = 0; i < 5; i++) {
      const base = (i * TAU) / 5;
      const len = rout * arms[i];
      const along = (rho) => {
        const f = clamp((rho - rin) / (len - rin), 0, 1);
        return base + curl[i] * Math.pow(f, 0.8);
      };
      const ridge = [];
      for (let rho = 4; rho <= len - 6; rho += 3) ridge.push([Math.cos(along(rho)) * rho, Math.sin(along(rho)) * rho]);
      el('path', { d: 'M' + ridge.map(pt).join('L'), fill: 'none', stroke: '#b87cc4', 'stroke-width': 6, 'stroke-linecap': 'round', opacity: 0.28 }, s);
      for (let rho = 9; rho < len - 4; rho += 4.2) {
        const a = along(rho);
        const w = (1 - rho / 58) * 8.5 + 1;
        const nx = -Math.sin(a), ny = Math.cos(a);
        for (const side of [-1, 0, 1]) {
          const rr = rho + (side ? 2.1 : 0);
          if (rr > len - 4) continue;
          const jx = (rand() - 0.5) * 1.4, jy = (rand() - 0.5) * 1.4;
          el('circle', {
            cx: r1(Math.cos(a) * rr + nx * w * side + jx),
            cy: r1(Math.sin(a) * rr + ny * w * side + jy),
            r: r1(1.9 * (1 - rr / 70) + 0.55),
            fill: '#f1ddf3', opacity: side ? 0.78 : 0.92,
          }, s);
        }
      }
    }
    for (let k = 0; k < 5; k++) {
      const a = (k * TAU) / 5 + TAU / 10;
      el('circle', { cx: r1(Math.cos(a) * 7), cy: r1(Math.sin(a) * 7), r: 1.6, fill: '#f1ddf3', opacity: 0.85 }, s);
    }
    el('circle', { cx: 0, cy: 0, r: 1.7, fill: '#f1ddf3' }, s);
    // madreporite: the little sieve plate every sea star has, off-center
    el('circle', { cx: r1(Math.cos(TAU * 0.3) * 9), cy: r1(Math.sin(TAU * 0.3) * 9), r: 2.2, fill: '#e9a65a' }, s);
  }

  function drawAnemone(g) {
    const rand = rng(21);
    el('circle', { r: 49, fill: '#2b5a42' }, g);
    // gravel stuck to the column
    for (let i = 0; i < 22; i++) {
      const a = rand() * TAU, rr = 47 + rand() * 4;
      el('circle', { cx: r1(Math.cos(a) * rr), cy: r1(Math.sin(a) * rr), r: r1(1.4 + rand() * 2), fill: ['#a59d93', '#c9c0b3', '#7d756d', '#e4ddd0'][i % 4] }, g);
    }
    const ring = (n, ra, rb, color, tip, w, off, cls) => {
      const rg = el('g', { class: cls }, g);
      for (let i = 0; i < n; i++) {
        const a = ((i + off) / n) * TAU + (rand() - 0.5) * 0.08;
        const len = rb - rand() * 3;
        const x1 = Math.cos(a) * ra, y1 = Math.sin(a) * ra, x2 = Math.cos(a) * len, y2 = Math.sin(a) * len;
        el('line', { x1: r1(x1), y1: r1(y1), x2: r1(x2), y2: r1(y2), stroke: color, 'stroke-width': w, 'stroke-linecap': 'round' }, rg);
        el('circle', { cx: r1(x2), cy: r1(y2), r: r1(w * 0.36), fill: tip }, rg);
      }
    };
    ring(38, 30, 46, '#5eb688', '#a9e9c5', 6.4, 0, 'sway');
    ring(30, 23, 39, '#7ccfa1', '#c3f3d6', 5.6, 0.5, 'sway b');
    ring(22, 17, 30, '#9fe2b8', '#dcf9e7', 4.8, 0.25, 'sway c');
    el('circle', { r: 17, fill: 'url(#g-anem)' }, g);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      el('line', { x1: r1(Math.cos(a) * 5), y1: r1(Math.sin(a) * 5), x2: r1(Math.cos(a) * 15.5), y2: r1(Math.sin(a) * 15.5), stroke: '#2f6a4e', 'stroke-width': 0.8, opacity: 0.4 }, g);
    }
    el('ellipse', { rx: 5.5, ry: 2.3, fill: '#1d4433', transform: 'rotate(-20)' }, g);
  }

  function drawUrchin(g) {
    const rand = rng(33);
    el('circle', { r: 20, fill: '#341340' }, g);
    const spines = el('g', { class: 'spines' }, g);
    const layer = (n, r0, rmin, rmax, color, w) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + (rand() - 0.5) * 0.12;
        const len = rmin + rand() * (rmax - rmin);
        el('line', {
          x1: r1(Math.cos(a) * r0), y1: r1(Math.sin(a) * r0),
          x2: r1(Math.cos(a) * len), y2: r1(Math.sin(a) * len),
          stroke: color, 'stroke-width': w, 'stroke-linecap': 'round',
        }, spines);
      }
    };
    layer(84, 12, 34, 47, '#4a1b5c', 2.6);
    layer(66, 10, 27, 40, '#8a3ea7', 2.1);
    layer(44, 7, 17, 29, '#c27be0', 1.6);
    el('circle', { r: 3.4, fill: '#22092b' }, g);
    el('circle', { r: 1.2, cx: -0.8, cy: -0.8, fill: '#6d3a80' }, g);
  }

  function drawCrab(g) {
    const c = el('g', { transform: 'translate(10,0)' }, g);
    const crab = el('g', { class: 'crab-body' }, c);
    const P = (a) => `${a[0]},${a[1]}`;
    const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
    for (const side of [-1, 1]) {
      for (const j of [0, 1]) {
        const base = [-15, side * (5 + j * 5)];
        const knee = [-30 - j * 3, side * (17 + j * 9)];
        const tip = [-42 + j * 2, side * (15 + j * 16)];
        el('polyline', { points: `${P(base)} ${P(knee)} ${P(tip)}`, fill: 'none', stroke: '#c4513a', 'stroke-width': 4.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, crab);
        const b1 = mix(knee, tip, 0.35), b2 = mix(knee, tip, 0.62);
        el('line', { x1: b1[0], y1: b1[1], x2: b2[0], y2: b2[1], stroke: '#3f86e0', 'stroke-width': 4.4, 'stroke-linecap': 'butt' }, crab);
        const t1 = mix(knee, tip, 0.84);
        el('line', { x1: t1[0], y1: t1[1], x2: tip[0], y2: tip[1], stroke: '#f3e6cc', 'stroke-width': 3, 'stroke-linecap': 'round' }, crab);
      }
    }
    // claws (right one bigger, as in real hermit crabs)
    el('line', { x1: -20, y1: 3, x2: -30, y2: 7, stroke: '#b94530', 'stroke-width': 5, 'stroke-linecap': 'round' }, crab);
    el('ellipse', { cx: -38, cy: 7.5, rx: 9, ry: 6.2, fill: '#c9573d', transform: 'rotate(-8 -38 7.5)' }, crab);
    el('path', { d: 'M-46.5,7 L-39,8.2', stroke: '#5a1d12', 'stroke-width': 1.2, 'stroke-linecap': 'round' }, crab);
    for (const [x, y] of [[-36, 5], [-39, 4.6], [-34, 8.5], [-41, 9.6]]) el('circle', { cx: x, cy: y, r: 0.8, fill: '#f6e2cf', opacity: 0.8 }, crab);
    el('line', { x1: -20, y1: -3, x2: -28, y2: -6, stroke: '#b94530', 'stroke-width': 4, 'stroke-linecap': 'round' }, crab);
    el('ellipse', { cx: -33.5, cy: -6.5, rx: 6, ry: 4.2, fill: '#c9573d', transform: 'rotate(12 -33.5 -6.5)' }, crab);
    // head, eyes, antennae
    el('ellipse', { cx: -23, cy: 0, rx: 5, ry: 6, fill: '#b9533c' }, crab);
    for (const side of [-1, 1]) {
      el('line', { x1: -25, y1: side * 1.8, x2: -32, y2: side * 3.4, stroke: '#d77a5d', 'stroke-width': 2.2, 'stroke-linecap': 'round' }, crab);
      el('circle', { cx: -32.8, cy: side * 3.6, r: 2.1, fill: '#141414' }, crab);
      el('circle', { cx: -33.3, cy: side * 3.6 - 0.6, r: 0.6, fill: '#fff' }, crab);
      el('path', { d: `M-27,${side} Q-44,${side * 2} -58,${side * 13}`, fill: 'none', stroke: '#e04a3a', 'stroke-width': 0.9, 'stroke-linecap': 'round', class: side < 0 ? 'antenna' : 'antenna b' }, crab);
    }
    // black turban snail shell on top
    const sh = el('g', {}, c);
    el('ellipse', { cx: 6, cy: 0, rx: 26, ry: 24.5, fill: 'url(#g-shell)' }, sh);
    const spiral = [], hi = [];
    const turns = 2.4, cx = 9, cy = -1.5;
    for (let i = 0; i <= 120; i++) {
      const th = (i / 120) * turns * TAU;
      const rr = 2 + 20.5 * (i / 120);
      spiral.push([cx + Math.cos(th + 2.6) * rr, cy + Math.sin(th + 2.6) * rr * 0.95]);
      hi.push([cx - 0.9 + Math.cos(th + 2.6) * rr, cy - 0.9 + Math.sin(th + 2.6) * rr * 0.95]);
    }
    el('path', { d: 'M' + hi.map(pt).join('L'), fill: 'none', stroke: '#8d817c', 'stroke-width': 0.9, opacity: 0.45 }, sh);
    el('path', { d: 'M' + spiral.map(pt).join('L'), fill: 'none', stroke: '#171312', 'stroke-width': 1.6, opacity: 0.75 }, sh);
    el('path', { d: 'M-17,-11 Q-23,0 -17,11', fill: 'none', stroke: '#e9dfd2', 'stroke-width': 1.8, opacity: 0.55, 'stroke-linecap': 'round' }, sh);
    el('circle', { cx, cy, r: 3.4, fill: '#d3cad3' }, sh); // worn apex shows nacre
    el('circle', { cx: cx - 1, cy: cy - 1, r: 1.1, fill: '#fff', opacity: 0.8 }, sh);
  }

  function drawNudi(g) {
    const rand = rng(5);
    // oral tentacles + rhinophores (head points to +x)
    for (const side of [-1, 1]) {
      el('path', { d: `M38,${side * 3} Q46,${side * 5} 53,${side * 12}`, fill: 'none', stroke: '#a682e4', 'stroke-width': 2.2, 'stroke-linecap': 'round' }, g);
    }
    el('path', { d: 'M-48,0 C-30,-5 -5,-10 20,-10 C34,-10 42,-7 42,0 C42,7 34,10 20,10 C-5,10 -30,5 -48,0Z', fill: 'url(#g-nudi)' }, g);
    el('path', { d: 'M-40,0 L33,0', stroke: '#c3a6f0', 'stroke-width': 1.6, opacity: 0.55, 'stroke-linecap': 'round' }, g);
    const hw = (x) => (x < 20 ? 10 * Math.sqrt(Math.max(0, 1 - ((20 - x) / 68) ** 2)) : 10 * Math.sqrt(Math.max(0, 1 - ((x - 20) / 22) ** 2)));
    const cer = el('g', { class: 'cerata' }, g);
    for (let x = -36; x <= 25; x += 5.4) {
      for (const side of [-1, 1]) {
        const by = side * hw(x) * 0.5;
        for (const j of [0, 1]) {
          const ang = side * (100 + j * 26 + (rand() - 0.5) * 10) * (Math.PI / 180);
          const len = 6.4 + rand() * 1.6;
          const mx = x + Math.cos(ang) * len * 0.75, my = by + Math.sin(ang) * len * 0.75;
          el('ellipse', { cx: r1(mx), cy: r1(my), rx: r1(len), ry: 2.4, fill: '#f0882a', transform: `rotate(${r1((ang * 180) / Math.PI)} ${r1(mx)} ${r1(my)})` }, cer);
          el('circle', { cx: r1(x + Math.cos(ang) * len * 1.55), cy: r1(by + Math.sin(ang) * len * 1.55), r: 1.5, fill: '#ffc46e' }, cer);
        }
      }
    }
    for (const side of [-1, 1]) {
      el('line', { x1: 31, y1: side * 4, x2: 39, y2: side * 9, stroke: '#c62f3a', 'stroke-width': 3.4, 'stroke-linecap': 'round' }, g);
    }
  }

  function drawMussels(g) {
    const rand = rng(9);
    const one = (L, W, ang, x, y) => {
      const m = el('g', { transform: `translate(${x},${y}) rotate(${ang})` }, g);
      const d = `M0,0 C${r1(0.2 * L)},${r1(-0.6 * W)} ${r1(0.78 * L)},${r1(-0.66 * W)} ${r1(L)},${r1(-0.08 * W)} C${r1(1.03 * L)},${r1(0.26 * W)} ${r1(0.72 * L)},${r1(0.56 * W)} ${r1(0.38 * L)},${r1(0.44 * W)} C${r1(0.16 * L)},${r1(0.35 * W)} ${r1(0.03 * L)},${r1(0.16 * W)} 0,0Z`;
      el('path', { d, fill: 'url(#g-mussel)', stroke: '#0b1119', 'stroke-width': 0.8 }, m);
      for (const k of [0.46, 0.66, 0.84]) el('path', { d, fill: 'none', stroke: '#0e1722', 'stroke-width': r1(0.7 / k), opacity: 0.6, transform: `scale(${k})` }, m);
      el('path', { d: `M${r1(0.14 * L)},${r1(-0.26 * W)} Q${r1(0.5 * L)},${r1(-0.52 * W)} ${r1(0.86 * L)},${r1(-0.3 * W)}`, fill: 'none', stroke: '#8aa1bb', 'stroke-width': 1.6, opacity: 0.45, 'stroke-linecap': 'round' }, m);
    };
    const angles = [-58, -34, -12, 10, 31, 54];
    angles.forEach((a, i) => {
      const L = 38 + rand() * 9, W = 16 + rand() * 3;
      one(L, W, a, -28 + (rand() - 0.5) * 6, (i - 2.5) * 3 + (rand() - 0.5) * 3);
    });
    one(30, 13, -2, -14, -2); // a young one on top
    for (const [x, y, r] of [[2, -20, 3.2], [8, 15, 2.6], [-4, 4, 2.2], [14, -4, 2.8]]) {
      el('circle', { cx: x, cy: y, r, fill: '#d9d1c2', stroke: '#9b9283', 'stroke-width': 0.6 }, g);
      el('circle', { cx: x, cy: y, r: r * 0.42, fill: '#5d544c' }, g);
    }
  }

  function drawFish(g) {
    const tail = el('g', {}, g);
    el('path', { d: 'M-13,0 C-17,-1 -21,-4.5 -25,-4.2 C-23.5,-1.4 -23.5,1.4 -25,4.2 C-21,4.5 -17,1 -13,0Z', fill: '#7d7856' }, tail);
    for (const s of [-1, 1]) {
      el('path', { d: `M3,${s * 4} Q1,${s * 13} -6,${s * 12.5} Q-3,${s * 7} -2,${s * 4}Z`, fill: '#8f8a62', opacity: 0.85 }, g);
    }
    el('path', { d: 'M15,0 C15,-5.5 8,-7.5 2,-6.5 C-5,-5 -11,-2.5 -14,0 C-11,2.5 -5,5 2,6.5 C8,7.5 15,5.5 15,0Z', fill: '#6f6a4b' }, g);
    for (const [x, y, rx, ry, c] of [[5, 0, 3, 2.4, '#4b4733'], [-3, -1.5, 2.5, 1.6, '#4b4733'], [-8, 0.8, 2, 1.3, '#4b4733'], [0, 2, 2, 1.2, '#a19a73'], [9, -2, 1.6, 1, '#a19a73']]) {
      el('ellipse', { cx: x, cy: y, rx, ry, fill: c, opacity: 0.75 }, g);
    }
    for (const s of [-1, 1]) {
      el('circle', { cx: 10.5, cy: s * 3.2, r: 1.6, fill: '#1d1c14' }, g);
      el('circle', { cx: 10.9, cy: s * 3.2 - 0.5, r: 0.5, fill: '#fff', opacity: 0.8 }, g);
    }
    return tail;
  }

  const SPECIES = {
    star:    { name: 'Ochre sea star', sci: 'Pisaster ochraceus', accent: '#8d4b9c', r: 52, size: 1, draw: drawStar },
    anemone: { name: 'Giant green anemone', sci: 'Anthopleura xanthogrammica', accent: '#3d9a6c', r: 52, size: 1.02, draw: drawAnemone },
    crab:    { name: 'Hermit crab', sci: 'Pagurus samuelis', accent: '#c4513a', r: 50, size: 0.9, draw: drawCrab },
    urchin:  { name: 'Purple sea urchin', sci: 'Strongylocentrotus purpuratus', accent: '#7b3b95', r: 48, size: 0.85, draw: drawUrchin },
    nudi:    { name: 'Spanish shawl', sci: 'Flabellinopsis iodinea', accent: '#e2862c', r: 50, size: 0.95, draw: drawNudi },
    mussels: { name: 'California mussels', sci: 'Mytilus californianus', accent: '#3b5677', r: 50, size: 1, draw: drawMussels },
  };

  // [u, v, rotation] in pool-normalized coordinates (-1..1); mussels sit on the rim at an angle.
  const LAYOUTS = {
    wide: {
      star: [-0.5, -0.3, -8], anemone: [0.05, -0.42, 0], urchin: [0.52, -0.22, 0],
      crab: [-0.17, 0.34, -25], nudi: [0.4, 0.38, -160], mussels: { rim: 2.78 },
    },
    tall: {
      star: [-0.36, -0.58, 10], anemone: [0.42, -0.36, 0], urchin: [-0.42, -0.08, 0],
      crab: [0.4, 0.14, 200], nudi: [-0.22, 0.48, -115], mussels: { rim: 0.98 },
    },
  };

  /* ---------- state ---------- */
  let W = 0, H = 0, P = null, S = 1, poolD = '';
  const creatures = [];   // { key, g, art, x, y, R, data, article, index }
  const found = new Set();
  let current = null, pinned = false, closeTimer = 0;
  let pointer = null;

  const poolK = (t) => 1 + 0.065 * Math.sin(2 * t + 1.3) + 0.05 * Math.sin(3 * t + 0.4) + 0.03 * Math.sin(5 * t + 2.1) + 0.016 * Math.sin(8 * t + 0.7) + 0.008 * Math.sin(13 * t + 1.9);
  const poolPoint = (t, k = 1) => [P.cx + P.rx * poolK(t) * k * Math.cos(t), P.cy + P.ry * poolK(t) * k * Math.sin(t)];
  const poolDepth = (x, y) => { // <1 inside the pool
    const u = (x - P.cx) / P.rx, v = (y - P.cy) / P.ry;
    return Math.hypot(u, v) / poolK(Math.atan2(v, u));
  };

  /* ---------- build creatures (once) ---------- */
  function buildCreatures() {
    const notes = [...document.querySelectorAll('#notes article[data-creature]')];
    notes.forEach((article, index) => {
      const key = article.dataset.creature;
      const data = SPECIES[key];
      if (!data) return;
      const g = el('g', { class: 'creature', tabindex: 0, role: 'button', 'aria-label': `${data.name}: ${article.querySelector('h2')?.textContent || ''}`, 'aria-controls': 'card' }, creatureLayer);
      el('circle', { class: 'hit', r: data.r }, g);
      const shadowNear = el('use', { class: 'shadow-near', href: `#art-${key}`, filter: 'url(#shNear)' }, g);
      const shadowFar = el('use', { class: 'shadow-far', href: `#art-${key}`, filter: 'url(#shFar)' }, g);
      el('circle', { class: 'pulse', r: data.r * 0.92, style: `--delay:${(index * 0.9).toFixed(1)}s` }, g);
      el('circle', { class: 'focus-ring', r: data.r + 6 }, g);
      const lift = el('g', { class: 'lift' }, g);
      const art = el('g', { id: `art-${key}` }, lift);
      data.draw(art);
      void shadowNear; void shadowFar;
      creatures.push({ key, g, art, data, article, index, x: 0, y: 0, R: 0 });
    });

    const dots = $('foundDots');
    creatures.forEach((c) => {
      const i = document.createElement('i');
      i.style.setProperty('--c', c.data.accent);
      dots.appendChild(i);
      c.dot = i;
    });
    $('foundText').textContent = `0 of ${creatures.length} found`;
  }

  /* ---------- fish ---------- */
  const fishes = [];
  function buildFish() {
    for (let i = 0; i < 3; i++) {
      const shadow = el('use', { href: `#fish-${i}`, filter: 'url(#shFar)', opacity: 0.8 }, fishLayer);
      const g = el('g', { id: `fish-${i}` }, fishLayer);
      const tail = drawFish(g);
      fishes.push({ g, shadow, tail, x: 0, y: 0, a: Math.random() * TAU, v: 0, w: 0, phase: Math.random() * 10, resting: true, timer: 30 + Math.random() * 120, placed: false });
    }
  }

  /* ---------- layout ---------- */
  function layout() {
    W = scene.clientWidth;
    H = scene.clientHeight;
    const headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72;
    const top = headerH + 34, bottom = 58, side = W < 640 ? 14 : 56;
    let rx = (W - 2 * side) / 2 / 1.12;
    let ry = (H - top - bottom) / 2 / 1.12;
    rx = Math.min(rx, ry * 1.65);
    ry = Math.min(ry, rx * 1.95);
    P = { cx: W / 2, cy: top + (H - top - bottom) / 2, rx, ry };
    const tall = W / H < 0.85;
    S = clamp(Math.min(rx, ry) / (tall ? 215 : 255), 0.55, 1.4);

    const pts = [];
    for (let i = 0; i < 96; i++) pts.push(poolPoint((i / 96) * TAU));
    poolD = smoothClosed(pts);

    // creatures
    const L = tall ? LAYOUTS.tall : LAYOUTS.wide;
    for (const c of creatures) {
      const spec = L[c.key];
      let x, y, rot;
      if (spec.rim !== undefined) {
        [x, y] = poolPoint(spec.rim, 0.985);
        rot = (Math.atan2(P.cy - y, P.cx - x) * 180) / Math.PI;
      } else {
        x = P.cx + spec[0] * P.rx;
        y = P.cy + spec[1] * P.ry;
        rot = spec[2];
      }
      const s = S * c.data.size;
      c.x = x; c.y = y; c.R = c.data.r * s;
      c.g.setAttribute('transform', `translate(${r1(x)},${r1(y)}) scale(${s.toFixed(3)})`);
      c.art.setAttribute('transform', `rotate(${r1(rot)})`);
    }

    buildFloor();
    $('lifeClipPath').setAttribute('d', poolD);
    $('sheen').setAttribute('d', poolD);
    caustics.style.clipPath = `path('${poolD}')`;

    for (const f of fishes) {
      if (!f.placed || poolDepth(f.x, f.y) > 0.8) {
        const t = Math.random() * TAU, k = 0.2 + Math.random() * 0.45;
        f.x = P.cx + Math.cos(t) * P.rx * k;
        f.y = P.cy + Math.sin(t) * P.ry * k;
        f.placed = true;
      }
      drawFishFrame(f);
    }
    if (current) placeCard(current);
  }

  /* ---------- pool floor & rim (rebuilt on resize) ---------- */
  function buildFloor() {
    const rand = rng(42);
    floorSvg.innerHTML = `
      <defs>
        <radialGradient id="g-depth" r="50%">
          <stop offset="0" stop-color="#0b3d4b"/><stop offset=".45" stop-color="#145f69"/>
          <stop offset=".75" stop-color="#2d8580"/><stop offset=".92" stop-color="#5ca596"/><stop offset="1" stop-color="#8ebfa4"/>
        </radialGradient>
        <radialGradient id="g-pebble" cx="38%" cy="35%" r="70%">
          <stop offset="0" stop-color="#b9bdb3"/><stop offset=".6" stop-color="#7d837d"/><stop offset="1" stop-color="#4d5552"/>
        </radialGradient>
        <radialGradient id="g-limpet" cx="45%" cy="40%" r="60%">
          <stop offset="0" stop-color="#efe6d4"/><stop offset=".5" stop-color="#b3a58c"/><stop offset="1" stop-color="#6e6352"/>
        </radialGradient>
        <filter id="floorTex" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="4" seed="3" result="n"/>
          <feDiffuseLighting in="n" surfaceScale="3" diffuseConstant="1.3" lighting-color="#fff" result="lit"><feDistantLight azimuth="225" elevation="50"/></feDiffuseLighting>
          <feComposite in="lit" in2="SourceGraphic" operator="arithmetic" k1="1.05" result="shade"/>
          <feComposite in="shade" in2="SourceAlpha" operator="in"/>
        </filter>
        <filter id="blur12" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="12"/></filter>
        <filter id="blur6" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>
        <filter id="blur2" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2"/></filter>
        <filter id="crust" x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="8"/>
          <feDisplacementMap in="SourceGraphic" scale="9"/>
        </filter>
        <filter id="frill" x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="2"/>
          <feDisplacementMap in="SourceGraphic" scale="14"/>
        </filter>
        <clipPath id="poolClip"><path d="${poolD}"/></clipPath>
      </defs>`;

    const avoid = creatures.map((c) => ({ x: c.x, y: c.y, r: c.R + 14 }));
    const clear = (x, y, r) => avoid.every((a) => Math.hypot(x - a.x, y - a.y) > a.r + r);

    // wet, darkened rock right around the water
    el('path', { d: poolD, fill: 'none', stroke: '#2b2521', 'stroke-width': 54 * S, opacity: 0.42, filter: 'url(#blur12)' }, floorSvg);

    // barnacles & limpets on the rock
    const rock = el('g', {}, floorSvg);
    for (let i = 0; i < 110; i++) {
      const t = rand() * TAU;
      if (Math.sin(t * 3 + 1) < -0.35 && rand() < 0.7) continue; // patchy
      const [x, y] = poolPoint(t, 1.03 + Math.pow(rand(), 1.6) * 0.16);
      const r = (2 + rand() * 3.4) * S;
      el('circle', { cx: r1(x), cy: r1(y), r: r1(r), fill: '#d6cebf', stroke: '#8a8176', 'stroke-width': 0.6 }, rock);
      el('circle', { cx: r1(x), cy: r1(y), r: r1(r * 0.42), fill: '#5b524a' }, rock);
    }
    for (let i = 0; i < 6; i++) {
      const [x, y] = poolPoint(rand() * TAU, 1.08 + rand() * 0.1);
      const r = (6 + rand() * 3) * S;
      el('ellipse', { cx: r1(x), cy: r1(y), rx: r1(r), ry: r1(r * 0.82), fill: 'url(#g-limpet)', stroke: '#5e5445', 'stroke-width': 0.7, transform: `rotate(${r1(rand() * 180)} ${r1(x)} ${r1(y)})` }, rock);
      el('circle', { cx: r1(x), cy: r1(y), r: r1(1.2 * S), fill: '#f6efe2' }, rock);
    }

    el('path', { d: poolD, fill: 'none', stroke: '#1b1714', 'stroke-width': 8, opacity: 0.55, filter: 'url(#blur2)' }, floorSvg);

    // water + floor
    el('path', { d: poolD, fill: 'url(#g-depth)', filter: 'url(#floorTex)' }, floorSvg);

    const inPool = el('g', { 'clip-path': 'url(#poolClip)' }, floorSvg);
    for (let i = 0; i < 4; i++) {
      el('ellipse', {
        cx: r1(P.cx + (rand() - 0.5) * P.rx * 0.7), cy: r1(P.cy + (rand() - 0.5) * P.ry * 0.6),
        rx: r1(P.rx * (0.15 + rand() * 0.15)), ry: r1(P.ry * (0.12 + rand() * 0.12)),
        fill: '#06303b', opacity: 0.32, filter: 'url(#blur12)',
      }, inPool);
    }

    // coralline algae crust (the pink paint of tide pools)
    const crust = el('g', { filter: 'url(#crust)' }, inPool);
    for (let i = 0; i < 26; i++) {
      const t = rand() * TAU;
      const [x, y] = poolPoint(t, 0.97 - rand() * 0.07);
      const ang = (t * 180) / Math.PI + 90;
      el('ellipse', { cx: r1(x), cy: r1(y), rx: r1((10 + rand() * 24) * S), ry: r1((5 + rand() * 9) * S), fill: rand() < 0.5 ? '#d68a96' : '#c97a8a', opacity: r1(0.45 + rand() * 0.25), transform: `rotate(${r1(ang)} ${r1(x)} ${r1(y)})` }, crust);
    }

    // sea lettuce
    const ulva = el('g', { filter: 'url(#frill)' }, inPool);
    for (let i = 0; i < 4; i++) {
      const [bx, by] = poolPoint(rand() * TAU, 0.82 + rand() * 0.1);
      if (!clear(bx, by, 26 * S)) continue;
      for (let j = 0; j < 3; j++) {
        el('ellipse', { cx: r1(bx + (rand() - 0.5) * 30 * S), cy: r1(by + (rand() - 0.5) * 22 * S), rx: r1((14 + rand() * 12) * S), ry: r1((8 + rand() * 8) * S), fill: '#93d675', opacity: 0.42, transform: `rotate(${r1(rand() * 180)} ${r1(bx)} ${r1(by)})` }, ulva);
      }
    }

    // pebbles + small turban snails
    let placed = 0;
    for (let tries = 0; tries < 200 && placed < 18; tries++) {
      const t = rand() * TAU, k = Math.sqrt(rand()) * 0.86;
      const x = P.cx + Math.cos(t) * P.rx * k * poolK(t), y = P.cy + Math.sin(t) * P.ry * k * poolK(t);
      const r = (4 + rand() * 10) * S;
      if (!clear(x, y, r)) continue;
      el('ellipse', { cx: r1(x), cy: r1(y), rx: r1(r), ry: r1(r * (0.65 + rand() * 0.3)), fill: 'url(#g-pebble)', opacity: 0.78, transform: `rotate(${r1(rand() * 180)} ${r1(x)} ${r1(y)})` }, inPool);
      placed++;
    }
    placed = 0;
    for (let tries = 0; tries < 120 && placed < 6; tries++) {
      const t = rand() * TAU, k = 0.4 + rand() * 0.5;
      const x = P.cx + Math.cos(t) * P.rx * k, y = P.cy + Math.sin(t) * P.ry * k;
      const r = (3.6 + rand() * 1.6) * S;
      if (!clear(x, y, r + 6)) continue;
      el('circle', { cx: r1(x), cy: r1(y), r: r1(r), fill: '#2a2423', stroke: '#141010', 'stroke-width': 0.6 }, inPool);
      el('circle', { cx: r1(x + r * 0.15), cy: r1(y - r * 0.15), r: r1(r * 0.3), fill: '#a69aa3' }, inPool);
      placed++;
    }

    // surfgrass clumps growing in from the edge
    const grassColors = ['#3e9a4b', '#4fb05a', '#2f8540', '#62c06c'];
    for (let i = 0; i < 4; i++) {
      const t = (i / 4) * TAU + 0.5 + rand() * 0.8;
      const [bx, by] = poolPoint(t, 1.0);
      const dir = Math.atan2(P.cy - by, P.cx - bx);
      const tip = [bx + Math.cos(dir) * 90 * S, by + Math.sin(dir) * 90 * S];
      if (!clear(tip[0], tip[1], 20 * S)) continue;
      const clump = el('g', { class: 'grass', style: `transform-box:view-box;transform-origin:${r1(bx)}px ${r1(by)}px;animation-delay:${r1(-rand() * 6)}s` }, inPool);
      for (let j = 0; j < 7; j++) {
        const L = (50 + rand() * 60) * S, a = dir + (rand() - 0.5) * 0.7;
        const nx = -Math.sin(a), ny = Math.cos(a);
        const sx = bx + (rand() - 0.5) * 14 * S, sy = by + (rand() - 0.5) * 14 * S;
        const c1 = [sx + Math.cos(a) * L * 0.5 + nx * (rand() - 0.5) * L * 0.5, sy + Math.sin(a) * L * 0.5 + ny * (rand() - 0.5) * L * 0.5];
        const e = [sx + Math.cos(a) * L + nx * (rand() - 0.5) * L * 0.6, sy + Math.sin(a) * L + ny * (rand() - 0.5) * L * 0.6];
        el('path', { d: `M${pt([sx, sy])} Q${pt(c1)} ${pt(e)}`, fill: 'none', stroke: grassColors[j % 4], 'stroke-width': r1((2.6 + rand() * 2) * S), 'stroke-linecap': 'round', opacity: 0.92 }, clump);
      }
    }

    // shadow under the overhanging rim
    el('path', { d: poolD, fill: 'none', stroke: '#03222a', 'stroke-width': 26 * S, opacity: 0.45, filter: 'url(#blur6)' }, inPool);
    // meniscus glint
    el('path', { d: poolD, fill: 'none', stroke: '#d8f3ea', 'stroke-width': 1.4, opacity: 0.4 }, floorSvg);
  }

  /* ---------- ripples ---------- */
  let lastRipple = 0, lastRx = 0, lastRy = 0;
  function ripple(x, y, r, big) {
    if (reduceMotion || rippleLayer.childElementCount > 10) return;
    const c = el('circle', { cx: r1(x), cy: r1(y), r: r1(r), class: big ? 'ripple big' : 'ripple' }, rippleLayer);
    c.addEventListener('animationend', () => c.remove());
  }

  /* ---------- fish motion ---------- */
  function drawFishFrame(f) {
    const deg = r1((f.a * 180) / Math.PI);
    const s = (S * 0.95).toFixed(3);
    f.g.setAttribute('transform', `translate(${r1(f.x)},${r1(f.y)}) rotate(${deg}) scale(${s})`);
    f.shadow.setAttribute('transform', `translate(${r1(f.x + 6 * S)},${r1(f.y + 10 * S)}) rotate(${deg}) scale(${s})`);
    f.tail.setAttribute('transform', `rotate(${r1(Math.sin(f.phase) * (10 + f.v * 9))} -13 0)`);
  }

  let last = performance.now();
  function tick(now) {
    const dt = Math.min(3, (now - last) / 16.67);
    last = now;
    for (const f of fishes) {
      f.timer -= dt;
      if (f.timer < 0) {
        f.resting = !f.resting;
        f.timer = f.resting ? 60 + Math.random() * 220 : 50 + Math.random() * 160;
      }
      let steer = 0;
      let target = f.resting ? 0 : 1.1;
      f.w = clamp(f.w + (Math.random() - 0.5) * 0.35 * dt, -1, 1);
      steer += f.w * 0.025;
      const d = poolDepth(f.x, f.y);
      if (d > 0.7) steer += angDiff(Math.atan2(P.cy - f.y, P.cx - f.x), f.a) * (d - 0.7) * 0.6;
      for (const c of creatures) {
        const dist = Math.hypot(f.x - c.x, f.y - c.y);
        if (dist < c.R + 28 * S) steer += angDiff(Math.atan2(f.y - c.y, f.x - c.x), f.a) * 0.06;
      }
      if (pointer) {
        const dist = Math.hypot(f.x - pointer.x, f.y - pointer.y);
        if (dist < 120 * S) {
          steer += angDiff(Math.atan2(f.y - pointer.y, f.x - pointer.x), f.a) * 0.3;
          target = 4.2;
          f.resting = false;
          f.timer = Math.max(f.timer, 40);
        }
      }
      if (f.resting) steer *= 0.15;
      f.a += clamp(steer, -0.14, 0.14) * dt;
      f.v += (target - f.v) * 0.07 * dt;
      f.x += Math.cos(f.a) * f.v * dt * S;
      f.y += Math.sin(f.a) * f.v * dt * S;
      f.phase += (0.08 + f.v * 0.3) * dt;
      drawFishFrame(f);
    }
    requestAnimationFrame(tick);
  }

  /* ---------- card ---------- */
  function placeCard(c) {
    const isMobile = W <= 640;
    if (isMobile) {
      card.classList.toggle('at-top', c.y > H * 0.55);
      return;
    }
    const rect = c.g.querySelector('.hit').getBoundingClientRect();
    const sr = scene.getBoundingClientRect();
    const cw = card.offsetWidth, ch = card.offsetHeight;
    const gap = 22;
    const cx = rect.left - sr.left + rect.width / 2;
    const cy = rect.top - sr.top + rect.height / 2;
    const roomRight = W - (rect.right - sr.left) - 16;
    const roomLeft = rect.left - sr.left - 16;
    const need = cw + gap;
    // open toward the pool's edge (away from the other creatures) when there's room
    const preferRight = cx > P.cx;
    let x, origin;
    if (preferRight ? roomRight >= need : roomLeft < need && roomRight >= need) {
      x = rect.right - sr.left + gap; origin = 'left center';
    } else if (roomLeft >= need) {
      x = rect.left - sr.left - gap - cw; origin = 'right center';
    } else if (roomRight >= need) {
      x = rect.right - sr.left + gap; origin = 'left center';
    } else {
      x = clamp(cx - cw / 2, 16, W - cw - 16); origin = 'center top';
    }
    const headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72;
    let y = origin === 'center top' ? rect.bottom - sr.top + 12 : cy - ch / 2;
    y = clamp(y, headerH + 8, H - ch - 16);
    card.style.left = `${Math.round(x)}px`;
    card.style.top = `${Math.round(y)}px`;
    card.style.transformOrigin = origin;
  }

  function open(c, pin = false) {
    clearTimeout(closeTimer);
    if (pin) pinned = true;
    if (current === c) return;
    if (current) current.g.classList.remove('lifted');
    current = c;
    c.g.classList.add('lifted');
    ripple(c.x, c.y, c.R * 1.5, true);

    card.style.setProperty('--accent', c.data.accent);
    card.querySelector('.card-no').textContent = `No. ${String(c.index + 1).padStart(2, '0')} / ${String(creatures.length).padStart(2, '0')}`;
    card.querySelector('.card-sci').textContent = c.data.sci;
    card.querySelector('.card-body').innerHTML = c.article.innerHTML;
    placeCard(c);
    card.classList.add('open');

    if (!found.has(c.key)) {
      found.add(c.key);
      c.g.classList.add('found');
      c.dot.classList.add('on');
      const n = found.size, total = creatures.length;
      $('foundText').textContent = n === total ? 'You met everyone. Thanks for visiting!' : `${n} of ${total} found`;
      if (n === 1) $('hint').style.opacity = '0';
    }
  }

  function close() {
    clearTimeout(closeTimer);
    pinned = false;
    if (!current) return;
    current.g.classList.remove('lifted');
    current = null;
    card.classList.remove('open');
  }
  const scheduleClose = () => {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => { if (!pinned) close(); }, 380);
  };

  function bind() {
    for (const c of creatures) {
      c.g.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') open(c); });
      c.g.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !pinned) scheduleClose(); });
      c.g.addEventListener('click', (e) => {
        e.stopPropagation();
        if (current === c && pinned) close();
        else open(c, true);
      });
      c.g.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(c, true); }
      });
      c.g.addEventListener('focus', () => { if (c.g.matches(':focus-visible')) open(c); });
    }
    card.addEventListener('pointerenter', () => clearTimeout(closeTimer));
    card.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !pinned) scheduleClose(); });
    card.addEventListener('click', (e) => e.stopPropagation());

    scene.addEventListener('click', (e) => {
      const r = scene.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (poolDepth(x, y) < 1) ripple(x, y, 40 * S, true);
      close();
    });
    scene.addEventListener('pointermove', (e) => {
      const r = scene.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (poolDepth(x, y) >= 1) { pointer = null; return; }
      pointer = { x, y };
      const now = performance.now();
      if (e.pointerType === 'mouse' && now - lastRipple > 130 && Math.hypot(x - lastRx, y - lastRy) > 26) {
        ripple(x, y, 26 * S, false);
        lastRipple = now; lastRx = x; lastRy = y;
      }
    });
    scene.addEventListener('pointerleave', () => { pointer = null; });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

    let rt = 0;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(layout, 120); });
    window.addEventListener('hashchange', setView);
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

  /* ---------- go ---------- */
  if (noHover) $('hint').textContent = 'Tap a creature to say hello';
  buildCreatures();
  buildFish();
  layout();
  bind();
  setView();
  if (!reduceMotion) requestAnimationFrame(tick);

  // ?peek=star opens a note on load (handy for previews and sharing)
  const peek = new URLSearchParams(location.search).get('peek');
  const peekC = creatures.find((c) => c.key === peek);
  if (peekC) requestAnimationFrame(() => open(peekC, true));
})();
