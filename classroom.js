/* ---------- الفصل المباشر والسبورة التفاعلية ----------
   Loaded after the main script, so it uses its helpers: db, USER, ADMIN, ACCOUNTS, PROFILE, S, G, go, render, sheet, closeSheet,
   toast, esc, icon, addXP, authSheet, firstName, store, liveModelSheet, dbError.
   Live strokes travel over Supabase Realtime private channels (see supabase-class.sql):
   class:<code> carries the board (teacher or pen holder), classin:<code> carries the students' hands, questions, votes and reactions.
   The teacher's device also saves the board to class_rooms.board so late joiners and reloads start from it. */
const BW = 1600, BH = 1000;
const CLS_COLORS = ['#F5F7FA', '#14161C', '#FF3B30', '#FFD84D', '#4FD1FF', '#6BE38A', '#FF6B9A'];
const CLS_WIDTHS = [4, 8, 16];
const CLS_REACTS = ['👍', '👏', '❤️', '😮', '🤔'];
const CLS_SQL_MSG = 'الفصل المباشر يحتاج تشغيل ملف supabase-class.sql مرة واحدة في Supabase.';
const CLS = { code: '', role: '', board: null, chB: null, chI: null, members: [], questions: [], poll: null, votes: {}, pen: null,
  tool: 'pen', color: CLS_COLORS[0], width: CLS_WIDTHS[0], mine: [], status: '', err: '', ended: false, full: false, tab: 'people',
  found: null, foundAt: 0, laser: [], cur: null, pend: [], lastSend: 0, saveT: 0, anim: 0, reactAt: 0, myHand: false, xp: '' };

const clsHost = () => CLS.role === 'host';
const clsCanDraw = () => clsHost() || (CLS.pen && USER && CLS.pen === USER.id);
const clsPage = () => CLS.board.pages[CLS.board.cur] || (CLS.board.pages[CLS.board.cur] = { s: [] });
const clsRid = () => Math.random().toString(36).slice(2, 9);
const clsSendMs = () => Math.min(600, Math.max(120, CLS.members.length * 12));
const clsName = () => (firstName() || (PROFILE && PROFILE.username) || (ADMIN ? 'المعلم' : 'طالب')).slice(0, 40);
const clsBoardJson = () => JSON.parse(JSON.stringify(CLS.board, (k, v) => k[0] === '_' ? undefined : v));
const clsTop = () => { const t = S.stack[S.stack.length - 1]; return !!t && t.type === 'class'; };

/* ---------- Home row: open / rejoin / join ---------- */
async function clsCheck() {
  if (!db || !USER || Date.now() - CLS.foundAt < 20000) return;
  CLS.foundAt = Date.now();
  const { data } = await db.from('class_rooms').select('code,grade,created_at').eq('grade', S.grade).eq('open', true).order('created_at', { ascending: false }).limit(1);
  const f = data && data[0] && Date.now() - new Date(data[0].created_at) < 12 * 36e5 ? data[0].code : null;
  if (f !== CLS.found) { CLS.found = f; if (!S.stack.length && S.tab === 'home') render(false); }
}
function clsRow() {
  if (!db || !ACCOUNTS) return '';
  setTimeout(clsCheck, 0);
  if (CLS.code && !CLS.ended) return `<button class="mx-row cls-row on" data-go="class"><span class="n">🧑‍🏫</span><span class="t"><b>ارجع إلى الفصل المباشر</b><small>أنت متصل بالفصل ${CLS.code}</small></span>${icon('chev')}</button>`;
  if (ADMIN) return CLS.found
    ? `<button class="mx-row cls-row on" data-act="cls-rehost" data-code="${CLS.found}"><span class="n">🧑‍🏫</span><span class="t"><b>ارجع إلى فصلك المفتوح</b><small>الفصل ${CLS.found} ما زال مفتوحاً للطلاب</small></span>${icon('chev')}</button>`
    : `<button class="mx-row cls-row" data-act="cls-new"><span class="n">🧑‍🏫</span><span class="t"><b>افتح فصلاً مباشراً</b><small>سبورة تفاعلية يراها الطلاب لحظياً ويشاركون فيها</small></span>${icon('chev')}</button>`;
  return CLS.found ? `<button class="mx-row cls-row on" data-act="cls-join" data-code="${CLS.found}"><span class="n"><i class="cls-dot"></i></span><span class="t"><b>الفصل المباشر مفتوح الآن</b><small>اضغط للانضمام إلى سبورة المعلم</small></span>${icon('chev')}</button>` : '';
}

/* ---------- Opening, joining and leaving ---------- */
async function clsCreate() {
  if (!db || !ADMIN) return toast('سجّل الدخول بحساب المعلم أولاً');
  await db.from('class_rooms').delete().lt('created_at', new Date(Date.now() - 12 * 36e5).toISOString());
  await db.from('class_rooms').update({ open: false }).eq('grade', S.grade).eq('open', true);
  for (let i = 0; i < 6; i++) {
    const code = String(1000 + Math.floor(Math.random() * 9000)), board = { pages: [{ s: [] }], cur: 0, grid: true };
    const { error } = await db.from('class_rooms').insert({ code, grade: S.grade, board });
    if (!error) return clsEnter(code, 'host', board, null);
    if (!/duplicate|23505/.test(error.message + error.code)) return toast(/relation|does not exist|42P01/.test(error.message + error.code) ? CLS_SQL_MSG : dbError(error));
  }
  toast('تعذّر فتح الفصل، حاول مرة أخرى');
}
async function clsJoin(code, asHost) {
  if (!db || !USER) return authSheet('login', () => clsJoin(code, asHost));
  const { data: room, error } = await db.from('class_rooms').select('*').eq('code', code).maybeSingle();
  if (error && /relation|does not exist|42P01/.test(error.message + error.code)) return toast(CLS_SQL_MSG);
  if (!room || !room.open) { CLS.found = null; CLS.foundAt = 0; render(false); return toast('انتهى هذا الفصل'); }
  clsEnter(code, asHost && ADMIN ? 'host' : 'student', room.board && room.board.pages ? room.board : { pages: [{ s: [] }], cur: 0, grid: true }, room.pen);
}
function clsEnter(code, role, board, pen) {
  clsDisconnect();
  Object.assign(CLS, { code, role, board, pen, members: [], questions: [], poll: null, votes: {}, mine: [], status: 'connecting', err: '', ended: false, full: false, tab: 'people', myHand: false, tool: 'pen' });
  if (role === 'student' && CLS.xp !== code) { CLS.xp = code; addXP(10); }
  clsConnect();
  if (clsTop()) render(false); else go('class');
}
function clsConnect() {
  const priv = { private: true, broadcast: { self: false } };
  CLS.chB = db.channel('class:' + CLS.code, { config: priv })
    .on('broadcast', { event: 'b' }, ({ payload }) => clsOnBoard(payload))
    .subscribe(st => clsStatus(st));
  CLS.chI = db.channel('classin:' + CLS.code, { config: Object.assign({ presence: { key: USER.id } }, priv) })
    .on('broadcast', { event: 'i' }, ({ payload }) => clsOnIn(payload))
    .on('presence', { event: 'sync' }, () => clsPresence())
    .subscribe(st => {
      clsStatus(st);
      if (st !== 'SUBSCRIBED') return;
      clsTrack();
      if (!clsHost()) clsIn({ t: 'sync' });
    });
}
function clsStatus(st) {
  const before = CLS.status;
  if (st === 'SUBSCRIBED') CLS.status = 'ok';
  else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') { CLS.status = 'err'; CLS.err = clsHost() ? CLS_SQL_MSG : 'تعذّر الاتصال بالفصل. تأكد من اتصالك بالإنترنت.'; }
  if (before !== CLS.status && clsTop()) clsSide();
}
function clsTrack() { if (CLS.chI) CLS.chI.track({ name: clsName(), role: CLS.role, hand: CLS.myHand ? Date.now() : 0 }); }
function clsDisconnect() {
  if (CLS.chB) db.removeChannel(CLS.chB); if (CLS.chI) db.removeChannel(CLS.chI);
  CLS.chB = CLS.chI = null; clearTimeout(CLS.saveT);
}
/* A student who is handed the pen rejoins the board channel so the server re-checks that they may draw. */
function clsRejoinBoard() {
  if (CLS.chB) db.removeChannel(CLS.chB);
  CLS.chB = db.channel('class:' + CLS.code, { config: { private: true, broadcast: { self: false } } })
    .on('broadcast', { event: 'b' }, ({ payload }) => clsOnBoard(payload)).subscribe(st => clsStatus(st));
}
function clsLeave() {
  clsDisconnect(); CLS.code = ''; CLS.role = ''; CLS.found = null; CLS.foundAt = 0;
  S.stack = S.stack.filter(t => t.type !== 'class'); render();
}
async function clsEnd() {
  clsSend({ t: 'end' });
  if (CLS.code) await db.from('class_rooms').update({ open: false, board: clsBoardJson() }).eq('code', CLS.code);
  toast('انتهى الفصل'); clsLeave();
}

/* ---------- Messages ---------- */
const clsSend = p => { if (CLS.chB && CLS.status === 'ok') CLS.chB.send({ type: 'broadcast', event: 'b', payload: p }); };
const clsIn = p => { if (CLS.chI && CLS.status === 'ok') CLS.chI.send({ type: 'broadcast', event: 'i', payload: p }); };
function clsSave() {
  if (!clsHost()) return;
  clearTimeout(CLS.saveT);
  CLS.saveT = setTimeout(() => db.from('class_rooms').update({ board: clsBoardJson() }).eq('code', CLS.code).then(() => {}), 2000);
}
function clsOnBoard(m) {
  const B = CLS.board; if (!B) return;
  const pg = m.pg != null ? (B.pages[m.pg] || (B.pages[m.pg] = { s: [] })) : null;
  if (m.t === 's' || m.t === 'e') {
    let st = pg.s.find(x => x.id === m.id);
    if (!st) { st = { id: m.id, k: m.k, c: m.c, w: m.w, p: [] }; pg.s.push(st); }
    if (m.t === 'e' || m.r) { st.p = m.p; st._q = null; } else (st._q || (st._q = [])).push(...m.p);
    clsAnimate();
  } else if (m.t === 'd') pg.s = pg.s.filter(x => !m.ids.includes(x.id));
  else if (m.t === 'c') pg.s = [];
  else if (m.t === 'pg') { while (B.pages.length < m.n) B.pages.push({ s: [] }); B.cur = m.cur; clsBar(); }
  else if (m.t === 'g') B.grid = m.on;
  else if (m.t === 'v') pg.v = m.v;
  else if (m.t === 'st') { CLS.board = m.board; clsBar(); }
  else if (m.t === 'z') { CLS.laser.push({ x: m.x, y: m.y, at: Date.now() }); clsAnimate(); return; }
  else if (m.t === 'pen') return clsPenCheck();
  else if (m.t === 'poll') { CLS.poll = m.poll; return clsSide(); }
  else if (m.t === 'end') { CLS.ended = true; clsDisconnect(); return clsTop() ? render(false) : null; }
  if (clsHost() && m.t !== 's') clsSave();
  clsDraw();
}
async function clsPenCheck() {
  const { data } = await db.from('class_rooms').select('pen').eq('code', CLS.code).maybeSingle();
  const had = clsCanDraw(); CLS.pen = data ? data.pen : null;
  if (!clsHost() && clsCanDraw() !== had) {
    if (clsCanDraw()) { clsRejoinBoard(); toast('أعطاك المعلم القلم ✏️ اكتب على السبورة'); } else { CLS.tool = 'pen'; toast('استرجع المعلم القلم'); }
    if (clsTop()) render(false);
  }
}
function clsOnIn(m) {
  if (m.t === 'r') return clsFloat(m.e);
  if (m.t === 'lower' && USER && m.uid === USER.id) { CLS.myHand = false; clsTrack(); return clsSide(); }
  if (!clsHost()) return;
  if (m.t === 'sync') clsSend({ t: 'st', board: clsBoardJson() });
  else if (m.t === 'q') { CLS.questions.push({ id: m.id, name: m.name, text: m.text, at: Date.now() }); toast(`سؤال من ${m.name}`); clsSide(); }
  else if (m.t === 'v' && CLS.poll && CLS.poll.id === m.id && CLS.poll.open) { CLS.votes[m.uid] = m.pick; clsSide(); }
}
function clsPresence() {
  const st = CLS.chI ? CLS.chI.presenceState() : {};
  CLS.members = Object.entries(st).map(([id, arr]) => Object.assign({ id }, arr[arr.length - 1])).filter(x => x.role !== 'host');
  clsSide();
}

/* ---------- Drawing ---------- */
function clsCanvas() { return document.getElementById('cls-cv'); }
function clsDrawStroke(c, s) {
  const p = s.p; if (!p || p.length < 2) return;
  c.strokeStyle = c.fillStyle = s.c; c.lineWidth = s.w; c.lineCap = c.lineJoin = 'round';
  c.beginPath();
  if (s.k === 'l' || s.k === 'a') {
    c.moveTo(p[0], p[1]); c.lineTo(p[2], p[3]); c.stroke();
    if (s.k === 'a') { const a = Math.atan2(p[3] - p[1], p[2] - p[0]), L = 22 + s.w * 2.2;
      c.beginPath(); c.moveTo(p[2], p[3]); c.lineTo(p[2] - L * Math.cos(a - .42), p[3] - L * Math.sin(a - .42)); c.lineTo(p[2] - L * Math.cos(a + .42), p[3] - L * Math.sin(a + .42)); c.closePath(); c.fill(); }
    return;
  }
  if (p.length === 2) { c.arc(p[0], p[1], s.w / 2, 0, 7); c.fill(); return; }
  c.moveTo(p[0], p[1]);
  for (let i = 2; i < p.length - 2; i += 2) c.quadraticCurveTo(p[i], p[i + 1], (p[i] + p[i + 2]) / 2, (p[i + 1] + p[i + 3]) / 2);
  c.lineTo(p[p.length - 2], p[p.length - 1]); c.stroke();
}
function clsDraw() {
  const cv = clsCanvas(); if (!cv || !CLS.board) return;
  const c = cv.getContext('2d'), k = cv.width / BW, V = clsV(), kz = k * V.z;
  c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#0B1612'; c.fillRect(0, 0, cv.width, cv.height);
  c.setTransform(kz, 0, 0, kz, -V.x * kz, -V.y * kz);
  c.fillStyle = '#10211B'; c.fillRect(0, 0, BW, BH);
  const bg = clsPage().bg;
  if (bg) {
    const im = (V.z > 1.6 && clsBg(bg, 1)) || clsBg(bg, 0);
    if (im) { const k2 = Math.min(BW / im.width, BH / im.height), w = im.width * k2, h = im.height * k2;
      c.fillStyle = '#fff'; c.fillRect((BW - w) / 2, (BH - h) / 2, w, h); c.drawImage(im, (BW - w) / 2, (BH - h) / 2, w, h); }
    else { c.fillStyle = 'rgba(255,255,255,.6)'; c.font = '600 40px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText((CLS_BG[bg.u + '#' + bg.n] || {}).err ? 'تعذّر تحميل الصفحة' : 'جارٍ تحميل الصفحة…', BW / 2, BH / 2); }
    const nx = CLS.board.pages[CLS.board.cur + 1]; if (nx && nx.bg) clsBg(nx.bg);
  } else if (CLS.board.grid) {
    for (let x = 50; x < BW; x += 50) { c.fillStyle = x % 250 ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.1)'; c.fillRect(x - .75, 0, 1.5, BH); }
    for (let y = 50; y < BH; y += 50) { c.fillStyle = y % 250 ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.1)'; c.fillRect(0, y - .75, BW, 1.5); }
  }
  clsPage().s.forEach(s => clsDrawStroke(c, s));
  const ov = document.getElementById('cls-ov'); if (!ov) return;
  const o = ov.getContext('2d'); o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, ov.width, ov.height); o.setTransform(kz, 0, 0, kz, -V.x * kz, -V.y * kz);
  const now = Date.now(); CLS.laser = CLS.laser.filter(l => now - l.at < 700);
  CLS.laser.forEach((l, i) => { const a = 1 - (now - l.at) / 700; o.fillStyle = `rgba(255,59,92,${a * (i === CLS.laser.length - 1 ? 1 : .45)})`; o.beginPath(); o.arc(l.x, l.y, (i === CLS.laser.length - 1 ? 14 : 9 * a + 2) / V.z, 0, 7); o.fill(); });
  const zl = document.getElementById('cls-zl'); if (zl) zl.textContent = Math.round(V.z * 100) + '%';
}
/* ---------- Zoom and pan: each page keeps its own view (v), and students follow the teacher's view ---------- */
const clsV = () => { const p = clsPage(); return p.v || (p.v = { z: 1, x: 0, y: 0 }); };
function clsClampV(v) {
  v.z = Math.min(5, Math.max(1, v.z));
  v.x = Math.min(BW - BW / v.z, Math.max(0, v.x)); v.y = Math.min(BH - BH / v.z, Math.max(0, v.y)); return v;
}
/* Screen position in board units (0..BW, 0..BH) before the view is applied */
function clsScr(cx, cy) { const r = clsCanvas().getBoundingClientRect(); return [(cx - r.left) / r.width * BW, (cy - r.top) / r.height * BH]; }
function clsZoomAt(sx, sy, z) {
  const v = clsV(), bx = v.x + sx / v.z, by = v.y + sy / v.z;
  v.z = Math.min(5, Math.max(1, z)); v.x = bx - sx / v.z; v.y = by - sy / v.z; clsClampV(v); clsDraw(); clsViewSend();
}
function clsViewSend(force) {
  if (!clsHost()) return; const now = Date.now();
  if (!force && now - (CLS.vSent || 0) < Math.max(80, clsSendMs() / 2)) { clearTimeout(CLS.vT); CLS.vT = setTimeout(() => clsViewSend(true), 120); return; }
  CLS.vSent = now; clearTimeout(CLS.vT);
  const v = clsV(); clsSend({ t: 'v', pg: CLS.board.cur, v: { z: +v.z.toFixed(3), x: Math.round(v.x), y: Math.round(v.y) } }); clsSave();
}
/* Remote strokes arrive in batches; feed their points in a few per frame so the line is drawn smoothly. */
function clsAnimate() {
  if (CLS.anim) return;
  const step = () => {
    let busy = CLS.laser.length > 0;
    CLS.board && clsPage().s.forEach(s => { if (s._q && s._q.length) { const n = Math.max(2, Math.ceil(s._q.length / (clsSendMs() / 16) / 2) * 2); s.p.push(...s._q.splice(0, n)); busy = true; } });
    clsDraw();
    CLS.anim = busy && clsCanvas() ? requestAnimationFrame(step) : 0;
  };
  CLS.anim = requestAnimationFrame(step);
}
function clsPt(e) { const [sx, sy] = clsScr(e.clientX, e.clientY), v = clsV(); return [Math.round(v.x + sx / v.z), Math.round(v.y + sy / v.z)]; }
function clsErase(x, y) {
  const pg = clsPage(), R = 24 / clsV().z, hit = pg.s.filter(s => {
    const p = s.p;
    if (s.k === 'l' || s.k === 'a') { const dx = p[2] - p[0], dy = p[3] - p[1], t = Math.max(0, Math.min(1, ((x - p[0]) * dx + (y - p[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(p[0] + t * dx - x, p[1] + t * dy - y) < R + s.w / 2; }
    for (let i = 0; i < p.length; i += 2) if (Math.hypot(p[i] - x, p[i + 1] - y) < R + s.w / 2) return true; return false;
  }).map(s => s.id);
  if (!hit.length) return;
  pg.s = pg.s.filter(s => !hit.includes(s.id)); clsSend({ t: 'd', pg: CLS.board.cur, ids: hit }); clsSave(); clsDraw();
}
function clsFlush(force) {
  const s = CLS.cur; if (!s || (!force && Date.now() - CLS.lastSend < clsSendMs())) return;
  CLS.lastSend = Date.now();
  const base = { id: s.id, pg: CLS.board.cur, k: s.k, c: s.c, w: s.w };
  if (s.k !== 'p') clsSend(Object.assign(base, { t: 's', r: 1, p: s.p }));
  else if (CLS.pend.length) clsSend(Object.assign(base, { t: 's', p: CLS.pend }));
  CLS.pend = [];
}
function clsMount() {
  const cv = clsCanvas(); if (!cv) return;
  const fit = () => { [cv, document.getElementById('cls-ov')].forEach(x => { const d = Math.min(2, devicePixelRatio || 1); x.width = Math.round(x.clientWidth * d); x.height = Math.round(x.clientWidth * d * BH / BW); }); clsDraw(); };
  fit(); window.onresize = () => { if (clsCanvas()) fit(); };
  if (!clsCanDraw()) return;
  const touches = new Map(); let pinch = null, pan = null;
  const mid = () => { const [a, b] = [...touches.values()]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.hypot(a[0] - b[0], a[1] - b[1])]; };
  cv.style.cursor = CLS.tool === 'hand' ? 'grab' : 'crosshair';
  if (clsHost()) {
    cv.onwheel = e => { e.preventDefault(); const [sx, sy] = clsScr(e.clientX, e.clientY), v = clsV();
      if (e.ctrlKey || e.metaKey) clsZoomAt(sx, sy, v.z * Math.exp(-e.deltaY * .01));
      else { v.x += e.deltaX / v.z; v.y += e.deltaY / v.z; clsClampV(v); clsDraw(); clsViewSend(); } };
    cv.addEventListener('gesturestart', e => e.preventDefault());
  }
  cv.onpointerdown = e => {
    if (e.pointerType === 'mouse' && e.button) return;
    touches.set(e.pointerId, [e.clientX, e.clientY]);
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    if (touches.size === 2 && clsHost()) {   // two fingers: zoom and move, and drop the line the first finger just started
      const s = CLS.cur; CLS.cur = null; pan = null;
      if (s && s.id) { clsPage().s = clsPage().s.filter(x => x !== s); clsSend({ t: 'd', pg: CLS.board.cur, ids: [s.id] }); clsDraw(); }
      const [mx, my, d] = mid(), [sx, sy] = clsScr(mx, my), v = clsV();
      pinch = { d, z: v.z, bx: v.x + sx / v.z, by: v.y + sy / v.z }; return;
    }
    if (touches.size > 1 || CLS.cur) return;
    if (CLS.tool === 'hand' && clsHost()) { const v = clsV(); pan = { cx: e.clientX, cy: e.clientY, x: v.x, y: v.y }; cv.style.cursor = 'grabbing'; return; }
    const [x, y] = clsPt(e);
    if (CLS.tool === 'erase') { CLS.cur = { erase: true }; return clsErase(x, y); }
    if (CLS.tool === 'laser') { CLS.cur = { laser: true }; CLS.laser.push({ x, y, at: Date.now() }); clsSend({ t: 'z', x, y }); return clsAnimate(); }
    const k = { pen: 'p', line: 'l', arrow: 'a' }[CLS.tool];
    CLS.cur = { id: clsRid(), k, c: CLS.color, w: +(CLS.width / clsV().z).toFixed(2), p: k === 'p' ? [x, y] : [x, y, x, y] };
    CLS.pend = k === 'p' ? [x, y] : []; clsPage().s.push(CLS.cur); clsDraw(); clsFlush(true);
  };
  cv.onpointermove = e => {
    if (touches.has(e.pointerId)) touches.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch) { if (touches.size < 2) return; const [mx, my, d] = mid(), [sx, sy] = clsScr(mx, my), v = clsV();
      v.z = Math.min(5, Math.max(1, pinch.z * d / (pinch.d || 1))); v.x = pinch.bx - sx / v.z; v.y = pinch.by - sy / v.z; clsClampV(v); clsDraw(); return clsViewSend(); }
    if (pan) { const v = clsV(), r = clsCanvas().getBoundingClientRect();
      v.x = pan.x - (e.clientX - pan.cx) / r.width * BW / v.z; v.y = pan.y - (e.clientY - pan.cy) / r.height * BH / v.z; clsClampV(v); clsDraw(); return clsViewSend(); }
    const s = CLS.cur; if (!s) return; const [x, y] = clsPt(e);
    if (s.erase) return clsErase(x, y);
    if (s.laser) { CLS.laser.push({ x, y, at: Date.now() }); if (Date.now() - CLS.lastSend > 80) { CLS.lastSend = Date.now(); clsSend({ t: 'z', x, y }); } return clsAnimate(); }
    if (s.k === 'p') { const p = s.p; if (Math.hypot(x - p[p.length - 2], y - p[p.length - 1]) < 3) return; p.push(x, y); CLS.pend.push(x, y); }
    else { s.p[2] = x; s.p[3] = y; }
    clsDraw(); clsFlush();
  };
  cv.onpointerup = cv.onpointercancel = e => {
    touches.delete(e.pointerId);
    if (pinch) { if (!touches.size) { pinch = null; clsViewSend(true); } return; }
    if (pan) { pan = null; cv.style.cursor = 'grab'; return clsViewSend(true); }
    const s = CLS.cur; CLS.cur = null; if (!s || s.erase || s.laser) return;
    if (s.k !== 'p' && Math.hypot(s.p[2] - s.p[0], s.p[3] - s.p[1]) < 6) { clsPage().s = clsPage().s.filter(x => x !== s); return clsDraw(); }
    CLS.mine.push(s.id); clsSend({ t: 'e', id: s.id, pg: CLS.board.cur, k: s.k, c: s.c, w: s.w, p: s.p }); clsSave();
  };
}

/* ---------- Reactions ---------- */
function clsFloat(e) {
  const fx = document.getElementById('cls-fx'); if (!fx || !CLS_REACTS.includes(e)) return;
  const el = document.createElement('span'); el.textContent = e; el.style.left = (10 + Math.random() * 80) + '%';
  fx.appendChild(el); setTimeout(() => el.remove(), 2200);
}

/* ---------- Views ---------- */
function clsToolbar() {
  const t = (k, ic, lbl) => `<button class="${CLS.tool === k ? 'on' : ''}" data-act="cls-tool" data-k="${k}" aria-label="${lbl}" title="${lbl}">${ic}</button>`;
  const host = clsHost(), B = CLS.board;
  return `<div class="cls-tools" role="toolbar" aria-label="أدوات السبورة">
    ${host ? '<div class="grp"><button class="doc" data-act="cls-import" aria-label="أضف ملف PDF أو صوراً للشرح عليها">📄 <span>ملف</span></button></div>' : ''}
    <div class="grp">${host ? t('hand', '✋', 'اليد: حرّك الصفحة، وكبّر بإصبعين') : ''}${t('pen', '✏️', 'قلم')}${t('line', '<i class="ln"></i>', 'خط مستقيم')}${t('arrow', '<i class="ar"></i>', 'سهم (متجه)')}${t('erase', '🧽', 'ممحاة')}${host ? t('laser', '<i class="lz"></i>', 'مؤشر ليزر') : ''}</div>
    <div class="grp">${CLS_COLORS.map(c => `<button class="sw ${CLS.color === c ? 'on' : ''}" data-act="cls-color" data-c="${c}" style="--c:${c}" aria-label="لون"></button>`).join('')}</div>
    <div class="grp">${CLS_WIDTHS.map(w => `<button class="wd ${CLS.width === w ? 'on' : ''}" data-act="cls-width" data-w="${w}" aria-label="سماكة ${w}"><i style="width:${w / 2 + 3}px;height:${w / 2 + 3}px"></i></button>`).join('')}</div>
    <div class="grp"><button data-act="cls-undo" aria-label="تراجع">↶</button>${host ? `<button data-act="cls-clear" aria-label="امسح الصفحة">🗑️</button><button class="${B.grid ? 'on' : ''}" data-act="cls-grid" aria-label="ورق مربعات">#</button>` : ''}<button data-act="cls-png" aria-label="احفظ صورة السبورة">⤓</button></div>
  </div>`;
}
function vClass() {
  if (!CLS.code) return `<div class="view push">${navBar()}<div class="live-msg"><div class="em">🧑‍🏫</div><h1>لا يوجد فصل مفتوح</h1><button class="btn primary" data-act="cls-leave">رجوع</button></div></div>`;
  const host = clsHost();
  const top = `<div class="nav"><button class="circle" data-act="${host ? 'cls-endsheet' : 'cls-leave'}" aria-label="خروج">${icon('back')}</button>
    <span class="cls-h"><b>${host ? 'فصلك المباشر' : 'الفصل المباشر'}</b><small id="cls-st"></small></span>
    ${host ? `<span class="cls-code" aria-label="رمز الفصل">${CLS.code}</span>` : '<span style="width:42px"></span>'}</div>`;
  if (CLS.ended) return `<div class="view push">${top}<div class="live-msg"><div class="em">👋</div><h1>انتهى الفصل</h1><p>شكراً لمشاركتك! يمكنك حفظ صورة السبورة قبل الخروج.</p>
    <div class="cls-board"><canvas id="cls-cv"></canvas><canvas id="cls-ov"></canvas></div>
    <div class="ed-row" style="margin-top:14px"><button class="btn" data-act="cls-png" style="margin-top:0">⤓ احفظ السبورة</button><button class="btn primary" data-act="cls-leave" style="margin-top:0">رجوع</button></div></div></div>`;
  return `<div class="view push cls">${top}
    <div class="cls-stage ${CLS.full ? 'full' : ''}">
      <div class="cls-board"><canvas id="cls-cv" ${clsCanDraw() ? 'style="touch-action:none"' : ''}></canvas><canvas id="cls-ov"></canvas><div class="cls-fx" id="cls-fx" aria-hidden="true"></div>
        <div class="cls-bar" id="cls-bar"></div>
        ${host ? `<div class="cls-zoom"><button data-act="cls-zoom" data-d="1" aria-label="تكبير">+</button><button id="cls-zl" data-act="cls-zoom" data-d="0" aria-label="رجوع للحجم الأصلي">100%</button><button data-act="cls-zoom" data-d="-1" aria-label="تصغير">−</button></div>` : ''}
        <button class="cls-fs" data-act="cls-full" aria-label="${CLS.full ? 'تصغير' : 'ملء الشاشة'}">${CLS.full ? '✕' : '⛶'}</button>${clsCanDraw() ? '' : '<button class="cls-fs sv" data-act="cls-png" aria-label="احفظ صورة السبورة">⤓</button>'}</div>
      ${clsCanDraw() ? clsToolbar() : ''}
    </div>
    ${!host && clsCanDraw() ? '<div class="cls-pen">✏️ معك القلم الآن، اكتب على السبورة</div>' : ''}
    <div id="cls-side"></div>
  </div>`;
}
function clsBar() {
  const el = document.getElementById('cls-bar'); if (!el || !CLS.board) return;
  const B = CLS.board, n = B.pages.length;
  el.innerHTML = clsHost()
    ? `<button data-act="cls-page" data-d="-1" ${B.cur ? '' : 'disabled'} aria-label="الصفحة السابقة">›</button><span>${B.cur + 1} / ${n}</span><button data-act="cls-page" data-d="1" aria-label="${B.cur + 1 < n ? 'الصفحة التالية' : 'صفحة جديدة'}">${B.cur + 1 < n ? '‹' : '+'}</button>`
    : `<span>صفحة ${B.cur + 1} من ${n}</span>`;
}
function clsPollCard(host) {
  const P = CLS.poll; if (!P) return '';
  const opts = P.k === 'tf' ? ['صح', 'خطأ'] : ['أ', 'ب', 'ج', 'د'];
  const counts = P.res || opts.map((_, i) => Object.values(CLS.votes).filter(v => v === i).length), tot = counts.reduce((a, b) => a + b, 0) || 1;
  const bars = `<div class="cls-bars">${opts.map((o, i) => `<div><b>${o}</b><span><i style="width:${Math.round(counts[i] / tot * 100)}%"></i></span><small>${counts[i]}</small></div>`).join('')}</div>`;
  if (host) return `<div class="cls-poll"><b>${P.open ? `التصويت مفتوح · ${Object.keys(CLS.votes).length} من ${CLS.members.length} صوّتوا` : 'النتيجة معروضة للطلاب'}</b>${bars}
    <div class="ed-row">${P.open ? '<button class="btn primary" data-act="cls-pollshow" style="margin-top:0">أغلق واعرض النتيجة</button>' : ''}<button class="btn" data-act="cls-pollend" style="margin-top:0">${P.open ? 'إلغاء' : 'إخفاء'}</button></div></div>`;
  if (!P.open) return `<div class="cls-poll"><b>نتيجة التصويت</b>${bars}</div>`;
  return `<div class="cls-poll"><b>📊 صوّت الآن: اختر إجابتك عن سؤال المعلم</b><div class="cls-vote">${opts.map((o, i) => `<button class="${P.mine === i ? 'on' : ''}" data-act="cls-vote" data-i="${i}">${o}</button>`).join('')}</div></div>`;
}
function clsSide() {
  const el = document.getElementById('cls-side'), st = document.getElementById('cls-st');
  if (st) st.innerHTML = CLS.status === 'ok' ? `<i class="cls-dot"></i> مباشر · ${CLS.members.length} ${CLS.members.length === 1 ? 'طالب' : 'طلاب'}` : CLS.status === 'err' ? 'غير متصل' : 'جارٍ الاتصال…';
  clsBar();
  if (!el) return;
  if (CLS.status === 'err') { el.innerHTML = `<div class="cls-err">⚠️ ${esc(CLS.err)}</div>`; return; }
  if (!clsHost()) {
    el.innerHTML = `${clsPollCard(false)}
      <div class="cls-me">
        <button class="cls-hand ${CLS.myHand ? 'on' : ''}" data-act="cls-hand">✋ <span>${CLS.myHand ? 'أنزل يدي' : 'ارفع يدي'}</span></button>
        <button class="cls-ask" data-act="cls-ask">❓ <span>اسأل المعلم</span></button>
      </div>
      <div class="cls-reacts">${CLS_REACTS.map(e => `<button data-act="cls-react" data-e="${e}" aria-label="تفاعل ${e}">${e}</button>`).join('')}</div>`;
    return;
  }
  const hands = CLS.members.filter(m => m.hand).sort((a, b) => a.hand - b.hand), qn = CLS.questions.length;
  const tabs = [['people', `الطلاب (${CLS.members.length})${hands.length ? ` · ✋${hands.length}` : ''}`], ['qs', `الأسئلة${qn ? ` (${qn})` : ''}`], ['poll', 'تصويت']];
  let body = '';
  if (CLS.tab === 'people') {
    const list = [...hands, ...CLS.members.filter(m => !m.hand).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'))];
    body = list.length ? `<div class="cls-people">${list.map(m => `<div class="${m.hand ? 'hand' : ''}"><span class="nm">${m.hand ? '✋ ' : ''}${esc(m.name || 'طالب')}</span>
      ${CLS.pen === m.id ? '<button class="pen on" data-act="cls-pen" data-u="">✏️ استرجع القلم</button>' : `<button class="pen" data-act="cls-pen" data-u="${esc(m.id)}">أعطه القلم</button>`}
      ${m.hand ? `<button class="dn" data-act="cls-lower" data-u="${esc(m.id)}" aria-label="أنزل يده">✓</button>` : ''}</div>`).join('')}</div>`
      : `<div class="cls-empty">اطلب من طلاب ${esc(G().name)} فتح التطبيق، وسيظهر لهم زر «الفصل المباشر مفتوح الآن» في الصفحة الرئيسية. أو يكتبوا الرمز <b>${CLS.code}</b>.</div>`;
  } else if (CLS.tab === 'qs') {
    body = qn ? `<div class="cls-qs">${CLS.questions.map(q => `<div><b>${esc(q.name)}</b><p>${esc(q.text)}</p><button data-act="cls-qdone" data-id="${esc(q.id)}" aria-label="تمت الإجابة">✓</button></div>`).join('')}</div>` : '<div class="cls-empty">أسئلة الطلاب تظهر هنا، ولا يراها إلا أنت.</div>';
  } else {
    body = CLS.poll ? clsPollCard(true) : `<div class="cls-empty">اكتب السؤال على السبورة أو اسأله شفهياً، ثم افتح التصويت ليجيب الطلاب من جوالاتهم.</div>
      <div class="ed-row"><button class="btn primary" data-act="cls-poll" data-k="abcd" style="margin-top:0">أ / ب / ج / د</button><button class="btn primary" data-act="cls-poll" data-k="tf" style="margin-top:0">صح / خطأ</button></div>
      <button class="btn wide" data-act="live-new" style="width:100%">🎮 مسابقة من نماذج «اختبر نفسك»</button>`;
  }
  el.innerHTML = `<div class="seg cls-tabs">${tabs.map(([k, t]) => `<button aria-pressed="${CLS.tab === k}" data-act="cls-tab" data-k="${k}">${t}</button>`).join('')}</div>${body}`;
}
function clsAfterRender() { clsMount(); clsSide(); }

/* ---------- Actions ---------- */
function clsAct(act, el) {
  const d = el.dataset;
  if (act === 'cls-new') clsCreate();
  else if (act === 'cls-rehost') clsJoin(d.code, true);
  else if (act === 'cls-join') clsJoin(d.code, false);
  else if (act === 'cls-leave') clsLeave();
  else if (act === 'cls-endsheet') sheet(`<h2>الخروج من الفصل</h2><p>يمكنك الرجوع للصفحة الرئيسية ويبقى الفصل مفتوحاً للطلاب، أو إنهاؤه للجميع.</p>
      <button class="btn wide" data-act="cls-away">رجوع والفصل يبقى مفتوحاً</button><button class="btn primary wide" data-act="cls-end">إنهاء الفصل للجميع</button>`);
  else if (act === 'cls-away') { closeSheet(); S.stack = S.stack.filter(t => t.type !== 'class'); render(); }
  else if (act === 'cls-end') { closeSheet(); clsEnd(); }
  else if (act === 'cls-tool') { CLS.tool = d.k; clsToolsRefresh(); }
  else if (act === 'cls-color') { CLS.color = d.c; if (CLS.tool === 'erase' || CLS.tool === 'laser') CLS.tool = 'pen'; clsToolsRefresh(); }
  else if (act === 'cls-width') { CLS.width = +d.w; clsToolsRefresh(); }
  else if (act === 'cls-undo') {
    const pg = clsPage(); let id; while ((id = CLS.mine.pop()) && !pg.s.some(s => s.id === id));
    if (!id) return; pg.s = pg.s.filter(s => s.id !== id); clsSend({ t: 'd', pg: CLS.board.cur, ids: [id] }); clsSave(); clsDraw();
  }
  else if (act === 'cls-clear') {
    if (!el.dataset.confirm) { el.dataset.confirm = '1'; el.textContent = 'تأكيد؟'; return setTimeout(() => { delete el.dataset.confirm; el.textContent = '🗑️'; }, 2500); }
    clsPage().s = []; clsSend({ t: 'c', pg: CLS.board.cur }); clsSave(); clsDraw(); clsToolsRefresh();
  }
  else if (act === 'cls-grid') { CLS.board.grid = !CLS.board.grid; clsSend({ t: 'g', on: CLS.board.grid }); clsSave(); clsDraw(); clsToolsRefresh(); }
  else if (act === 'cls-page') {
    const B = CLS.board, to = B.cur + +d.d; if (to < 0) return;
    if (to >= B.pages.length) B.pages.push({ s: [] });
    B.cur = to; CLS.mine = []; clsSend({ t: 'pg', cur: B.cur, n: B.pages.length }); clsSave(); clsDraw(); clsBar();
  }
  else if (act === 'cls-full') { CLS.full = !CLS.full; document.body.classList.toggle('cls-lock', CLS.full); render(false); }
  else if (act === 'cls-png') clsPng();
  else if (act === 'cls-import') clsImport();
  else if (act === 'cls-zoom') { const v = clsV();
    if (+d.d === 0) { Object.assign(v, { z: 1, x: 0, y: 0 }); clsDraw(); clsViewSend(true); }
    else clsZoomAt(BW / 2, BH / 2, v.z * (+d.d > 0 ? 1.4 : 1 / 1.4)); }
  else if (act === 'cls-tab') { CLS.tab = d.k; clsSide(); }
  else if (act === 'cls-pen') clsGivePen(d.u || null);
  else if (act === 'cls-lower') clsIn({ t: 'lower', uid: d.u });
  else if (act === 'cls-qdone') { CLS.questions = CLS.questions.filter(q => q.id !== d.id); clsSide(); }
  else if (act === 'cls-poll') { CLS.votes = {}; CLS.poll = { id: clsRid(), k: d.k, open: true }; clsSend({ t: 'poll', poll: CLS.poll }); clsSide(); }
  else if (act === 'cls-pollshow') {
    const P = CLS.poll, n = P.k === 'tf' ? 2 : 4; P.open = false; P.res = [...Array(n)].map((_, i) => Object.values(CLS.votes).filter(v => v === i).length);
    clsSend({ t: 'poll', poll: P }); clsSide();
  }
  else if (act === 'cls-pollend') { CLS.poll = null; CLS.votes = {}; clsSend({ t: 'poll', poll: null }); clsSide(); }
  else if (act === 'cls-vote') {
    const P = CLS.poll; if (!P || !P.open) return; P.mine = +d.i; clsIn({ t: 'v', id: P.id, uid: USER.id, pick: +d.i }); clsSide();
  }
  else if (act === 'cls-hand') { CLS.myHand = !CLS.myHand; clsTrack(); clsSide(); if (CLS.myHand) toast('رفعت يدك ✋ سيراك المعلم'); }
  else if (act === 'cls-ask') sheet(`<h2>اسأل المعلم</h2><p>يصل سؤالك إلى المعلم فقط.</p>
      <div class="field" style="margin-top:14px"><textarea id="cls-q" maxlength="200" rows="3" placeholder="اكتب سؤالك…" style="width:100%;padding:12px 14px;border-radius:14px;border:1px solid var(--line);background:var(--surface-2);color:var(--fg);font:inherit;font-size:16px;resize:none"></textarea></div>
      <button class="btn primary wide" data-act="cls-asksend">أرسل السؤال</button>`);
  else if (act === 'cls-asksend') {
    const t = (document.getElementById('cls-q').value || '').trim(); if (!t) return toast('اكتب سؤالك أولاً');
    clsIn({ t: 'q', id: clsRid(), name: clsName(), text: t.slice(0, 200) }); closeSheet(); toast('أُرسل سؤالك إلى المعلم');
  }
  else if (act === 'cls-react') {
    if (Date.now() - CLS.reactAt < 800) return; CLS.reactAt = Date.now();
    clsIn({ t: 'r', e: d.e }); clsFloat(d.e);
  }
}
function clsToolsRefresh() { const t = document.querySelector('.cls-tools'); if (t) t.outerHTML = clsToolbar(); const cv = clsCanvas(); if (cv) cv.style.cursor = CLS.tool === 'hand' ? 'grab' : 'crosshair'; }
async function clsGivePen(uid) {
  const { error } = await db.from('class_rooms').update({ pen: uid }).eq('code', CLS.code);
  if (error) return toast(dbError(error));
  CLS.pen = uid; clsSend({ t: 'pen' }); clsSide();
  const m = CLS.members.find(x => x.id === uid); toast(uid ? `أعطيت القلم إلى ${m ? m.name : 'الطالب'}` : 'استرجعت القلم');
}
function clsPng() {
  const cv = clsCanvas(); if (!cv) return;
  cv.toBlob(async b => {
    const f = new File([b], 'سبورة-الفصل.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f] }); } catch (e) {} return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, 'image/png');
}

/* ---------- Files on the board: PDF pages become board pages; photos are wrapped into a PDF first ---------- */
let PDFJS = null; const CLS_DOCS = {}, CLS_BG = {};
function clsPdfLib() {
  return PDFJS || (PDFJS = new Promise((ok, no) => {
    const sc = document.createElement('script'); sc.src = 'vendor/pdfjs/pdf.min.js';
    sc.onload = () => { pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js'; ok(pdfjsLib); };
    sc.onerror = () => { PDFJS = null; no(new Error('pdf.js')); }; document.head.appendChild(sc);
  }));
}
const clsDoc = (u, data) => CLS_DOCS[u] || (CLS_DOCS[u] = clsPdfLib().then(L => L.getDocument(data ? { data } : { url: u }).promise).catch(e => { delete CLS_DOCS[u]; throw e; }));
/* Rendered page images, kept for the few pages around the current one */
function clsBg(bg, tier = 0) {
  const k = bg.u + '#' + bg.n + (tier ? '@hi' : ''), e = CLS_BG[k];
  if (e) { e.at = Date.now(); return e.cv || null; }
  const ent = CLS_BG[k] = { at: Date.now() };
  clsDoc(bg.u).then(d => d.getPage(bg.n)).then(pg => {
    const v = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: Math.min(2200 / v.width, 1400 / v.height) * (tier ? 1.8 : 1) });
    const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
    return pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise.then(() => {
      ent.cv = cv; const ks = Object.keys(CLS_BG).sort((a, b) => CLS_BG[a].at - CLS_BG[b].at);
      while (ks.length > 6) delete CLS_BG[ks.shift()];
      const hi = ks.filter(x => x.endsWith('@hi')); while (hi.length > 2) delete CLS_BG[hi.shift()];
      clsDraw();
    });
  }).catch(() => { ent.err = true; setTimeout(() => { if (CLS_BG[k] === ent) delete CLS_BG[k]; }, 8000); clsDraw(); });
  return null;
}
function clsImport() {
  const i = document.createElement('input'); i.type = 'file'; i.multiple = true;
  i.accept = 'application/pdf,.pdf,image/*,.ppt,.pptx,.pps,.ppsx,.key,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation';
  i.onchange = () => clsImportFiles([...i.files]); i.click();
}
function clsPptHelp() {
  sheet(`<h2>عرض PowerPoint</h2><p>المتصفح لا يستطيع فتح ملفات العروض مباشرة، فاحفظ العرض كملف PDF أولاً ثم أضفه. ستظهر كل شريحة صفحةً على السبورة.</p>
    <div class="cls-help">
      <div><b>📱 PowerPoint على الآيفون أو الآيباد</b><span>افتح العرض ← زر «…» أو «ملف» ← «تصدير» ← PDF ← احفظه في «الملفات».</span></div>
      <div><b>💻 PowerPoint على الكمبيوتر</b><span>ملف ← حفظ باسم ← اختر نوع الملف PDF.</span></div>
      <div><b>🍎 Keynote</b><span>زر المشاركة ← تصدير ← PDF.</span></div>
    </div>
    <button class="btn primary wide" data-act="cls-import">اختر ملف PDF</button>`);
}
async function clsImportFiles(files) {
  closeSheet(); if (!files.length) return;
  if (files.some(f => /\.(pptx?|ppsx?|key)$/i.test(f.name) || /presentation|powerpoint|keynote/i.test(f.type))) return clsPptHelp();
  const pdf = files.find(f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)), imgs = files.filter(f => /^image\//.test(f.type));
  if (!pdf && !imgs.length) return toast('اختر ملف PDF أو صوراً');
  if (pdf && pdf.size > 50 * 1024 * 1024) return toast('حجم الملف أكبر من 50 ميغابايت');
  toast('جارٍ تجهيز الملف…');
  let blob; try { blob = pdf || await clsImagesPdf(imgs.slice(0, 30)); } catch (e) { return toast('تعذّر قراءة الصورة'); }
  const data = new Uint8Array(await blob.arrayBuffer()), path = `board/${CLS.code}-${Date.now()}.pdf`;
  const { error } = await db.storage.from('notes').upload(path, blob, { contentType: 'application/pdf', upsert: false });
  if (error) return toast(dbError(error));
  const u = db.storage.from('notes').getPublicUrl(path).data.publicUrl;
  let n; try { n = Math.min(60, (await clsDoc(u, data.slice())).numPages); } catch (e) { return toast('تعذّر فتح ملف PDF'); }
  const B = CLS.board, keep = clsPage().s.length || clsPage().bg, at = B.cur + (keep ? 1 : 0);
  B.pages.splice(at, keep ? 0 : 1, ...[...Array(n)].map((_, i) => ({ s: [], bg: { u, n: i + 1 } })));
  B.cur = at; CLS.mine = []; if (CLS.color === CLS_COLORS[0]) CLS.color = '#FF3B30'; if (CLS.tool === 'erase') CLS.tool = 'pen';
  clsSend({ t: 'st', board: clsBoardJson() }); clsSave(); render(false);
  toast(n === 1 ? 'أُضيفت صفحة إلى السبورة' : `أُضيفت ${n} صفحات إلى السبورة`);
}
async function clsImagesPdf(files) {
  const out = [];
  for (const f of files) {
    const im = await new Promise((ok, no) => { const x = new Image(); x.onload = () => ok(x); x.onerror = no; x.src = URL.createObjectURL(f); });
    const k = Math.min(1, 2000 / Math.max(im.naturalWidth, im.naturalHeight)), w = Math.max(1, Math.round(im.naturalWidth * k)), h = Math.max(1, Math.round(im.naturalHeight * k));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.drawImage(im, 0, 0, w, h); URL.revokeObjectURL(im.src);
    const jpg = new Uint8Array(await (await new Promise(ok => cv.toBlob(ok, 'image/jpeg', .85))).arrayBuffer());
    out.push({ w, h, jpg });
  }
  return clsPdfFromJpegs(out);
}
/* A minimal PDF with one full-page JPEG per page */
function clsPdfFromJpegs(imgs) {
  const enc = new TextEncoder(), parts = [], offs = []; let len = 0;
  const put = x => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (n, body) => { offs[n] = len; put(`${n} 0 obj\n`); body(); put('\nendobj\n'); };
  put('%PDF-1.4\n');
  obj(1, () => put('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => put(`<< /Type /Pages /Kids [${imgs.map((_, i) => `${3 + 3 * i} 0 R`).join(' ')}] /Count ${imgs.length} >>`));
  imgs.forEach((m, i) => {
    const p = 3 + 3 * i, cs = `q ${m.w} 0 0 ${m.h} 0 0 cm /Im0 Do Q`;
    obj(p, () => put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${m.w} ${m.h}] /Resources << /XObject << /Im0 ${p + 1} 0 R >> >> /Contents ${p + 2} 0 R >>`));
    obj(p + 1, () => { put(`<< /Type /XObject /Subtype /Image /Width ${m.w} /Height ${m.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${m.jpg.length} >>\nstream\n`); put(m.jpg); put('\nendstream'); });
    obj(p + 2, () => put(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`));
  });
  const xref = len, n = 3 + 3 * imgs.length;
  put(`xref\n0 ${n}\n0000000000 65535 f \n${offs.slice(1).map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${n} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}
