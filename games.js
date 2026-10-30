'use strict';
/* ألعاب الفيزياء: six level-based games (two per grade) sharing one small engine.
   Loaded after the main script, so it uses its helpers: store, S, G, addXP, icon, esc, toast, render, navBar, simStop. */

/* ---------------- Sound (Web Audio, no files) ---------------- */
const SFX = {
  ctx: null, on: store.get('sfx', true),
  init() {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  play(kind) {
    if (!this.on || !this.ctx) return;
    const a = this.ctx, t = a.currentTime;
    const osc = (type, f1, f2, d, v, at = 0) => {
      const o = a.createOscillator(), g = a.createGain(); o.type = type;
      o.frequency.setValueAtTime(f1, t + at); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + at + d);
      g.gain.setValueAtTime(0.0001, t + at); g.gain.exponentialRampToValueAtTime(v, t + at + .01); g.gain.exponentialRampToValueAtTime(.0001, t + at + d);
      o.connect(g).connect(a.destination); o.start(t + at); o.stop(t + at + d + .05);
    };
    const noise = (d, v, f) => {
      const b = a.createBuffer(1, Math.floor(a.sampleRate * d), a.sampleRate), ch = b.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length) ** 2;
      const s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain();
      fl.type = 'lowpass'; fl.frequency.value = f; g.gain.value = v; s.buffer = b; s.connect(fl).connect(g).connect(a.destination); s.start(t);
    };
    if (kind === 'boom') { noise(1, .6, 700); osc('sine', 110, 35, .6, .5); }
    else if (kind === 'shoot') { noise(.35, .45, 1800); osc('triangle', 180, 50, .3, .3); }
    else if (kind === 'win') [523, 659, 784, 1047].forEach((f, i) => osc('triangle', f, 0, .35, .18, i * .11));
    else if (kind === 'fail') { osc('sawtooth', 260, 90, .45, .1); }
    else if (kind === 'splash') noise(.7, .4, 1200);
    else if (kind === 'screech') { osc('sawtooth', 1100, 600, .7, .04); noise(.7, .1, 3500); }
    else if (kind === 'crack') noise(.3, .5, 2600);
    else if (kind === 'thud') { noise(.25, .4, 400); osc('sine', 90, 50, .2, .3); }
    else if (kind === 'pop') osc('sine', 600, 900, .08, .12);
  },
};

/* ---------------- Engine ---------------- */
const nb = (v, u = '') => `<bdi dir="ltr">${v}${u ? ' ' + u : ''}</bdi>`;
const gAll = () => store.get('games', {});
const gStars = (id, i) => (gAll()[id] || {})[i] || 0;
const gamesFor = grade => Object.entries(GAMES).filter(([, g]) => g.g === grade);
const gTotal = id => GAMES[id].levels.reduce((n, _, i) => n + gStars(id, i), 0);
let GPLAY = null;

function gamesCard() {
  const list = gamesFor(S.grade); if (!list.length) return '';
  return `<button class="games-card" data-go="games"><span class="gi">🎮</span>
    <span class="t"><b>ألعاب الفيزياء</b><small>${list.map(([, g]) => g.ic + ' ' + g.t).join(' · ')}</small></span>
    <span class="qb-go">العب ${icon('chev')}</span></button>`;
}
function vGames() {
  const list = gamesFor(S.grade);
  return `<div class="view push">${navBar()}
    <div class="page-h" style="padding-top:4px"><h1 style="font-size:28px">ألعاب الفيزياء</h1><p>لا تفوز إلا إذا طبّقت القانون الصحيح. اجمع النجوم وافتح المستويات.</p></div>
    <div class="g-list">${list.map(([id, g]) => `<button class="g-tile" data-go="game:${id}" style="--g1:${g.c[0]};--g2:${g.c[1]}">
      <span class="g-ic">${g.ic}</span><span class="t"><small>${esc(g.topic)}</small><b>${esc(g.t)}</b><span>${esc(g.sub)}</span>
      <span class="g-prog">⭐ ${gTotal(id)} / ${g.levels.length * 3}</span></span></button>`).join('')}</div></div>`;
}
function vGameLevels(id) {
  const g = GAMES[id], open = i => i === 0 || gStars(id, i - 1) > 0;
  return `<div class="view push">${navBar()}
    <section class="g-hero" style="--g1:${g.c[0]};--g2:${g.c[1]}"><span class="g-ic">${g.ic}</span><small>${esc(g.topic)}</small><h1>${esc(g.t)}</h1><p>${esc(g.sub)}</p></section>
    <div class="g-levels">${g.levels.map((L, i) => `<button class="g-lv ${open(i) ? '' : 'lock'}" ${open(i) ? `data-go="glevel:${id}:${i}"` : 'aria-disabled="true"'}>
      <b>${open(i) ? i + 1 : '🔒'}</b><small>${esc(L.name)}</small><span>${'★'.repeat(gStars(id, i))}${'☆'.repeat(3 - gStars(id, i))}</span></button>`).join('')}</div>
    <p class="hint" style="margin-top:12px">يُفتح المستوى التالي عندما تنجح في المستوى الذي قبله.</p></div>`;
}
const gCtlHTML = k => `<div class="ctl"><label for="gc-${k.id}">${k.label}<output id="gc-${k.id}-o"></output></label><input type="range" id="gc-${k.id}" min="${k.min}" max="${k.max}" step="${k.step}" value="${k.v}"></div>`;
function vGamePlay(id, i) {
  const g = GAMES[id], L = g.levels[i], ctl = g.controls ? g.controls(L) : [];
  return `<div class="view push">${navBar()}
    <div class="g-head"><small>${g.ic} ${esc(g.t)} · المستوى ${i + 1} من ${g.levels.length}</small><h1>${esc(L.name)}</h1><p>${g.mission(L)}</p></div>
    <div class="g-stage"><canvas id="gcv" width="800" height="500" aria-label="${esc(g.t)}"></canvas></div>
    ${ctl.length ? `<div class="controls">${ctl.map(gCtlHTML).join('')}</div>` : ''}
    <div class="g-bar" id="g-bar"><button class="btn primary" data-act="g-go">${g.go || 'انطلق'}</button><button class="btn" data-act="g-hint" aria-label="تلميح">💡</button><button class="btn" data-act="g-sfx" aria-label="الصوت">${SFX.on ? '🔊' : '🔇'}</button></div>
    <div id="g-res"></div></div>`;
}
function startGame(id, i) {
  const cv = document.getElementById('gcv'); if (!cv) return;
  const g = GAMES[id], L = g.levels[i], W = 800, H = 500, dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = W * dpr; cv.height = H * dpr;
  const c = cv.getContext('2d'); c.scale(dpr, dpr);
  const P = {}, st = { id, i, L, P, g, phase: 'aim', t: 0, parts: [], shake: 0, tries: 0, cv };
  (g.controls ? g.controls(L) : []).forEach(k => {
    const el = document.getElementById('gc-' + k.id), o = document.getElementById('gc-' + k.id + '-o');
    const sync = () => { P[k.id] = +el.value; o.textContent = `${(+el.value).toFixed(k.dec || 0)} ${k.unit}`.trim(); el.style.setProperty('--p', (el.value - k.min) / (k.max - k.min) * 100 + '%'); };
    el.oninput = sync; sync();
  });
  g.init(st, P, L);
  if (g.pointer) g.pointer(cv, st);
  let last = performance.now(), raf;
  const loop = now => {
    const dt = Math.min(.05, (now - last) / 1000); last = now; st.t += dt;
    if (st.phase === 'run') g.update(st, dt, P, L);
    stepParts(st, dt); if (st.shake > 0) st.shake = Math.max(0, st.shake - dt * 25);
    c.save(); if (st.shake) c.translate((Math.random() - .5) * st.shake, (Math.random() - .5) * st.shake);
    g.draw(c, st, P, L); drawParts(c, st); c.restore();
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  GPLAY = st;
  simStop = () => { cancelAnimationFrame(raf); GPLAY = null; };
}
function gLock(on) { document.querySelectorAll('.view input[type=range]').forEach(x => { x.disabled = on; }); const b = document.getElementById('g-bar'); if (b) b.style.display = on ? 'none' : ''; }
function gGo() {
  const st = GPLAY; if (!st || st.phase !== 'aim') return;
  if (st.g.ready && !st.g.ready(st)) return;
  SFX.init(); st.tries++; document.getElementById('g-res').innerHTML = '';
  gLock(true); st.phase = 'run'; st.g.launch(st, st.P, st.L);
}
// Back to aiming after a miss that keeps the level going (the cannon).
function gAgain(st, msg) { st.phase = 'aim'; gLock(false); if (msg) toast(msg); }
function gEnd(st, ok, stars, msg, why) {
  // Formulas show as their own lines, so drop the punctuation that joined them in a sentence.
  why = why.replace(/<\/code>[\s،.,]+/g, '</code>').replace(/<\/code>و\s*(?=<code>)/g, '</code>');
  st.phase = 'done'; const { id, i } = st, g = GAMES[id];
  SFX.play(ok ? 'win' : 'fail');
  if (ok) {
    const prev = gStars(id, i);
    if (stars > prev) { const all = gAll(); (all[id] = all[id] || {})[i] = stars; store.set('games', all); addXP((stars - prev) * 10); }
    burst(st, 400, 120, 70, { cols: ['#FFC83D', '#FF4D7A', '#4C86FF', '#32D17A', '#A866FF'], sp: 320, up: 260, life: 2.2, r: 5, g: 380, kind: 'conf' });
  }
  const next = ok && i + 1 < g.levels.length;
  document.getElementById('g-res').innerHTML = `<div class="g-res ${ok ? 'ok' : 'no'}">
    ${ok ? `<div class="g-stars">${'★'.repeat(stars)}<span>${'★'.repeat(3 - stars)}</span></div>` : ''}
    <h2>${msg}</h2><p>${why}</p>
    <div class="g-bar"><button class="btn primary" data-act="${next ? 'g-next' : 'g-retry'}">${next ? 'المستوى التالي' : 'حاول مرة أخرى'}</button>
    ${next ? '<button class="btn" data-act="g-retry">أعد المستوى</button>' : ''}<button class="btn" data-act="g-levels">المستويات</button></div></div>`;
  setTimeout(() => { const r = document.querySelector('.g-res'); if (r) r.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 200);
}
function gRetry() { const st = GPLAY; if (!st) return; st.phase = 'aim'; st.parts = []; st.g.init(st, st.P, st.L); document.getElementById('g-res').innerHTML = ''; gLock(false); }
function gameAct(act) {
  const st = GPLAY;
  if (act === 'g-go') gGo();
  else if (act === 'g-retry') gRetry();
  else if (act === 'g-hint' && st) sheet(`<h2>💡 تلميح</h2><p style="line-height:1.9">${st.g.hint(st.L)}</p><button class="btn primary wide" data-act="close" style="margin-top:16px;width:100%">فهمت</button>`, 'hint-sheet');
  else if (act === 'g-sfx') { SFX.on = !SFX.on; store.set('sfx', SFX.on); const b = document.querySelector('[data-act="g-sfx"]'); if (b) b.textContent = SFX.on ? '🔊' : '🔇'; }
  else if (act === 'g-next' && st) go(`glevel:${st.id}:${st.i + 1}`, true);
  else if (act === 'g-levels') transition('back', () => { S.stack.pop(); render(); });
}

/* ---------------- Particles and drawing helpers ---------------- */
function burst(st, x, y, n, o) {
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2, sp = (o.sp || 200) * (.3 + Math.random() * .7);
    st.parts.push({ x, y, vx: Math.cos(a) * sp * (o.spreadX || 1), vy: Math.sin(a) * sp * (o.spreadY || 1) - (o.up || 0) * Math.random(), age: 0, life: (o.life || 1) * (.6 + Math.random() * .6),
      r: (o.r || 4) * (.5 + Math.random()), col: o.cols[k % o.cols.length], g: o.g == null ? 400 : o.g, kind: o.kind || 'dot', rot: Math.random() * 6, vr: (Math.random() - .5) * 12 });
  }
}
function stepParts(st, dt) {
  st.parts = st.parts.filter(p => (p.age += dt) < p.life);
  st.parts.forEach(p => { p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; if (p.kind === 'smoke') { p.vx *= .96; p.vy *= .96; } if (p.floor && p.y > p.floor) { p.y = p.floor; p.vy *= -.3; p.vx *= .6; } });
}
function drawParts(c, st) {
  st.parts.forEach(p => {
    const k = 1 - p.age / p.life; c.globalAlpha = Math.max(0, p.kind === 'smoke' ? k * .5 : k);
    c.fillStyle = p.col;
    if (p.kind === 'smoke') { c.beginPath(); c.arc(p.x, p.y, p.r * (2.2 - k * 1.2), 0, 7); c.fill(); }
    else if (p.kind === 'brick' || p.kind === 'conf') { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillRect(-p.r, -p.r * (p.kind === 'conf' ? .5 : .7), p.r * 2, p.r * (p.kind === 'conf' ? 1 : 1.4)); c.restore(); }
    else { c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7); c.fill(); }
  });
  c.globalAlpha = 1;
}
const rr = (c, x, y, w, h, r) => { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); };
// Numbers with units stay one left-to-right run inside Arabic canvas text.
const iso = t => /[؀-ۿ]/.test(t) ? t.replace(/[A-Za-z0-9≤][A-Za-z0-9 .=\/²·°₀≤+−-]*[A-Za-z0-9²°]|[0-9]/g, m => '\u2066' + m + '\u2069') : t;
const gtx = (c, t, x, y, col = '#fff', al = 'center', size = 16, w = 700) => { c.direction = /[؀-ۿ]/.test(t) ? 'rtl' : 'ltr'; t = iso(t); c.fillStyle = col; c.font = `${w} ${size}px -apple-system, "SF Arabic", "SF Pro Text", Arial, sans-serif`; c.textAlign = al; c.fillText(t, x, y); };
const pill = (c, t, x, y, bg, col = '#fff', size = 15) => { c.font = `700 ${size}px -apple-system, "SF Arabic", Arial, sans-serif`; c.direction = /[؀-ۿ]/.test(t) ? 'rtl' : 'ltr'; const w = c.measureText(iso(t)).width + 22; c.fillStyle = bg; rr(c, x - w / 2, y - size - 4, w, size + 14, 12); c.fill(); gtx(c, t, x, y + 2, col, 'center', size); };
function skyGrad(c, cols, H = 500) { const g = c.createLinearGradient(0, 0, 0, H); cols.forEach((col, k) => g.addColorStop(k / (cols.length - 1), col)); c.fillStyle = g; c.fillRect(0, 0, 800, H); }
function cloud(c, x, y, s, a = .85) { c.fillStyle = `rgba(255,255,255,${a})`; [[0, 0, 22], [24, -10, 28], [52, 0, 22], [26, 6, 24]].forEach(([dx, dy, r]) => { c.beginPath(); c.arc(x + dx * s, y + dy * s, r * s, 0, 7); c.fill(); }); }
const seeded = n => { let h = n * 9301 + 49297; return () => ((h = (h * 9301 + 49297) % 233280) / 233280); };

/* =====================================================================
   Grade 10 · 🚗 أوقف السيارة على الخط   (v² = v₀² − 2aΔx)
   ===================================================================== */
const CAR = {
  g: 'g10', t: 'أوقف السيارة على الخط', ic: '🚗', topic: 'الحركة بتسارع منتظم', c: ['#FF7A45', '#7A1F3D'],
  sub: 'اختر التباطؤ المناسب لتتوقف السيارة تماماً على خط الموقف',
  levels: [
    { name: 'الموقف الأول', v0: 10, d: 25 }, { name: 'شارع سريع', v0: 20, d: 40 }, { name: 'دقة أعلى', v0: 15, d: 30 },
    { name: 'حوّل الوحدات', v0: 20, kmh: 72, d: 50 }, { name: 'فرملة قوية', v0: 30, d: 45 }, { name: 'الطريق السريع', v0: 25, kmh: 90, d: 62.5 },
  ],
  mission: L => `سيارة تسير بسرعة ${nb(L.kmh ? L.kmh : L.v0, L.kmh ? 'km/h' : 'm/s')} وتبدأ الفرملة عند العلامة الحمراء. خط الموقف على بعد ${nb(L.d, 'm')} من العلامة، وبعده حائط. اختر مقدار التباطؤ لتتوقف تماماً على الخط.`,
  hint: L => `عند التوقف <code>v = 0</code>، فمن <code>v² = v₀² − 2·a·Δx</code> نجد <code>a = v₀² / (2·Δx)</code>.${L.kmh ? '<br>حوّل السرعة أولاً إلى m/s بالقسمة على 3.6.' : ''}`,
  controls: () => [{ id: 'a', label: 'مقدار التباطؤ a', min: .5, max: 10, step: .05, v: 1, unit: 'm/s²', dec: 2 }],
  go: '🚗 انطلق',
  init(st, P, L) { st.x = -Math.max(18, L.v0 * 1.6); st.v = L.v0; st.tb = 0; st.braking = false; st.end = 0; st.crash = false; st.cam = L.d + 9 - 50; st.wheel = 0; },
  launch(st) { st.x = -Math.max(18, st.L.v0 * 1.6); st.v = st.L.v0; st.braking = false; st.tb = 0; },
  update(st, dt, P, L) {
    const wall = L.d + 5, stop = L.v0 ** 2 / (2 * P.a);
    if (!st.braking) { st.x += st.v * dt; if (st.x >= 0) { st.braking = true; st.tb = (st.x) / L.v0; st.x = 0; SFX.play('screech'); } }
    else {
      st.tb += dt; const s = Math.min(L.v0 * st.tb - .5 * P.a * st.tb ** 2, stop);
      st.v = Math.max(0, L.v0 - P.a * st.tb); st.x = s;
      if (st.v > 2 && Math.random() < .6) burst(st, this.sx(st, st.x - 3.6), 418, 1, { cols: ['#cfd3da'], sp: 20, up: 40, life: .9, r: 7, g: -20, kind: 'smoke' });
      if (st.x >= wall - .1 && !st.crash) {
        st.crash = true; st.x = wall - .1; st.v = 0; st.shake = 14; SFX.play('boom');
        burst(st, this.sx(st, wall), 395, 40, { cols: ['#FFC83D', '#FF7A45', '#fff'], sp: 260, up: 120, life: .8, r: 3 });
        burst(st, this.sx(st, wall), 395, 12, { cols: ['#9aa0aa'], sp: 60, up: 60, life: 1.6, r: 10, g: -30, kind: 'smoke' });
        return gEnd(st, false, 0, 'اصطدمت بالحائط! 💥', `مسافة التوقف <code>Δx = v₀² / (2a) = ${L.v0}² / (2 × ${P.a.toFixed(2)}) = ${stop.toFixed(1)} m</code> أكبر من المسافة المتاحة. زِد التباطؤ.`);
      }
      if (st.v === 0) {
        const err = st.x - L.d, why = `مسافة التوقف <code>Δx = v₀² / (2a) = ${L.v0}² / (2 × ${P.a.toFixed(2)}) = ${stop.toFixed(2)} m</code>${L.kmh ? `وتذكّر أن <code>${L.kmh} km/h = ${L.v0} m/s</code>` : ''}`;
        if (Math.abs(err) <= 1.5) return gEnd(st, true, Math.abs(err) <= .25 ? 3 : Math.abs(err) <= .75 ? 2 : 1, Math.abs(err) <= .25 ? 'توقف مثالي على الخط! 🅿️' : `توقفت على بعد ${Math.abs(err).toFixed(2)} m من الخط`, why);
        return gEnd(st, false, 0, `توقفت قبل الخط بـ ${(-err).toFixed(1)} m`, why + ' قلّل التباطؤ لتقطع مسافة أكبر.');
      }
    }
    st.wheel += st.v * dt / .35;
  },
  sx: (st, x) => 40 + (x - st.cam) * 16,
  draw(c, st, P, L) {
    if (st.phase === 'run') st.cam += ((Math.min(Math.max(st.x - 24, -60), L.d + 9 - 50)) - st.cam) * .12;
    const sx = x => this.sx(st, x), ground = 420;
    skyGrad(c, ['#1B1446', '#5B2A6E', '#E0645C', '#F7B267'], 360);
    c.fillStyle = 'rgba(255,220,150,.9)'; c.beginPath(); c.arc(600, 250, 46, 0, 7); c.fill();
    // city skyline (parallax)
    const rnd = seeded(3); c.fillStyle = '#2A1C3F';
    for (let k = 0; k < 40; k++) { const w = 30 + rnd() * 40, h = 60 + rnd() * 150, x = ((k * 70 - st.cam * 16 * .3) % 2800 + 2800) % 2800 - 200; c.fillRect(x, 360 - h, w, h); }
    c.fillStyle = '#3A2852'; for (let k = 0; k < 30; k++) { const w = 40 + rnd() * 50, h = 30 + rnd() * 80, x = ((k * 95 - st.cam * 16 * .55) % 2900 + 2900) % 2900 - 200; c.fillRect(x, 360 - h, w, h); }
    // road
    c.fillStyle = '#2E3038'; c.fillRect(0, 360, 800, 140); c.fillStyle = '#4A4D57'; c.fillRect(0, 360, 800, 8); c.fillRect(0, ground + 12, 800, 6);
    c.fillStyle = '#E8E3D6'; for (let m = Math.floor(st.cam / 4) * 4 - 4; m < st.cam + 60; m += 4) c.fillRect(sx(m), 388, 30, 4);
    for (let m = Math.ceil(st.cam / 5) * 5; m < st.cam + 52; m += 5) { if (m < 0 || m > L.d + 5) continue; gtx(c, `${m} m`, sx(m), 470, 'rgba(255,255,255,.4)', 'center', 12, 600); c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(sx(m) - 1, 440, 2, 12); }
    // skid marks
    if (st.braking) { c.fillStyle = 'rgba(10,10,12,.55)'; c.fillRect(sx(0) - 58, ground + 5, Math.max(0, sx(st.x) - sx(0)), 5); }
    // brake mark, line and wall
    c.fillStyle = '#FF3B3B'; c.fillRect(sx(0) - 3, 368, 6, 60); pill(c, 'ابدأ الفرملة', sx(0), 352, '#FF3B3B');
    c.fillStyle = '#FFD23F'; c.fillRect(sx(L.d) - 4, 368, 8, 64);
    c.fillStyle = '#1F6FEB'; rr(c, sx(L.d) - 16, 300, 32, 32, 6); c.fill(); gtx(c, 'P', sx(L.d), 324, '#fff', 'center', 22, 800); c.fillStyle = '#9AA0AA'; c.fillRect(sx(L.d) - 2, 332, 4, 36);
    const wx = sx(L.d + 5); c.fillStyle = '#7C808A'; c.fillRect(wx, 330, 26, 100);
    for (let k = 0; k < 5; k++) { c.fillStyle = k % 2 ? '#111' : '#FFC83D'; c.fillRect(wx, 330 + k * 20, 26, 10); }
    // car (front bumper at st.x)
    const fx = sx(st.x), by = ground - 6;
    c.save(); c.translate(fx, by);
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(-36, 12, 40, 5, 0, 0, 7); c.fill();
    const body = c.createLinearGradient(0, -40, 0, 0); body.addColorStop(0, '#5AA2FF'); body.addColorStop(1, '#1F5FD1');
    c.fillStyle = body; rr(c, -72, -24, 72, 22, 8); c.fill();
    c.beginPath(); c.moveTo(-58, -24); c.lineTo(-46, -40); c.lineTo(-20, -40); c.lineTo(-10, -24); c.closePath(); c.fill();
    c.fillStyle = '#BFE3FF'; c.beginPath(); c.moveTo(-54, -25); c.lineTo(-45, -37); c.lineTo(-34, -37); c.lineTo(-34, -25); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-31, -25); c.lineTo(-31, -37); c.lineTo(-21, -37); c.lineTo(-14, -25); c.closePath(); c.fill();
    c.fillStyle = '#FFF4C2'; c.fillRect(-4, -20, 4, 6);
    c.fillStyle = st.braking && st.v > 0 ? '#FF2D2D' : '#8A1C1C'; if (st.braking && st.v > 0) { c.shadowColor = '#FF2D2D'; c.shadowBlur = 18; } c.fillRect(-72, -20, 4, 7); c.shadowBlur = 0;
    [-56, -16].forEach(wx2 => { c.fillStyle = '#15161A'; c.beginPath(); c.arc(wx2, -2, 9, 0, 7); c.fill(); c.strokeStyle = '#B9BEC8'; c.lineWidth = 2; c.beginPath(); for (let k = 0; k < 3; k++) { const a = st.wheel + k * 2.1; c.moveTo(wx2, -2); c.lineTo(wx2 + Math.cos(a) * 6, -2 + Math.sin(a) * 6); } c.stroke(); });
    c.restore();
    // HUD
    pill(c, `v = ${st.v.toFixed(1)} m/s`, 90, 34, 'rgba(0,0,0,.45)');
    if (st.phase !== 'aim') pill(c, `المسافة إلى الخط: ${Math.max(0, L.d - Math.max(0, st.x)).toFixed(1)} m`, 640, 34, 'rgba(0,0,0,.45)');
    else pill(c, `a = ${P.a.toFixed(2)} m/s²`, 680, 34, 'rgba(0,0,0,.45)', '#FFD23F');
  },
};

/* =====================================================================
   Grade 10 · 🥚 أنقذ البيضة   (h = ½gt²  و  x = vt)
   ===================================================================== */
const EGG = {
  g: 'g10', t: 'أنقذ البيضة', ic: '🥚', topic: 'السقوط الحر', c: ['#FFC83D', '#2F7A3A'],
  sub: 'أفلت البيضة في اللحظة المناسبة لتسقط داخل عربة القش المتحركة',
  levels: [
    { name: 'الطابق الخامس', h: 20, v: 3 }, { name: 'برج عالٍ', h: 45, v: 4 }, { name: 'عربة مسرعة', h: 5, v: 7.5 },
    { name: 'ناطحة سحاب', h: 80, v: 2.5 }, { name: 'تحدي الدقة', h: 31.25, v: 6 },
  ],
  mission: L => `البيضة على شرفة ارتفاعها ${nb(L.h, 'm')}، وعربة القش تقترب بسرعة ثابتة ${nb(L.v, 'm/s')}. ستُفلت البيضة لحظة وصول العربة إلى المسافة x التي تختارها من نقطة السقوط. ${nb('g = 10', 'm/s²')}`,
  hint: () => 'زمن سقوط البيضة من السكون <code>t = √(2h / g)</code>، وخلال هذا الزمن تقطع العربة <code>x = v·t</code>.',
  controls: () => [{ id: 'x', label: 'مسافة العربة لحظة الإفلات x', min: 0, max: 20, step: .1, v: 5, unit: 'm', dec: 1 }],
  go: '🥚 أفلت البيضة',
  init(st, P, L) { st.cx = -Math.max(P.x || 5, 5) - L.v * 1.5; st.ey = L.h; st.ev = 0; st.dropped = false; st.landed = false; st.splat = false; st.tDrop = 0; st.bounce = 0; st.cam = 0; },
  launch(st, P, L) { st.cx = -P.x - L.v * 1.5; st.ey = L.h; st.ev = 0; st.dropped = false; st.landed = false; st.splat = false; st.tDrop = 0; },
  sxF: (x) => 640 + x * 24,
  sy(st, L, y) { return 420 - y * (330 / L.h); },
  update(st, dt, P, L) {
    st.cx += L.v * dt;
    // Release and landing use exact times, so the frame rate never changes the result.
    if (!st.dropped && st.cx >= -P.x) { st.dropped = true; st.tDrop = (st.cx + P.x) / L.v; SFX.play('pop'); }
    else if (st.dropped && !st.landed) st.tDrop += dt;
    if (st.dropped && !st.landed) {
      const T = Math.sqrt(2 * L.h / 10); st.ey = Math.max(0, L.h - 5 * st.tDrop ** 2);
      if (st.tDrop >= T) {
        st.landed = true; st.ey = 0; const off = st.cx - L.v * (st.tDrop - T), t = T;
        const why = `زمن السقوط <code>t = √(2 × ${L.h} / 10) = ${t.toFixed(2)} s</code>، والعربة تقطع خلاله <code>x = ${L.v} × ${t.toFixed(2)} = ${(L.v * t).toFixed(2)} m</code>.`;
        if (Math.abs(off) <= .8) {
          SFX.play('thud'); st.bounce = 1;
          burst(st, this.sxF(0), this.sy(st, L, 1.2), 18, { cols: ['#F2D27A', '#E8B84A'], sp: 120, up: 120, life: .9, r: 4 });
          return gEnd(st, true, Math.abs(off) <= .2 ? 3 : Math.abs(off) <= .45 ? 2 : 1, Math.abs(off) <= .2 ? 'هبوط مثالي في القش! 🥚✨' : 'أنقذت البيضة! 🥚', why);
        }
        st.splat = true; st.ey = 0; SFX.play('crack'); st.shake = 6;
        burst(st, this.sxF(0), this.sy(st, L, 0) - 2, 30, { cols: ['#FFD23F', '#FFF6E0', '#FFB300'], sp: 180, up: 80, life: 1.2, r: 4 });
        return gEnd(st, false, 0, 'انكسرت البيضة! 🍳', why + ` لكنك اخترت <code>x = ${P.x.toFixed(1)} m</code>، فكانت العربة ${off > 0 ? 'قد تجاوزت' : 'لم تصل بعد إلى'} نقطة السقوط.`);
      }
    }
  },
  draw(c, st, P, L) {
    const X = x => this.sxF(x), Y = y => this.sy(st, L, y);
    skyGrad(c, ['#5EB8FF', '#A8DCFF', '#E6F6FF'], 430);
    [[80, 70, 1.1, 8], [330, 120, .8, 14], [520, 50, .9, 6]].forEach(([x, y, s, sp]) => cloud(c, ((x + st.t * sp) % 900) - 60, y, s));
    c.fillStyle = '#8FCB6B'; c.beginPath(); c.moveTo(0, 360); c.quadraticCurveTo(200, 300, 420, 350); c.lineTo(420, 430); c.lineTo(0, 430); c.fill();
    // building
    const bx = 662, top = Y(L.h);
    const bg = c.createLinearGradient(bx, 0, 800, 0); bg.addColorStop(0, '#C9785A'); bg.addColorStop(1, '#9E5440'); c.fillStyle = bg; c.fillRect(bx, top - 30, 140, 430 - top + 30);
    c.fillStyle = 'rgba(30,40,60,.75)'; for (let y = top; y < 400; y += 34) for (let x = bx + 18; x < 790; x += 34) c.fillRect(x, y, 18, 20);
    c.fillStyle = '#6B3A2C'; c.fillRect(bx - 40, top + 2, 60, 8); c.strokeStyle = '#6B3A2C'; c.lineWidth = 3; c.beginPath(); for (let x = bx - 40; x <= bx + 20; x += 10) { c.moveTo(x, top + 2); c.lineTo(x, top - 18); } c.moveTo(bx - 40, top - 18); c.lineTo(bx + 20, top - 18); c.stroke();
    gtx(c, `${L.h} m`, bx + 70, top - 40, '#fff', 'center', 15);
    // ground and road
    c.fillStyle = '#6B6E75'; c.fillRect(0, 430, 800, 70); c.fillStyle = '#58C26A'; c.fillRect(0, 420, 800, 12);
    for (let m = 0; m <= 20; m += 2) { const x = X(-m); if (x < 0) break; c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x - 1, 440, 2, m % 10 ? 8 : 14); if (m % 4 === 0) gtx(c, `${m}`, x, 468, 'rgba(255,255,255,.6)', 'center', 12, 600); }
    gtx(c, 'm', 20, 468, 'rgba(255,255,255,.6)', 'center', 12, 600);
    if (st.phase === 'aim') { c.strokeStyle = '#FFD23F'; c.setLineDash([6, 6]); c.lineWidth = 2; c.beginPath(); c.moveTo(X(-P.x), 300); c.lineTo(X(-P.x), 430); c.stroke(); c.setLineDash([]); pill(c, `x = ${P.x.toFixed(1)} m`, X(-P.x), 290, '#FFD23F', '#2A1A00'); }
    // drop line
    c.strokeStyle = 'rgba(255,255,255,.25)'; c.setLineDash([4, 8]); c.beginPath(); c.moveTo(X(0), top + 10); c.lineTo(X(0), 420); c.stroke(); c.setLineDash([]);
    // cart
    const cx = X(st.cx); c.save(); c.translate(cx, 420);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(0, 4, 34, 5, 0, 0, 7); c.fill();
    c.fillStyle = '#A0602F'; rr(c, -30, -26, 60, 20, 4); c.fill(); c.fillStyle = '#7A4520'; c.fillRect(-30, -12, 60, 4);
    c.fillStyle = '#F1C75B'; c.beginPath(); c.ellipse(0, -28, 27, 12 + st.bounce * 3, 0, Math.PI, 0); c.fill(); c.strokeStyle = '#D9A93A'; c.lineWidth = 1.5; for (let k = -20; k <= 20; k += 6) { c.beginPath(); c.moveTo(k, -28); c.lineTo(k + 3, -36); c.stroke(); }
    const rot = st.cx / .3; [-18, 18].forEach(w => { c.fillStyle = '#3B2A1E'; c.beginPath(); c.arc(w, -4, 7, 0, 7); c.fill(); c.strokeStyle = '#C08A55'; c.lineWidth = 2; c.beginPath(); c.moveTo(w, -4); c.lineTo(w + Math.cos(rot) * 6, -4 + Math.sin(rot) * 6); c.stroke(); });
    c.restore();
    st.bounce *= .9;
    // egg
    if (!st.splat) {
      const ex = st.landed ? cx : X(0), ey = st.landed ? 420 - 38 : Y(st.ey) - 16;
      // A bigger egg with a dark outline and a motion trail, so it reads clearly against the sky.
      if (st.dropped && !st.landed) for (let k = 1; k <= 4; k++) { const t2 = Math.max(0, st.tDrop - k * .06), y2 = Y(Math.max(0, L.h - 5 * t2 * t2)) - 16; c.fillStyle = `rgba(255,236,190,${.35 - k * .07})`; c.beginPath(); c.ellipse(ex, y2, 12, 16, 0, 0, 7); c.fill(); }
      c.save(); c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 10; c.shadowOffsetY = 3;
      const eg = c.createRadialGradient(ex - 4, ey - 6, 2, ex, ey, 18); eg.addColorStop(0, '#FFFFFF'); eg.addColorStop(1, '#F1DDB4');
      c.fillStyle = eg; c.beginPath(); c.ellipse(ex, ey, 12, 16, 0, 0, 7); c.fill(); c.restore();
      c.strokeStyle = '#A9824B'; c.lineWidth = 2.5; c.beginPath(); c.ellipse(ex, ey, 12, 16, 0, 0, 7); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.ellipse(ex - 4, ey - 6, 3, 4.5, -.3, 0, 7); c.fill();
      if (st.dropped && !st.landed) pill(c, 'g ↓', ex - 40, ey + 6, 'rgba(0,0,0,.45)', '#FFD23F', 13);
    }
    else { c.fillStyle = '#FFF6E0'; c.beginPath(); c.ellipse(X(0), 421, 22, 5, 0, 0, 7); c.fill(); c.fillStyle = '#FFC21A'; c.beginPath(); c.arc(X(0), 419, 6, 0, 7); c.fill(); }
    pill(c, `h = ${L.h} m`, 70, 34, 'rgba(0,0,0,.4)'); pill(c, `v = ${L.v} m/s`, 190, 34, 'rgba(0,0,0,.4)');
    if (st.dropped && !st.landed) pill(c, `t = ${st.tDrop.toFixed(2)} s`, 320, 34, 'rgba(0,0,0,.4)', '#FFD23F');
  },
};

/* =====================================================================
   Grade 11 · 🏰 مدفع القلعة   (حركة المقذوفات)
   ===================================================================== */
const CANNON = {
  g: 'g11', t: 'مدفع القلعة', ic: '🏰', topic: 'حركة المقذوفات', c: ['#4C86FF', '#2A1C5A'],
  sub: 'اختر زاوية الإطلاق والسرعة لتدمير البرج بأقل عدد من القذائف',
  levels: [
    { name: 'الهدف الأول', R: 40 }, { name: 'أبعد قليلاً', R: 60 }, { name: 'خلف السور', R: 45, wall: { x: 20, h: 10 } },
    { name: 'برج على هضبة', R: 50, plat: 12 }, { name: 'زاويتان، هدف واحد', R: 50, twice: true }, { name: 'من فوق الجرف', R: 40, cliff: 20 },
  ],
  mission: L => `أصب البرج الذي يبعد ${nb(L.R, 'm')} عن المدفع.` + (L.wall ? ` يوجد سور ارتفاعه ${nb(L.wall.h, 'm')} على بعد ${nb(L.wall.x, 'm')}.` : '') + (L.plat ? ` البرج فوق هضبة ارتفاعها ${nb(L.plat, 'm')}.` : '') + (L.cliff ? ` المدفع فوق جرف ارتفاعه ${nb(L.cliff, 'm')} والبرج على الأرض.` : '') + (L.twice ? ' أصبه مرتين بزاويتين مختلفتين!' : '') + ` ${nb('g = 10', 'm/s²')}`,
  hint: L => L.plat || L.cliff ? 'استخدم معادلة المسار <code>y = x·tanθ − g·x² / (2·v₀²·cos²θ)</code> لتعرف الارتفاع عند موضع البرج.' : `المدى على أرض مستوية <code>R = v₀²·sin2θ / g</code>. عند <code>θ = 45°</code> تحتاج <code>v₀ = √(R·g)</code>.${L.twice ? '<br>الزاويتان اللتان مجموعهما 90° تعطيان المدى نفسه.' : ''}`,
  controls: () => [{ id: 'th', label: 'زاوية الإطلاق θ', min: 5, max: 85, step: 1, v: 30, unit: '°' }, { id: 'v', label: 'سرعة الإطلاق v₀', min: 5, max: 35, step: .5, v: 15, unit: 'm/s', dec: 1 }],
  go: '💥 أطلق',
  init(st) { st.ball = null; st.trails = []; st.hits = []; st.towerDown = 0; st.shots = 0; st.flag = 0; },
  X: x => 60 + x * 10, Y: y => 440 - y * 10,
  launch(st, P, L) { st.shots++; st.ball = { t: 0, trail: [], th: P.th, v: P.v }; st.towerDown = 0; SFX.play('shoot'); st.shake = 4;
    burst(st, this.X(1.6 * Math.cos(P.th * Math.PI / 180)), this.Y((L.cliff || 0) + 1.2 + 1.6 * Math.sin(P.th * Math.PI / 180)), 14, { cols: ['#d0d4dc', '#9aa0aa'], sp: 50, up: 20, life: 1.2, r: 8, g: -20, kind: 'smoke' }); },
  update(st, dt, P, L) {
    const b = st.ball; if (!b) return;
    b.t += dt * 1.15; const a = b.th * Math.PI / 180, x = b.v * Math.cos(a) * b.t, y = (L.cliff || 0) + 1.2 + b.v * Math.sin(a) * b.t - 5 * b.t * b.t;
    b.x = x; b.y = y; b.trail.push([x, y]);
    const tx0 = L.R - 1.5, tx1 = L.R + 1.5, base = L.plat || 0;
    const miss = (msg, col = '#B8A27A') => { burst(st, this.X(x), this.Y(Math.max(y, 0)), 16, { cols: [col, '#8c7a5a'], sp: 90, up: 80, life: .8, r: 4 }); SFX.play('thud'); st.trails.push(b.trail); st.ball = null; const dist = x.toFixed(1); gAgain(st, msg.replace('#', dist)); };
    if (x >= tx0 && x <= tx1 && y >= base && y <= base + 6) {
      SFX.play('boom'); st.shake = 16; st.ball = null; st.towerDown = 1; st.trails.push(b.trail);
      burst(st, this.X(L.R), this.Y(base + 3), 34, { cols: ['#8E8A84', '#B7B1A7', '#6E6A64'], sp: 300, up: 220, life: 1.6, r: 7, kind: 'brick' });
      burst(st, this.X(L.R), this.Y(base + 3), 28, { cols: ['#FFC83D', '#FF7A45', '#fff'], sp: 260, up: 100, life: .7, r: 4 });
      st.hits.push(b.th);
      const R = b.v ** 2 * Math.sin(2 * a) / 10;
      const why = L.plat || L.cliff ? `ارتفاع القذيفة عند موضع البرج (${L.R} m): <code>y = ${L.cliff ? L.cliff + ' + ' : ''}x·tan${b.th}° − 10·x² / (2·${b.v}²·cos²${b.th}°) ≈ ${(y).toFixed(1)} m</code>وهذا الارتفاع داخل البرج.` : `المدى <code>R = v₀²·sin2θ / g = ${b.v}² × sin${2 * b.th}° / 10 ≈ ${R.toFixed(1)} m</code>.`;
      if (L.twice && st.hits.length < 2) { setTimeout(() => { if (GPLAY === st) { st.towerDown = 0; gAgain(st, 'أصبته! الآن أصبه مرة ثانية بزاوية مختلفة 🎯'); } }, 1300); return; }
      if (L.twice && Math.abs(st.hits[0] - st.hits[1]) < 5) { st.hits.pop(); setTimeout(() => { if (GPLAY === st) { st.towerDown = 0; gAgain(st, 'استخدم زاوية مختلفة عن المرة الأولى!'); } }, 1300); return; }
      const need = L.twice ? 2 : 1, s = st.shots <= need ? 3 : st.shots <= need + 2 ? 2 : 1;
      return setTimeout(() => { if (GPLAY === st) gEnd(st, true, s, `دمّرت البرج بـ ${st.shots} ${st.shots === 1 ? 'قذيفة' : 'قذائف'}! 🏰💥`, why + (L.twice ? `<br>أصبته بالزاويتين ${st.hits[0]}° و ${st.hits[1]}°، ومجموعهما ${st.hits[0] + st.hits[1]}°.` : '')); }, 900);
    }
    if (L.wall && Math.abs(x - L.wall.x) <= .75 && y <= L.wall.h) return miss('اصطدمت القذيفة بالسور! 🧱', '#9C9387');
    if (L.plat && x >= L.R - 5 && x <= L.R + 5 && y <= L.plat) return miss('اصطدمت بالهضبة تحت البرج');
    if (y <= 0) return miss(x < tx0 ? 'سقطت القذيفة عند # m — قصيرة' : 'سقطت القذيفة عند # m — أبعد من البرج');
    if (x > 76) return miss('خرجت القذيفة من الميدان');
  },
  draw(c, st, P, L) {
    const X = this.X, Y = this.Y, base = L.plat || 0, cl = L.cliff || 0;
    skyGrad(c, ['#2E6FD8', '#78B4F0', '#D7ECFF'], 440);
    [[90, 80, 1, 6], [400, 50, .8, 10], [650, 110, 1.1, 4]].forEach(([x, y, s, sp]) => cloud(c, ((x + st.t * sp) % 900) - 60, y, s, .9));
    c.fillStyle = '#7C93C9'; c.beginPath(); c.moveTo(0, 360); [[120, 250], [230, 330], [360, 230], [520, 320], [640, 240], [800, 330], [800, 440], [0, 440]].forEach(([x, y]) => c.lineTo(x, y)); c.fill();
    c.fillStyle = '#5F9E4A'; c.fillRect(0, 440, 800, 60); c.fillStyle = '#4C8A3B'; c.fillRect(0, 440, 800, 6);
    for (let m = 10; m <= 70; m += 10) { c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(X(m) - 1, 446, 2, 10); gtx(c, `${m} m`, X(m), 476, 'rgba(255,255,255,.75)', 'center', 12, 600); }
    if (cl) { c.fillStyle = '#8B6A47'; c.beginPath(); c.moveTo(0, Y(cl)); c.lineTo(X(4), Y(cl)); c.lineTo(X(6), 440); c.lineTo(0, 440); c.fill(); c.fillStyle = '#5F9E4A'; c.fillRect(0, Y(cl) - 4, X(4), 6); }
    if (L.plat) { c.fillStyle = '#8B6A47'; rr(c, X(L.R - 5), Y(L.plat), 100, Y(0) - Y(L.plat), 10); c.fill(); c.fillStyle = '#5F9E4A'; c.fillRect(X(L.R - 5), Y(L.plat) - 4, 100, 6); }
    if (L.wall) { const wx = X(L.wall.x); c.fillStyle = '#9C9387'; c.fillRect(wx - 8, Y(L.wall.h), 16, L.wall.h * 10); c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1; for (let y = Y(L.wall.h); y < 440; y += 10) { c.beginPath(); c.moveTo(wx - 8, y); c.lineTo(wx + 8, y); c.stroke(); } }
    // tower
    if (!st.towerDown) {
      const tx = X(L.R), ty = Y(base);
      c.fillStyle = '#A39C92'; c.fillRect(tx - 15, ty - 60, 30, 60);
      c.strokeStyle = 'rgba(0,0,0,.22)'; for (let y = ty - 60; y < ty; y += 10) { c.beginPath(); c.moveTo(tx - 15, y); c.lineTo(tx + 15, y); c.stroke(); }
      c.fillStyle = '#A39C92'; for (let k = -15; k < 15; k += 10) c.fillRect(tx + k, ty - 68, 6, 8);
      c.fillStyle = '#2B1E14'; rr(c, tx - 5, ty - 20, 10, 20, 5); c.fill();
      c.strokeStyle = '#5a4a3a'; c.lineWidth = 2; c.beginPath(); c.moveTo(tx, ty - 68); c.lineTo(tx, ty - 92); c.stroke();
      const fw = Math.sin(st.t * 6) * 3; c.fillStyle = '#E8324A'; c.beginPath(); c.moveTo(tx, ty - 92); c.quadraticCurveTo(tx + 10, ty - 88 + fw, tx + 20, ty - 86); c.lineTo(tx, ty - 80); c.fill();
    } else { c.fillStyle = '#6E6A64'; c.beginPath(); c.ellipse(X(L.R), Y(base) - 3, 22, 6, 0, 0, 7); c.fill(); }
    // previous shots
    st.trails.slice(-4).forEach(tr => { c.strokeStyle = 'rgba(255,255,255,.28)'; c.setLineDash([3, 6]); c.lineWidth = 2; c.beginPath(); tr.forEach(([x, y], k) => k ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y))); c.stroke(); c.setLineDash([]); });
    // cannon
    const a = (st.ball ? st.ball.th : P.th) * Math.PI / 180, cx = X(0), cy = Y(cl + 1.2);
    c.save(); c.translate(cx, cy); c.rotate(-a);
    const bg = c.createLinearGradient(0, -8, 0, 8); bg.addColorStop(0, '#5A5F6B'); bg.addColorStop(1, '#23262E'); c.fillStyle = bg; rr(c, -6, -8, 40, 16, 6); c.fill(); c.fillStyle = '#16181D'; c.fillRect(30, -9, 6, 18);
    if (st.phase === 'aim') { c.strokeStyle = 'rgba(255,210,63,.7)'; c.setLineDash([5, 6]); c.lineWidth = 2; c.beginPath(); c.moveTo(40, 0); c.lineTo(90, 0); c.stroke(); c.setLineDash([]); }
    c.restore();
    c.fillStyle = '#6B4423'; c.beginPath(); c.arc(cx - 2, cy + 6, 10, 0, 7); c.fill(); c.strokeStyle = '#3D2612'; c.lineWidth = 2; c.stroke();
    // ball and trail
    if (st.ball && st.ball.trail.length) {
      const tr = st.ball.trail; c.strokeStyle = 'rgba(255,200,61,.55)'; c.lineWidth = 3; c.beginPath(); tr.forEach(([x, y], k) => k ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y))); c.stroke();
      c.fillStyle = '#1B1D22'; c.shadowColor = 'rgba(255,170,60,.8)'; c.shadowBlur = 12; c.beginPath(); c.arc(X(st.ball.x), Y(st.ball.y), 6, 0, 7); c.fill(); c.shadowBlur = 0;
    }
    pill(c, `θ = ${P.th}°`, 70, 34, 'rgba(0,0,0,.4)'); pill(c, `v₀ = ${P.v.toFixed(1)} m/s`, 190, 34, 'rgba(0,0,0,.4)'); pill(c, `القذائف: ${st.shots}`, 720, 34, 'rgba(0,0,0,.4)', '#FFD23F');
  },
};

/* =====================================================================
   Grade 11 · ⛵ قبطان الزورق   (جمع المتجهات: سرعة الزورق + سرعة التيار)
   ===================================================================== */
const BOAT = {
  g: 'g11', t: 'قبطان الزورق', ic: '⛵', topic: 'المتجهات ومحصلتها', c: ['#1FB5C9', '#0B3A66'],
  sub: 'وجّه الزورق في النهر ليصل إلى المرسى رغم التيار',
  levels: [
    { name: 'العبور المستقيم', u: 3, v: 5, W: 60, D: 0 }, { name: 'دع التيار يحملك', u: 4, v: 4, W: 60, D: 60 }, { name: 'تيار هادئ', u: 2, v: 4, W: 60, D: 0 },
    { name: 'عكس التيار', u: 3, v: 6, W: 60, D: -20 }, { name: 'مرسى بعيد', u: 5, v: 4, W: 60, D: 80 },
  ],
  mission: L => `عرض النهر ${nb(L.W, 'm')}، وسرعة التيار ${nb(L.u, 'm/s')} نحو اليمين، وسرعة الزورق بالنسبة للماء ${nb(L.v, 'm/s')}. ` + (L.D === 0 ? 'المرسى مقابلك تماماً على الضفة الأخرى.' : L.D > 0 ? `المرسى على الضفة الأخرى بعد ${nb(L.D, 'm')} مع اتجاه التيار.` : `المرسى على الضفة الأخرى بعد ${nb(-L.D, 'm')} عكس اتجاه التيار.`) + ' اختر زاوية توجيه الزورق.',
  hint: L => 'السرعة المحصلة = سرعة الزورق + سرعة التيار (جمع متجهات). إذا وجّهت الزورق بزاوية φ عكس التيار: <code>vx = u − v·sinφ</code> و <code>vy = v·cosφ</code>.<br>زمن العبور <code>t = W / vy</code>، والانحراف <code>Δx = vx·t</code>.' + (L.D === 0 ? '<br>للوصول إلى المقابل تماماً يجب أن تكون <code>vx = 0</code> أي <code>sinφ = u / v</code>.' : ''),
  controls: () => [{ id: 'phi', label: 'زاوية التوجيه φ (موجبة = عكس التيار)', min: -60, max: 60, step: 1, v: 0, unit: '°' }],
  go: '⛵ أبحر',
  init(st, P, L) { st.bx = 0; st.by = 0; st.wake = []; st.k = 300 / L.W; st.ox = Math.max(140, Math.min(660, 400 - (L.D * st.k) / 2)); },
  launch(st) { st.bx = 0; st.by = 0; },
  update(st, dt, P, L) {
    const f = P.phi * Math.PI / 180, vx = L.u - L.v * Math.sin(f), vy = L.v * Math.cos(f), sp = 3.5;
    st.bx += vx * dt * sp; st.by += vy * dt * sp;
    if (Math.random() < .7) st.wake.push({ x: st.bx, y: st.by, a: 1 });
    if (st.by >= L.W) {
      st.by = L.W; const t = L.W / vy, land = vx * t, err = Math.abs(land - L.D);
      const why = `<code>vx = ${L.u} − ${L.v}·sin${P.phi}° = ${vx.toFixed(2)} m/s</code> و <code>vy = ${L.v}·cos${P.phi}° = ${vy.toFixed(2)} m/s</code>. زمن العبور <code>t = ${L.W} / ${vy.toFixed(2)} = ${t.toFixed(1)} s</code>، فالانحراف <code>Δx = ${vx.toFixed(2)} × ${t.toFixed(1)} = ${land.toFixed(1)} m</code>.`;
      SFX.play(err <= 4 ? 'thud' : 'splash');
      if (err <= 4) return gEnd(st, true, err <= 1 ? 3 : err <= 2.5 ? 2 : 1, err <= 1 ? 'رسوت على المرسى تماماً! ⚓' : `رسوت على بعد ${err.toFixed(1)} m من المرسى`, why);
      return gEnd(st, false, 0, `وصلت على بعد ${err.toFixed(1)} m من المرسى`, why + (land > L.D ? ' التيار حملك أبعد من المرسى: وجّه الزورق أكثر عكس التيار.' : ' انحرفت عكس التيار أكثر من اللازم.'));
    }
  },
  draw(c, st, P, L) {
    const k = st.k, SX = x => st.ox + x * k, SY = y => 420 - y * k, f = P.phi * Math.PI / 180;
    c.fillStyle = '#D9C08A'; c.fillRect(0, 0, 800, 500);
    const wg = c.createLinearGradient(0, 120, 0, 420); wg.addColorStop(0, '#1E7FB8'); wg.addColorStop(.5, '#1667A0'); wg.addColorStop(1, '#1E7FB8'); c.fillStyle = wg; c.fillRect(0, 120, 800, 300);
    c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 2; const rnd = seeded(7);
    for (let n = 0; n < 34; n++) { const y = 130 + rnd() * 280, len = 20 + rnd() * 40, x = ((rnd() * 900 + st.t * L.u * k * 3.5) % 900) - 50; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + len / 2, y - 3, x + len, y); c.stroke(); }
    c.fillStyle = '#4C9A3F'; c.fillRect(0, 0, 800, 96); c.fillRect(0, 444, 800, 56); c.fillStyle = '#D9C08A'; c.fillRect(0, 96, 800, 24); c.fillRect(0, 420, 800, 24);
    const tr = seeded(11); for (let n = 0; n < 14; n++) { const x = tr() * 800, y = 20 + tr() * 60; c.fillStyle = '#2F6E2A'; c.beginPath(); c.arc(x, y, 14 + tr() * 8, 0, 7); c.fill(); c.fillStyle = '#3E8A35'; c.beginPath(); c.arc(x - 4, y - 4, 9, 0, 7); c.fill(); }
    // dock
    const dx = SX(L.D); c.fillStyle = '#7A5230'; c.fillRect(dx - 22, 84, 44, 46); c.strokeStyle = '#5A3A1E'; c.lineWidth = 2; for (let y = 88; y < 130; y += 8) { c.beginPath(); c.moveTo(dx - 22, y); c.lineTo(dx + 22, y); c.stroke(); }
    c.fillStyle = '#5A3A1E'; c.fillRect(dx - 24, 126, 6, 10); c.fillRect(dx + 18, 126, 6, 10);
    c.strokeStyle = '#333'; c.beginPath(); c.moveTo(dx, 84); c.lineTo(dx, 52); c.stroke(); c.fillStyle = '#FFD23F'; c.beginPath(); c.moveTo(dx, 52); c.lineTo(dx + 18, 58 + Math.sin(st.t * 5) * 2); c.lineTo(dx, 64); c.fill();
    pill(c, '⚓ المرسى', dx, 44, 'rgba(0,0,0,.45)');
    c.fillStyle = '#7A5230'; c.fillRect(SX(0) - 20, 420, 40, 26);
    // current arrow legend
    c.strokeStyle = '#32D17A'; c.fillStyle = '#32D17A'; c.lineWidth = 3; c.beginPath(); c.moveTo(640, 150); c.lineTo(700, 150); c.stroke(); c.beginPath(); c.moveTo(712, 150); c.lineTo(700, 143); c.lineTo(700, 157); c.fill();
    gtx(c, `التيار ${L.u} m/s`, 676, 140, '#fff', 'center', 13);
    // wake
    st.wake.forEach(w => { w.a -= .01; }); st.wake = st.wake.filter(w => w.a > 0);
    st.wake.forEach(w => { c.fillStyle = `rgba(255,255,255,${w.a * .35})`; c.beginPath(); c.arc(SX(w.x), SY(w.y), 3 + (1 - w.a) * 8, 0, 7); c.fill(); });
    // boat: points along its heading relative to the water
    const x0 = SX(st.bx), y0 = SY(st.by);
    c.save(); c.translate(x0, y0); c.rotate(-f);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(3, 4, 11, 24, 0, 0, 7); c.fill();
    c.fillStyle = '#F5F5F7'; c.beginPath(); c.moveTo(0, -26); c.quadraticCurveTo(12, -10, 10, 18); c.lineTo(-10, 18); c.quadraticCurveTo(-12, -10, 0, -26); c.fill();
    c.fillStyle = '#E8324A'; c.fillRect(-10, 10, 20, 8); c.fillStyle = '#8FD3FF'; rr(c, -6, -8, 12, 10, 3); c.fill();
    c.restore();
    // velocity vectors
    const arrow = (x1, y1, x2, y2, col, lab) => { const a = Math.atan2(y2 - y1, x2 - x1); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 4; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2 - 8 * Math.cos(a), y2 - 8 * Math.sin(a)); c.stroke(); c.beginPath(); c.moveTo(x2, y2); c.lineTo(x2 - 13 * Math.cos(a - .45), y2 - 13 * Math.sin(a - .45)); c.lineTo(x2 - 13 * Math.cos(a + .45), y2 - 13 * Math.sin(a + .45)); c.fill(); if (lab) gtx(c, lab, x2 + 10 * Math.cos(a), y2 + 10 * Math.sin(a) - 6, col, 'center', 14); };
    const s = 14, bvx = -L.v * Math.sin(f), bvy = L.v * Math.cos(f);
    arrow(x0, y0, x0 + bvx * s, y0 - bvy * s, '#6FB0FF', 'v');
    arrow(x0, y0, x0 + L.u * s, y0, '#32D17A', 'u');
    if (st.phase !== 'aim') arrow(x0, y0, x0 + (bvx + L.u) * s, y0 - bvy * s, '#FFA53A', 'R');
    pill(c, `φ = ${P.phi}°`, 70, 470, 'rgba(0,0,0,.45)');
  },
};

/* =====================================================================
   Grade 12 · ⚖️ ميزان القرصان   (اتزان العزوم)
   ===================================================================== */
const PIRATE = {
  g: 'g12', t: 'ميزان القرصان', ic: '🏴‍☠️', topic: 'العزم والاتزان', c: ['#C9952B', '#3A1F0B'],
  sub: 'ضع صناديق الكنز على اللوح ليتزن تماماً قبل إزالة الدعامة',
  levels: [
    { name: 'الصندوق الأول', fixed: [[-1, 20]], crates: [10] }, { name: 'صندوقان', fixed: [[-2, 30]], crates: [20, 10] },
    { name: 'كنز ثقيل', fixed: [[-3, 15], [-1.5, 10]], crates: [40] }, { name: 'لوح له وزن', plank: { m: 20, c: -1, a: -4, b: 2 }, fixed: [], crates: [10] },
    { name: 'ثلاثة صناديق', fixed: [[-2.5, 20], [-1, 10]], crates: [15, 10, 5] }, { name: 'الطرفان', fixed: [[1.5, 40], [-.5, 20]], crates: [25, 10] },
  ],
  mission: L => `الأرقام على الصناديق كتلها بوحدة kg، والمسافات على اللوح بوحدة m. اسحب ${L.crates.length === 1 ? 'الصندوق' : 'كل الصناديق'} من الرصيف وضعها على اللوح، ثم اضغط «أزل الدعامة». يجب أن يتزن اللوح تماماً، وإلا سقط الكنز في البحر!` + (L.plank ? ` اللوح نفسه كتلته ${nb(L.plank.m, 'kg')} ومركزه على بعد ${nb(-L.plank.c, 'm')} يسار المحور.` : ''),
  hint: L => 'شرط الاتزان: مجموع العزوم حول المحور يساوي صفراً، أي <code>Σ m·d (يسار) = Σ m·d (يمين)</code>.' + (L.plank ? '<br>وزن اللوح يؤثر في مركزه، فاحسب عزمه أيضاً: <code>' + L.plank.m + ' × ' + (-L.plank.c) + '</code>.' : ''),
  go: '⚓ أزل الدعامة',
  span: L => L.plank ? [L.plank.a, L.plank.b] : [-3, 3],
  init(st, P, L) {
    const [a, b] = this.span(L);
    st.slots = []; for (let d = a; d <= b + 1e-9; d += .5) if (Math.abs(d) > 1e-9) st.slots.push(+d.toFixed(1));
    st.items = L.fixed.map(([d, m]) => ({ m, d, fixed: true })).concat(L.crates.map((m, k) => ({ m, d: null, home: k })));
    st.ang = 0; st.w = 0; st.fall = false; st.drag = null; st.sea = 0;
  },
  torque(st, L) { return st.items.reduce((s, it) => s + (it.d == null ? 0 : it.m * it.d), 0) + (L.plank ? L.plank.m * L.plank.c : 0); },
  ready(st) { if (st.items.some(it => it.d == null)) { toast('ضع كل الصناديق على اللوح أولاً'); return false; } return true; },
  launch(st, P, L) { st.tq = this.torque(st, L); st.ang = 0; st.w = 0; st.timer = 0; },
  update(st, dt, P, L) {
    st.timer += dt;
    if (Math.abs(st.tq) < 1e-6) {
      st.ang = Math.sin(st.timer * 9) * .012 * Math.max(0, 1 - st.timer);
      if (st.timer > 1.2) {
        burst(st, 400, 250, 40, { cols: ['#FFD23F', '#FFC21A', '#FFF1A8'], sp: 240, up: 260, life: 1.8, r: 6 });
        const L1 = st.items.filter(i => i.d < 0).map(i => `${i.m}×${-i.d}`).concat(L.plank ? [`${L.plank.m}×${-L.plank.c}`] : []), R1 = st.items.filter(i => i.d > 0).map(i => `${i.m}×${i.d}`);
        const sum = st.items.filter(i => i.d > 0).reduce((s, i) => s + i.m * i.d, 0);
        return gEnd(st, true, st.tries === 1 ? 3 : st.tries === 2 ? 2 : 1, 'اتزن اللوح! الكنز في أمان 💰', `العزم يساراً <code>${L1.join(' + ')} = ${sum}</code> والعزم يميناً <code>${R1.join(' + ')} = ${sum}</code> (بالوحدة kg·m مضروبة في g)، فالمجموع صفر.`);
      }
      return;
    }
    const dir = Math.sign(st.tq);
    st.w += dir * 2.2 * dt; st.ang = Math.max(-.32, Math.min(.32, st.ang + st.w * dt));
    if (Math.abs(st.ang) >= .32 && !st.fall) {
      st.fall = true; st.shake = 6; SFX.play('splash');
      st.items.forEach(it => { it.vx = dir * (60 + Math.random() * 60); it.vy = -40; });
      burst(st, dir > 0 ? 720 : 80, 400, 30, { cols: ['#BFE8FF', '#ffffff', '#7CC4F0'], sp: 160, up: 200, life: 1.1, r: 4 });
    }
    if (st.fall) { st.items.forEach(it => { it.vy += 600 * dt; it.ox = (it.ox || 0) + it.vx * dt; it.oy = (it.oy || 0) + it.vy * dt; }); st.sea += dt; }
    if (st.fall && st.sea > 1.4) {
      const left = st.items.filter(i => i.d < 0).reduce((s, i) => s + i.m * -i.d, 0) + (L.plank ? L.plank.m * -L.plank.c : 0), right = st.items.filter(i => i.d > 0).reduce((s, i) => s + i.m * i.d, 0);
      return gEnd(st, false, 0, 'انقلب اللوح وسقط الكنز في البحر! 🌊', `العزم يساراً <code>= ${left}</code> والعزم يميناً <code>= ${right}</code>. ${left > right ? 'الجهة اليسرى أثقل: حرّك صناديق نحو اليمين أو أبعدها عن المحور.' : 'الجهة اليمنى أثقل: قرّب صناديق اليمين من المحور.'}`);
    }
  },
  K: 80, PX: 400, PY: 300,
  pos(st, d) { const a = st.ang; return [this.PX + d * this.K * Math.cos(a), this.PY - 14 + d * this.K * Math.sin(a)]; },
  home(st, it) { const n = st.items.filter(i => !i.fixed).length, k = it.home; return [400 + (k - (n - 1) / 2) * 90, 440]; },
  size: m => 24 + Math.sqrt(m) * 2.2,
  pointer(cv, st) {
    const pt = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 800, (e.clientY - r.top) / r.height * 500]; };
    cv.style.touchAction = 'none';
    cv.onpointerdown = e => {
      if (st.phase !== 'aim') return; const [x, y] = pt(e);
      const it = st.items.find(i => { if (i.fixed) return false; const [ix, iy] = i.d == null ? this.home(st, i) : this.pos(st, i.d), s = this.size(i.m); return Math.abs(x - ix) < s / 2 + 8 && y > iy - s - 8 && y < iy + 8; });
      if (it) { st.drag = { it, x, y }; cv.setPointerCapture(e.pointerId); SFX.init(); }
    };
    cv.onpointermove = e => { if (st.drag) { const [x, y] = pt(e); st.drag.x = x; st.drag.y = y; } };
    cv.onpointerup = cv.onpointercancel = () => {
      const dr = st.drag; if (!dr) return; st.drag = null;
      if (dr.y > 380) { dr.it.d = null; return; }
      let best = null, bd = 1e9; st.slots.forEach(d => { const [sx] = this.pos(st, d), dist = Math.abs(sx - dr.x); if (dist < bd && !st.items.some(i => i !== dr.it && i.d === d)) { bd = dist; best = d; } });
      dr.it.d = bd < 45 ? best : null; if (dr.it.d != null) SFX.play('thud');
    };
  },
  draw(c, st, P, L) {
    skyGrad(c, ['#F6A15A', '#F8C783', '#9FD3E8'], 300);
    c.fillStyle = 'rgba(255,240,200,.9)'; c.beginPath(); c.arc(130, 120, 38, 0, 7); c.fill();
    for (let k = 0; k < 3; k++) { c.fillStyle = ['#2B7BB0', '#21689A', '#1A5683'][k]; c.beginPath(); c.moveTo(0, 250 + k * 18); for (let x = 0; x <= 800; x += 20) c.lineTo(x, 250 + k * 18 + Math.sin(x / 50 + st.t * (1.5 + k * .4)) * 4); c.lineTo(800, 500); c.lineTo(0, 500); c.fill(); }
    // deck
    c.fillStyle = '#7A4A26'; c.fillRect(120, 360, 560, 140); c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 2; for (let y = 372; y < 500; y += 16) { c.beginPath(); c.moveTo(120, y); c.lineTo(680, y); c.stroke(); }
    c.fillStyle = '#5A3418'; c.fillRect(110, 352, 580, 10);
    // mast & sail
    c.fillStyle = '#5A3418'; c.fillRect(700, 40, 10, 320); c.fillStyle = '#F2E6C8'; c.beginPath(); c.moveTo(712, 60); c.quadraticCurveTo(780 + Math.sin(st.t * 2) * 6, 140, 712, 230); c.fill();
    gtx(c, '☠', 745, 150, '#2B2B2B', 'center', 30);
    // pivot barrel and support
    c.fillStyle = '#8B5A2B'; rr(c, this.PX - 26, this.PY - 6, 52, 64, 10); c.fill(); c.strokeStyle = '#3D2612'; c.lineWidth = 3; [this.PY + 8, this.PY + 42].forEach(y => { c.beginPath(); c.moveTo(this.PX - 26, y); c.lineTo(this.PX + 26, y); c.stroke(); });
    c.fillStyle = '#3D2612'; c.beginPath(); c.moveTo(this.PX, this.PY - 16); c.lineTo(this.PX - 14, this.PY - 2); c.lineTo(this.PX + 14, this.PY - 2); c.fill();
    if (st.phase === 'aim') { const [a, b] = this.span(L); [a + .3, b - .3].forEach(d => { const x = this.PX + d * this.K; c.fillStyle = '#6B4423'; c.fillRect(x - 6, this.PY - 6, 12, 60); }); }
    // plank
    const [a, b] = this.span(L);
    c.save(); c.translate(this.PX, this.PY - 14); c.rotate(st.ang);
    const pg = c.createLinearGradient(0, -8, 0, 8); pg.addColorStop(0, '#C98A4B'); pg.addColorStop(1, '#8E5A2C'); c.fillStyle = pg; rr(c, a * this.K - 16, -8, (b - a) * this.K + 32, 16, 4); c.fill();
    c.fillStyle = 'rgba(0,0,0,.18)'; for (let d = a; d <= b + 1e-9; d += .5) c.fillRect(d * this.K - 1, -8, 2, 16);
    c.restore();
    if (st.phase === 'aim') st.slots.forEach(d => { if (Number.isInteger(d) || L.plank) { const [x, y] = this.pos(st, d); gtx(c, `${Math.abs(d)}`, x, y + 30, 'rgba(255,255,255,.75)', 'center', 12, 600); } });
    if (st.phase === 'aim') gtx(c, 'm', this.PX, this.PY + 72, 'rgba(255,255,255,.6)', 'center', 12, 600);
    if (L.plank) { const [x, y] = this.pos(st, L.plank.c); c.fillStyle = '#FF7A45'; c.beginPath(); c.arc(x, y + 4, 5, 0, 7); c.fill(); gtx(c, `وزن اللوح ${L.plank.m} kg`, x, y + 48, '#FFD3B8', 'center', 12); }
    // crates
    const crate = (x, y, m, fixed) => { const s = this.size(m); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x - s / 2 + 3, y - s + 3, s, s); const g2 = c.createLinearGradient(0, y - s, 0, y); g2.addColorStop(0, fixed ? '#7E6A55' : '#D9A24A'); g2.addColorStop(1, fixed ? '#5E4C3A' : '#A8742C'); c.fillStyle = g2; rr(c, x - s / 2, y - s, s, s, 4); c.fill(); c.strokeStyle = fixed ? '#3D2F22' : '#6B4418'; c.lineWidth = 2.5; c.strokeRect(x - s / 2 + 3, y - s + 3, s - 6, s - 6); c.beginPath(); c.moveTo(x - s / 2 + 3, y - s + 3); c.lineTo(x + s / 2 - 3, y - 3); c.stroke(); gtx(c, String(m), x, y - s / 2 + 6, '#fff', 'center', 15, 800); if (fixed) gtx(c, '🔒', x + s / 2 - 4, y - s + 2, '#fff', 'center', 12); };
    if (st.phase === 'aim') { c.fillStyle = 'rgba(0,0,0,.18)'; rr(c, 180, 400, 440, 60, 14); c.fill(); gtx(c, 'الرصيف: اسحب الصناديق إلى اللوح', 400, 488, 'rgba(255,255,255,.7)', 'center', 13); }
    st.items.forEach(it => {
      if (st.drag && st.drag.it === it) return;
      if (it.d == null) { const [x, y] = this.home(st, it); return crate(x, y, it.m, false); }
      const [x, y] = this.pos(st, it.d); crate(x + (it.ox || 0), y - 8 + (it.oy || 0), it.m, it.fixed);
    });
    if (st.drag) crate(st.drag.x, st.drag.y + 20, st.drag.it.m, false);
    if (st.phase === 'aim') { const tq = this.torque(st, L), tilt = Math.abs(tq) < 1e-6 ? 'متزن ✓' : '؟'; pill(c, `المحاولات: ${st.tries}`, 90, 34, 'rgba(0,0,0,.4)'); if (st.items.every(i => i.d != null)) pill(c, tilt === '؟' ? 'جاهز؟ أزل الدعامة' : 'جاهز؟ أزل الدعامة', 680, 34, 'rgba(0,0,0,.4)', '#FFD23F'); }
  },
};

/* =====================================================================
   Grade 12 · 🎢 أفعوانية الطاقة   (حفظ الطاقة الميكانيكية والشغل ضد الاحتكاك)
   ===================================================================== */
const COASTER = {
  g: 'g12', t: 'أفعوانية الطاقة', ic: '🎢', topic: 'حفظ الطاقة', c: ['#FF4D7A', '#3A0B4A'],
  sub: 'اختر ارتفاع البداية لتعبر العربة التلال وتصل بسرعة آمنة',
  levels: [
    { name: 'التل الأول', pts: [[0, 0], [14, 0], [30, 8], [46, 0], [64, 0]], vmax: 14 },
    { name: 'منصة عالية', pts: [[0, 0], [14, 1], [30, 12], [46, 4], [58, 6], [68, 6]], vmax: 12 },
    { name: 'سرعة محددة', pts: [[0, 0], [14, 0], [28, 4], [42, 0], [62, 0]], vexact: 10 },
    { name: 'مع الاحتكاك', pts: [[0, 0], [15, 0], [35, 0], [50, 4], [64, 4]], vmax: 6, m: 50, f: 100, rough: [15, 35] },
    { name: 'التحدي الأخير', pts: [[0, 0], [14, 0], [26, 0], [40, 10], [54, 2], [66, 2]], vmax: 14, m: 80, f: 200, rough: [14, 26] },
  ],
  mission(L) {
    const hill = Math.max(...L.pts.slice(1, -1).map(p => p[1])), end = L.pts[L.pts.length - 1][1];
    return `ارفع نقطة البداية H لتعبر العربة أعلى تل (${nb(hill, 'm')}) وتصل إلى النهاية (ارتفاعها ${nb(end, 'm')}) ` + (L.vexact ? `بسرعة ${nb(L.vexact, 'm/s')} تماماً.` : `بسرعة لا تزيد عن ${nb(L.vmax, 'm/s')}.`) + (L.f ? ` على المسار منطقة خشنة طولها ${nb(L.rough[1] - L.rough[0], 'm')} وقوة الاحتكاك فيها ${nb(L.f, 'N')}، وكتلة العربة ${nb(L.m, 'kg')}. باقي المسار أملس.` : ' المسار أملس بدون احتكاك.') + ` ${nb('g = 10', 'm/s²')}`;
  },
  hint: L => 'بدون احتكاك الطاقة الميكانيكية محفوظة: <code>m·g·H = m·g·h + ½·m·v²</code> ← <code>v = √(2g(H − h))</code>.' + (L.f ? '<br>مع الاحتكاك يضيع شغل الاحتكاك <code>W = f·d</code>: <code>m·g·H = m·g·h + ½·m·v² + f·d</code>.' : '') + '<br>ولكي تعبر التل يجب أن تكون <code>H</code> أكبر من ارتفاع التل (مع الطاقة الضائعة قبله).',
  controls: () => [{ id: 'H', label: 'ارتفاع البداية H', min: 2, max: 20, step: .5, v: 6, unit: 'm', dec: 1 }],
  go: '🎢 انطلق',
  // Smooth track through the points, starting at height H; sampled every 0.2 m along x.
  track(L, H) {
    const pts = L.pts.map((p, k) => k === 0 ? [p[0], H] : p), out = [];
    for (let k = 0; k < pts.length - 1; k++) { const [x0, y0] = pts[k], [x1, y1] = pts[k + 1]; for (let x = x0; x < x1; x += .2) { const u = (x - x0) / (x1 - x0); out.push([x, y0 + (y1 - y0) * (1 - Math.cos(Math.PI * u)) / 2]); } }
    out.push(pts[pts.length - 1]);
    const s = [0]; for (let k = 1; k < out.length; k++) s.push(s[k - 1] + Math.hypot(out[k][0] - out[k - 1][0], out[k][1] - out[k - 1][1]));
    return { p: out, s, len: s[s.length - 1] };
  },
  init(st, P) { st.k = 3; st.dir = 1; st.vv = 0; st.stall = 0; st.gate = 0; },
  launch(st, P, L) { st.tr = this.track(L, P.H); st.k = 3; st.dir = 1; st.stall = 0; st.vmaxSeen = 0; },
  rough: (L, x) => L.rough ? Math.max(0, Math.min(x, L.rough[1]) - L.rough[0]) : 0,
  v2(st, P, L, k) { const [x, y] = st.tr.p[k]; return 2 * 10 * (P.H - y) - 2 * ((L.f || 0) / (L.m || 1)) * this.rough(L, x); },
  update(st, dt, P, L) {
    const tr = st.tr, n = tr.p.length;
    if (st.stall) {
      st.stall += dt; st.k = Math.max(1, st.k - 12 * dt * 6);
      if (st.stall > 1.6) return gEnd(st, false, 0, 'لم تكفِ الطاقة لعبور التل! ⛰️', `عند هذا الموضع أصبحت الطاقة الحركية صفراً: ${L.f ? 'طاقة الوضع في البداية لم تكفِ لرفع العربة إلى التل وتعويض شغل الاحتكاك.' : 'يجب أن يكون ارتفاع البداية أكبر من ارتفاع التل.'} ارفع H.`);
      return;
    }
    let budget = dt * 1.4;
    while (budget > 0 && st.k < n - 1) {
      const v2 = this.v2(st, P, L, Math.floor(st.k)), v = Math.sqrt(Math.max(v2, 0)) || .8;
      if (v2 <= 0 && st.k > 5) { st.stall = .001; SFX.play('fail'); return; }
      const ds = tr.s[Math.min(n - 1, Math.floor(st.k) + 1)] - tr.s[Math.floor(st.k)];
      st.k += Math.min(1, v * budget / Math.max(ds, 1e-3)); budget -= ds / Math.max(v, .8); st.vv = v;
    }
    if (st.k >= n - 1) {
      const vf = Math.sqrt(Math.max(0, this.v2(st, P, L, n - 1))), end = L.pts[L.pts.length - 1][1];
      const why = `<code>½·v² = g·(H − h)${L.f ? ' − (f / m)·d' : ''}</code> ← <code>v = √(2 × 10 × (${P.H} − ${end})${L.f ? ` − 2 × (${L.f} / ${L.m}) × ${L.rough[1] - L.rough[0]}` : ''}) ≈ ${vf.toFixed(1)} m/s</code>.`;
      if (L.vexact) { const e = Math.abs(vf - L.vexact); if (e <= .6) return gEnd(st, true, st.tries === 1 ? 3 : st.tries <= 3 ? 2 : 1, 'وصلت بالسرعة المطلوبة تماماً! 🎯', why); }
      else if (vf <= L.vmax) return gEnd(st, true, st.tries === 1 ? 3 : st.tries <= 3 ? 2 : 1, 'رحلة آمنة! وصلت العربة بسلام 🎉', why);
      st.shake = 10; SFX.play('boom'); burst(st, this.SX(tr.p[n - 1][0]), this.SY(end) - 20, 26, { cols: ['#FFC83D', '#FF7A45', '#fff'], sp: 240, up: 120, life: .8, r: 3 });
      return gEnd(st, false, 0, L.vexact ? `وصلت بسرعة ${vf.toFixed(1)} m/s، والمطلوب ${L.vexact} m/s` : `سرعة خطرة! ${vf.toFixed(1)} m/s أكبر من ${L.vmax} m/s 💥`, why + ' غيّر ارتفاع البداية.');
    }
  },
  SX: x => 60 + x * 10.4, SY: y => 430 - y * 13,
  draw(c, st, P, L) {
    const SX = this.SX, SY = this.SY, tr = st.phase === 'aim' ? this.track(L, P.H) : st.tr, n = tr.p.length;
    skyGrad(c, ['#2B1055', '#7A2C7E', '#E8607A', '#FFB86B'], 430);
    // ferris wheel
    c.save(); c.translate(680, 250); c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 90, 0, 7); c.stroke();
    for (let k = 0; k < 10; k++) { const a = st.t * .3 + k * Math.PI / 5; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * 90, Math.sin(a) * 90); c.stroke(); c.fillStyle = ['#FF4D7A', '#FFC83D', '#4C86FF'][k % 3]; c.beginPath(); c.arc(Math.cos(a) * 90, Math.sin(a) * 90 + 8, 6, 0, 7); c.fill(); }
    c.beginPath(); c.moveTo(-40, 180); c.lineTo(0, 0); c.lineTo(40, 180); c.stroke(); c.restore();
    c.fillStyle = '#2A1840'; c.fillRect(0, 430, 800, 70); c.fillStyle = '#3B2458'; c.fillRect(0, 430, 800, 6);
    // supports
    c.strokeStyle = 'rgba(200,180,230,.35)'; c.lineWidth = 3; for (let k = 0; k < n; k += 15) { const [x, y] = tr.p[k]; c.beginPath(); c.moveTo(SX(x), SY(y) + 4); c.lineTo(SX(x), 430); c.stroke(); }
    // rails
    c.strokeStyle = '#E8E1F5'; c.lineWidth = 3; c.beginPath(); tr.p.forEach(([x, y], k) => k ? c.lineTo(SX(x), SY(y)) : c.moveTo(SX(x), SY(y))); c.stroke();
    c.strokeStyle = '#9B8CC0'; c.beginPath(); tr.p.forEach(([x, y], k) => k ? c.lineTo(SX(x), SY(y) + 6) : c.moveTo(SX(x), SY(y) + 6)); c.stroke();
    if (L.rough) { const [r0, r1] = L.rough; c.fillStyle = 'rgba(160,110,60,.85)'; c.fillRect(SX(r0), SY(0) - 3, SX(r1) - SX(r0), 9); c.fillStyle = 'rgba(90,60,30,.9)'; for (let x = r0; x < r1; x += .8) c.fillRect(SX(x), SY(0) - 3, 3, 9); gtx(c, `منطقة خشنة: ${r1 - r0} m`, (SX(r0) + SX(r1)) / 2, SY(0) + 26, '#E8C08A', 'center', 12); }
    // start tower label, hill labels, finish gate
    pill(c, `H = ${P.H.toFixed(1)} m`, SX(0) + 30, SY(P.H) - 18, 'rgba(0,0,0,.45)', '#FFD23F');
    L.pts.slice(1, -1).forEach(([x, y]) => { if (y > 0) gtx(c, `${y} m`, SX(x), SY(y) - 14, 'rgba(255,255,255,.75)', 'center', 12); });
    const [ex, ey] = L.pts[L.pts.length - 1]; c.fillStyle = '#FFD23F'; c.fillRect(SX(ex) - 4, SY(ey) - 50, 6, 50); c.fillRect(SX(ex) + 20, SY(ey) - 50, 6, 50); c.fillStyle = '#FF4D7A'; c.fillRect(SX(ex) - 4, SY(ey) - 54, 30, 10);
    gtx(c, L.vexact ? `${L.vexact} m/s` : `≤ ${L.vmax} m/s`, SX(ex) + 11, SY(ey) - 62, '#fff', 'center', 13);
    // cart
    const k = Math.min(n - 1, Math.max(0, Math.floor(st.phase === 'aim' ? 3 : st.k))), k2 = Math.min(n - 1, k + 1), [x1, y1] = tr.p[k], [x2, y2] = tr.p[k2];
    const ang = Math.atan2(SY(y2) - SY(y1), SX(x2) - SX(x1));
    c.save(); c.translate(SX(x1), SY(y1) - 4); c.rotate(ang);
    c.fillStyle = '#FF4D7A'; rr(c, -18, -16, 36, 14, 5); c.fill(); c.fillStyle = '#FFD23F'; c.fillRect(-18, -6, 36, 3);
    [-7, 7].forEach((hx, i) => { c.fillStyle = i ? '#F2C9A0' : '#8A5A3A'; c.beginPath(); c.arc(hx, -20, 5, 0, 7); c.fill(); if (st.vv > 8) { c.strokeStyle = c.fillStyle; c.lineWidth = 2; c.beginPath(); c.moveTo(hx, -22); c.lineTo(hx + 3, -32); c.stroke(); } });
    c.fillStyle = '#222'; [-11, 11].forEach(w => { c.beginPath(); c.arc(w, 0, 4, 0, 7); c.fill(); });
    c.restore();
    // energy bars
    if (st.phase !== 'aim') {
      const m = L.m || 1, E = 10 * P.H, h = y1, v2 = Math.max(0, this.v2(st, P, L, k)), pe = 10 * h, ke = v2 / 2, heat = Math.max(0, E - pe - ke);
      [['طاقة الوضع', pe, '#4C86FF'], ['الطاقة الحركية', ke, '#32D17A'], ['الحرارية', heat, '#FFA53A']].forEach(([t, v, col], i) => {
        if (i === 2 && !L.f) return; const y = 24 + i * 26; gtx(c, t, 788, y + 12, 'rgba(255,255,255,.8)', 'right', 12); c.fillStyle = 'rgba(255,255,255,.12)'; rr(c, 520, y, 170, 14, 7); c.fill(); c.fillStyle = col; rr(c, 520, y, Math.max(3, 170 * v / E), 14, 7); c.fill();
      });
      pill(c, `v = ${Math.sqrt(v2).toFixed(1)} m/s`, 80, 34, 'rgba(0,0,0,.45)');
      void m;
    }
  },
};

const GAMES = { car: CAR, egg: EGG, cannon: CANNON, boat: BOAT, pirate: PIRATE, coaster: COASTER };

// The home and lab screens were drawn before this file loaded; draw them again with the games card.
if (!S.stack.length) render(false);
