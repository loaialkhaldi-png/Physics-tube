'use strict';
/* لوحة متابعة المعلم: نشاط الطلاب، من يحتاج متابعة، نجوم الأسبوع، أصعب الأسئلة، إتقان الدروس، أوقات النشاط، وتفاصيل كل طالب.
   Loaded after the main script and the question banks. Uses: db, ADMIN, USER, PROFILE, ADMIN_DATA, S, GRADES, GRADE_ORDER,
   render, sheet, toast, esc, icon, qtext, ring, navBar, lessonTitle, kwDate, ago. Data comes from supabase-teacher.sql. */

/* ---------- Sending the student's bank answers (batched) ---------- */
const TD_Q = [];
let TD_T = 0;
function tdLogAnswer(q, ok) {
  if (!db || !USER || !PROFILE || ADMIN) return;
  TD_Q.push({ q, ok: !!ok });
  clearTimeout(TD_T); TD_T = setTimeout(tdFlush, 4000);
  if (TD_Q.length >= 30) tdFlush();
}
function tdFlush() {
  clearTimeout(TD_T);
  if (!TD_Q.length || !db || !USER) return;
  const batch = TD_Q.splice(0, 60);
  db.rpc('log_answers', { p: batch }).then(() => {}, () => {});
  if (TD_Q.length) TD_T = setTimeout(tdFlush, 1000);
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') tdFlush(); });
addEventListener('pagehide', tdFlush);

/* ---------- Data ---------- */
Object.assign(ADMIN_DATA, { g: 'all', dash: null, sort: 'recent', metric: 'u', needSql: false, allNeed: false, allLess: false });
const TD_BANKS = () => ({ g10: window.BANK_G10, g11: window.BANK_G11, g12: window.BANK_G12 });
const tdPct = (a, b) => b ? Math.round(a / b * 100) : null;
const tdDays = iso => Math.floor((Date.now() - new Date(iso)) / 864e5);

async function loadAdmin() {
  if (!db || !ADMIN) return;
  const d = ADMIN_DATA; d.loading = true; d.error = '';
  const r = await db.rpc('admin_dashboard', { p_grade: d.g === 'all' ? null : d.g });
  if (!r.error && r.data) { d.dash = r.data; d.needSql = false; }
  else {
    // supabase-teacher.sql not run yet: show what the older tables already have
    d.needSql = true;
    const [st, pr] = await Promise.all([
      db.rpc('admin_stats'),
      db.from('profiles').select('id,username,full_name,phone,grade,created_at,last_seen,visits').order('last_seen', { ascending: false }).limit(2000),
    ]);
    if (st.error || pr.error) d.error = 'تعذّر تحميل الإحصائيات. تأكد أنك شغّلت ملف supabase-students.sql في Supabase.';
    const s = st.data || {}, all = (pr.data || []).filter(p => d.g === 'all' || p.grade === d.g);
    d.dash = {
      kpi: { students: all.length, new_7: all.filter(p => tdDays(p.created_at) < 7).length, active_today: all.filter(p => tdDays(p.last_seen) < 1).length,
        active_7: all.filter(p => tdDays(p.last_seen) < 7).length, inactive_7: all.filter(p => tdDays(p.last_seen) >= 7).length, ans_7: null },
      daily: (s.daily || []).map(x => ({ d: x.d, u: x.n, a: 0 })), heat: [], hard: [], lessons: [], top: s.top || [],
      students: all.map(p => Object.assign({ ans_7: 0, ok_7: 0, ans_all: 0, ok_all: 0, mastered: 0, days_7: 0 }, p)),
    };
  }
  d.students = (d.dash && d.dash.students) || [];
  d.loading = false; d.at = Date.now();
  const top = S.stack[S.stack.length - 1];
  if (top && top.type === 'admin') render(false);
}

// "g12:2-1.4" → the question, its lesson and grade, read from the bank files
function tdQuestion(qid) {
  const m = /^(g1[0-2]):([\d-]+)\.(\d+)$/.exec(qid || ''); if (!m) return null;
  for (const c of TD_BANKS()[m[1]] || []) for (const l of c.ls) if (l.id === m[2]) return { q: l.qs[+m[3]], l, grade: m[1] };
  return null;
}
function tdLesson(key) {
  const [g, id] = String(key).split(':');
  for (const c of TD_BANKS()[g] || []) for (const l of c.ls) if (l.id === id) return { t: l.t, g, id };
  return { t: id || key, g, id };
}
function tdAnswer(q) {
  if (!q) return '';
  if (q.k === 'tf') return q.a ? 'صح ✓' : 'خطأ ✗';
  if (q.k === 'num') return `<bdi dir="ltr">${q.n} ${esc(q.u || '')}</bdi>`;
  if (q.k === 'card') return q.a;
  return qtext(q.k === 'mcq' ? q.o[0] : q.a);
}
const tdStrip = h => String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/* ---------- Student status ---------- */
function tdStatus(p) {
  const d = tdDays(p.last_seen);
  if (d < 1) return { k: 'on', t: 'نشط اليوم' };
  if (d < 7) return { k: 'mid', t: `آخر دخول ${ago(p.last_seen)}` };
  return { k: 'off', t: `متوقف منذ ${d} يوماً` };
}
function tdNeeds(list) {
  return list.map(p => {
    const d = tdDays(p.last_seen), acc = tdPct(p.ok_all, p.ans_all);
    const why = [];
    if (d >= 7) why.push(['⏸', `متوقف منذ ${d} يوماً`]);
    if (p.ans_all >= 10 && acc < 50) why.push(['📉', `دقته ${acc}%`]);
    return { p, why, score: (d >= 7 ? d : 0) + (p.ans_all >= 10 && acc < 50 ? 60 - acc : 0) };
  }).filter(x => x.why.length).sort((a, b) => b.score - a.score);
}
function tdWa(p, msg) {
  let n = String(p.phone || '').replace(/\D/g, '');
  if (n.length === 8) n = '965' + n;
  if (n.length < 8) return '';
  return `https://wa.me/${n}?text=${encodeURIComponent(msg)}`;
}
const tdMsgBack = p => `مرحباً ${(p.full_name || '').split(' ')[0]} 👋 افتقدناك في تطبيق Physics Tube! ادخل اليوم وحل ${'10'} أسئلة من بنك الأسئلة لتحافظ على مستواك قبل الاختبار 💪 https://physics-tube.com/`;
const tdMsgStar = p => `أحسنت يا ${(p.full_name || '').split(' ')[0]} 🌟 أداؤك في بنك الأسئلة هذا الأسبوع رائع، استمر! 🏆`;

/* ---------- Charts ---------- */
function tdActivity(daily, metric, unitName) {
  const map = Object.fromEntries((daily || []).map(x => [x.d, x])), days = [];
  for (let i = 29; i >= 0; i--) { const t = new Date(Date.now() - i * 864e5), k = t.toLocaleDateString('en-CA', { timeZone: 'Asia/Kuwait' }); const x = map[k] || {}; days.push([k, +(metric === 'a' ? x.a : x.u) || 0]); }
  const max = Math.max(1, ...days.map(d => d[1])), W = 600, H = 150, bw = W / days.length, unit = metric === 'a' ? 'إجابة' : (unitName || 'طالب');
  const sum = days.reduce((s, d) => s + d[1], 0), last7 = days.slice(-7).reduce((s, d) => s + d[1], 0);
  return { sum, last7, svg: `<svg class="td-chart" viewBox="0 0 ${W} ${H + 22}" role="img" aria-label="النشاط اليومي في آخر 30 يوماً">
    ${[0.5, 1].map(f => `<line x1="0" x2="${W}" y1="${H - f * (H - 14)}" y2="${H - f * (H - 14)}" class="gl"/>`).join('')}
    <line x1="0" y1="${H}" x2="${W}" y2="${H}" class="ax"/>
    ${days.map(([k, n], i) => { const h = n / max * (H - 14); const lab = `${kwDate(k)}: ${n} ${unit}`;
      return `<g class="tip" data-tip="${esc(lab)}"><rect class="hit" x="${i * bw}" y="0" width="${bw}" height="${H}"/><rect class="bar ${i === days.length - 1 ? 'now' : ''}" x="${i * bw + 2}" y="${H - Math.max(h, n ? 3 : 1.5)}" width="${bw - 4}" height="${Math.max(h, n ? 3 : 1.5)}" rx="3"/></g>`; }).join('')}
    <text x="${W}" y="${H + 17}" text-anchor="end" class="lb">اليوم</text>
    <text x="0" y="${H + 17}" text-anchor="start" class="lb">قبل 30 يوماً</text>
    <text x="${W}" y="10" text-anchor="end" class="lb">${max}</text>
  </svg>` };
}
const TD_WD = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const TD_HR = ['من 12 إلى 3 فجراً', 'من 3 إلى 6 صباحاً', 'من 6 إلى 9 صباحاً', 'من 9 إلى 12 ظهراً', 'من 12 إلى 3 عصراً', 'من 3 إلى 6 مساءً', 'من 6 إلى 9 مساءً', 'من 9 إلى 12 ليلاً'];
const TD_HS = [['12', 'ص'], ['3', 'ص'], ['6', 'ص'], ['9', 'ص'], ['12', 'ظ'], ['3', 'م'], ['6', 'م'], ['9', 'م']];
function tdHeat(heat) {
  const m = {}; let max = 0, best = null;
  (heat || []).forEach(x => { m[x.w + '.' + x.h] = x.n; if (x.n > max) { max = x.n; best = x; } });
  if (!max) return '<p class="td-empty">ستظهر هنا أوقات نشاط طلابك بعد أن يبدؤوا باستخدام التطبيق.</p>';
  const order = [6, 0, 1, 2, 3, 4, 5]; // السبت أولاً
  return `<div class="td-heat" role="table" aria-label="أوقات نشاط الطلاب">
    <span></span>${TD_HS.map(([n, t]) => `<span class="hh">${n}<small>${t}</small></span>`).join('')}
    ${order.map(w => `<span class="hw">${TD_WD[w]}</span>${TD_HR.map((h, i) => { const n = m[w + '.' + i] || 0; return `<span class="hc tip" data-tip="${esc(`${TD_WD[w]} ${h}: ${n} نشاط`)}" style="--o:${n ? .14 + .86 * n / max : 0}"></span>`; }).join('')}`).join('')}
  </div>
  <p class="td-note">💡 أفضل وقت لإرسال تذكير لطلابك: <b>${TD_WD[best.w]} ${TD_HR[best.h]}</b></p>`;
}
function tdMini(daily) {
  const map = Object.fromEntries((daily || []).map(x => [x.d, x])), days = [];
  for (let i = 29; i >= 0; i--) { const k = new Date(Date.now() - i * 864e5).toLocaleDateString('en-CA', { timeZone: 'Asia/Kuwait' }); days.push([k, map[k] || { a: 0, ok: 0 }]); }
  const max = Math.max(1, ...days.map(d => d[1].a)), W = 300, H = 70, bw = W / 30;
  return `<svg class="td-chart" viewBox="0 0 ${W} ${H + 4}" role="img" aria-label="إجابات الطالب يومياً">
    <line x1="0" y1="${H}" x2="${W}" y2="${H}" class="ax"/>
    ${days.map(([k, x], i) => { const h = x.a / max * (H - 6); return `<g class="tip" data-tip="${esc(`${kwDate(k)}: ${x.a} إجابة، ${x.ok} صحيحة`)}"><rect class="hit" x="${i * bw}" y="0" width="${bw}" height="${H}"/><rect class="bar" x="${i * bw + 1.5}" y="${H - Math.max(h, x.a ? 3 : 1)}" width="${bw - 3}" height="${Math.max(h, x.a ? 3 : 1)}" rx="2"/></g>`; }).join('')}
  </svg>`;
}

/* ---------- Views ---------- */
function tdKpis(k) {
  const acc = tdPct(k.ok_7, k.ans_7), prev = tdPct(k.ok_p7, k.ans_p7), wk = tdPct(k.active_7, k.students);
  const trend = acc != null && prev != null ? (acc - prev >= 0 ? `▲ ${acc - prev}% عن الأسبوع الماضي` : `▼ ${prev - acc}% عن الأسبوع الماضي`) : k.ans_7 != null ? `${k.ans_7} إجابة هذا الأسبوع` : 'بعد تشغيل ملف الإجابات';
  const tiles = [
    ['👥', 'الطلاب المسجلون', k.students, k.new_7 ? `+${k.new_7} هذا الأسبوع` : 'لا جدد هذا الأسبوع', '#4C86FF'],
    ['⚡', 'نشطون اليوم', k.active_today, `من ${k.students} طالب`, '#FFB020'],
    ['📅', 'نشطون هذا الأسبوع', k.active_7, wk != null ? `${wk}% من طلابك` : '', '#2BD4B0'],
    ['🎯', 'دقة الإجابات (7 أيام)', acc != null ? acc + '%' : '—', trend, '#A866FF'],
  ];
  return `<div class="td-kpis">${tiles.map(([ic, t, n, sub, c]) => `<div class="td-kpi" style="--c:${c}"><span class="ic">${ic}</span><b>${n == null ? '—' : n}</b><span class="t">${t}</span><small>${esc(sub)}</small></div>`).join('')}</div>`;
}
function tdPanel(title, sub, body, cls = '') {
  return `<section class="td-panel ${cls}"><header><h2>${title}</h2>${sub ? `<small>${sub}</small>` : ''}</header>${body}</section>`;
}
function vAdmin() {
  const d = ADMIN_DATA, D = d.dash;
  const chips = [['all', 'كل الصفوف']].concat(GRADE_ORDER.map(g => [g, GRADES[g].short]));
  const head = `<header class="td-hero">
      <div><small>لوحة المعلم</small><h1>متابعة الطلاب</h1><p>${d.loading && !d.at ? 'جارٍ تحميل البيانات…' : d.at ? `آخر تحديث ${new Date(d.at).toLocaleTimeString('ar-KW-u-nu-latn', { hour: 'numeric', minute: '2-digit' })}` : ''}</p></div>
      <button class="td-refresh ${d.loading ? 'spin' : ''}" data-act="admin-refresh" aria-label="تحديث">${icon('replay')}</button>
    </header>
    <div class="td-chips" role="tablist">${chips.map(([g, t]) => `<button role="tab" aria-selected="${d.g === g}" class="${d.g === g ? 'on' : ''}" data-act="td-g" data-g="${g}">${t}</button>`).join('')}</div>
    <button class="td-lb" data-go="visitors">📈 الزوار وما يجذبهم في التطبيق ${icon('chev')}</button>
    <button class="td-lb" data-go="leaders">🏆 لوحة المتصدرين الأسبوعية للطلاب ${icon('chev')}</button>
    ${d.error ? `<p class="td-alert">${d.error}</p>` : ''}
    ${d.needSql && !d.error ? `<p class="td-alert info">📌 لتظهر إجابات الطلاب في بنك الأسئلة وأصعب الأسئلة ونسب الإتقان: شغّل ملف <b>supabase-teacher.sql</b> مرة واحدة في Supabase.</p>` : ''}`;
  if (!D) return `<div class="view push td">${navBar()}${head}<div class="td-kpis">${[0, 1, 2, 3].map(() => '<div class="td-kpi sk"></div>').join('')}</div></div>`;
  const k = D.kpi || {}, st = D.students || [];
  const act = tdActivity(D.daily, d.metric);
  const needs = tdNeeds(st), shownNeeds = d.allNeed ? needs : needs.slice(0, 5);
  const stars = st.filter(p => p.ok_7 > 0).sort((a, b) => b.ok_7 - a.ok_7 || b.days_7 - a.days_7).slice(0, 5);
  const lessons = (D.lessons || []).map(x => Object.assign({ acc: tdPct(x.ok, x.n) }, x)).sort((a, b) => a.acc - b.acc);
  const shownLess = d.allLess ? lessons : lessons.slice(0, 6);
  const medal = ['🥇', '🥈', '🥉', '4', '5'];

  const activity = tdPanel('النشاط اليومي', `${d.metric === 'a' ? `${act.last7} إجابة` : `${Math.round(act.last7 / 7 * 10) / 10} طالب يومياً`} في آخر 7 أيام`,
    `<div class="td-seg" role="tablist"><button class="${d.metric === 'u' ? 'on' : ''}" data-act="td-m" data-m="u">الطلاب النشطون</button><button class="${d.metric === 'a' ? 'on' : ''}" data-act="td-m" data-m="a" ${d.needSql ? 'disabled' : ''}>الأسئلة المجابة</button></div>${act.svg}`, 'wide');
  const needP = tdPanel('⚠️ يحتاجون متابعة', needs.length ? `${needs.length} طالب` : '',
    needs.length ? `<div class="td-list">${shownNeeds.map(({ p, why }) => { const wa = tdWa(p, tdMsgBack(p)); return `<div class="td-row">
      <button class="td-who" data-act="td-st" data-id="${p.id}"><span class="av">${esc((p.full_name || '?').trim()[0] || '?')}</span><span class="t"><b>${esc(p.full_name)}</b><small>${esc((GRADES[p.grade] || {}).short || '')} · ${why.map(w => `<span class="why">${w[0]} ${w[1]}</span>`).join(' ')}</small></span></button>
      ${wa ? `<a class="td-wa" href="${wa}" target="_blank" rel="noopener" aria-label="راسله على واتساب">💬 شجّعه</a>` : ''}</div>`; }).join('')}</div>
      ${needs.length > 5 ? `<button class="td-more" data-act="td-allneed">${d.allNeed ? 'عرض أقل' : `عرض الكل (${needs.length})`}</button>` : ''}`
      : '<p class="td-empty">🎉 لا يوجد طالب متوقف أو متراجع الآن.</p>');
  const starP = tdPanel('🏆 نجوم الأسبوع', 'الأكثر إجابات صحيحة في 7 أيام',
    stars.length ? `<div class="td-list">${stars.map((p, i) => { const wa = tdWa(p, tdMsgStar(p)); return `<div class="td-row">
      <button class="td-who" data-act="td-st" data-id="${p.id}"><span class="av medal">${medal[i]}</span><span class="t"><b>${esc(p.full_name)}</b><small>${p.ok_7} إجابة صحيحة · ${p.days_7} ${p.days_7 === 1 ? 'يوم' : 'أيام'} نشاط · دقة ${tdPct(p.ok_7, p.ans_7)}%</small></span></button>
      ${wa ? `<a class="td-wa" href="${wa}" target="_blank" rel="noopener" aria-label="هنّئه على واتساب">👏 هنّئه</a>` : ''}</div>`; }).join('')}</div>`
      : `<p class="td-empty">${d.needSql ? 'تظهر النجوم بعد تشغيل ملف الإجابات.' : 'لم يحل أي طالب أسئلة هذا الأسبوع بعد.'}</p>`);
  const hardP = tdPanel('🧩 أصعب الأسئلة', 'أعد شرحها في الحصة',
    (D.hard || []).length ? `<div class="td-hard">${D.hard.map(h => { const r = tdQuestion(h.qid); if (!r || !r.q) return ''; return `<details>
      <summary><span class="rate"><b>${h.rate}%</b><small>أخطأوا</small></span><span class="t"><span class="qtx">${qtext(r.q.q)}</span><small>${esc(GRADES[r.grade].short)} · الدرس (${r.l.id}) ${esc(r.l.t)} · ${h.wrong} من ${h.n}</small></span></summary>
      <div class="ans">${r.q.img ? `<img src="${r.q.img}" alt="" loading="lazy">` : ''}<p><small>الإجابة الصحيحة</small>${tdAnswer(r.q)}</p></div></details>`; }).join('')}</div>`
      : `<p class="td-empty">${d.needSql ? 'تظهر بعد تشغيل ملف الإجابات.' : 'تظهر هنا الأسئلة التي يخطئ فيها أكثر الطلاب (بعد 3 إجابات على الأقل).'}</p>`);
  const lessP = tdPanel('📚 الدقة في كل درس', 'الأضعف أولاً',
    lessons.length ? `<div class="td-bars">${shownLess.map(x => { const L = tdLesson(x.lesson); return `<div class="tip" data-tip="${esc(`${x.n} إجابة من ${x.u} طالب`)}"><span class="t"><b>${esc(L.t)}</b><small>${esc((GRADES[L.g] || {}).short || '')} · (${esc(L.id)})</small></span><span class="trk"><i style="width:${x.acc}%"></i></span><b class="v">${x.acc}%</b></div>`; }).join('')}</div>
      ${lessons.length > 6 ? `<button class="td-more" data-act="td-allless">${d.allLess ? 'عرض أقل' : `كل الدروس (${lessons.length})`}</button>` : ''}`
      : `<p class="td-empty">${d.needSql ? 'تظهر بعد تشغيل ملف الإجابات.' : 'لا توجد إجابات بعد.'}</p>`);
  const heatP = tdPanel('🕒 متى يدرس طلابك؟', 'آخر 30 يوماً بتوقيت الكويت', tdHeat(D.heat));
  const topP = tdPanel('🎬 أكثر الدروس مشاهدة', '',
    (D.top || []).length ? `<div class="td-list">${D.top.map((x, i) => { const lt = lessonTitle(x.ref); return `<div class="td-row"><span class="td-who"><span class="av num">${i + 1}</span><span class="t"><b>${esc(lt.t)}</b><small>${esc(lt.sub)}</small></span></span><span class="td-n"><b>${x.n}</b><small>${x.u} طالب</small></span></div>`; }).join('')}</div>` : '<p class="td-empty">لا توجد مشاهدات بعد.</p>');

  const sorts = [['recent', 'آخر دخول'], ['active', 'الأكثر نشاطاً'], ['weak', 'الأقل دقة'], ['name', 'الاسم']];
  return `<div class="view push td">${navBar()}${head}
    ${tdKpis(k)}
    <div class="td-grid">${activity}${needP}${starP}${hardP}${lessP}${heatP}${topP}</div>
    <section class="td-panel wide td-students"><header><h2>الطلاب</h2><small>${st.length} طالب</small><button class="td-csv" data-act="td-csv">⬇︎ تصدير Excel</button></header>
      <div class="field"><input id="st-search" type="search" placeholder="ابحث بالاسم أو اسم المستخدم أو الجوال" value="${esc(d.q)}" aria-label="بحث عن طالب"></div>
      <div class="td-chips small">${sorts.map(([s, t]) => `<button class="${d.sort === s ? 'on' : ''}" data-act="td-sort" data-s="${s}">${t}</button>`).join('')}</div>
      <div class="td-list" id="st-list">${studentRows()}</div>
    </section>
  </div>`;
}
function studentRows() {
  const d = ADMIN_DATA, q = d.q.trim().toLowerCase();
  let list = (d.students || []).filter(p => !q || [p.full_name, p.username, p.phone].some(v => String(v || '').toLowerCase().includes(q)));
  const acc = p => p.ans_all ? p.ok_all / p.ans_all : 2;
  if (d.sort === 'active') list = list.slice().sort((a, b) => b.ans_7 - a.ans_7 || b.days_7 - a.days_7);
  else if (d.sort === 'weak') list = list.slice().sort((a, b) => acc(a) - acc(b));
  else if (d.sort === 'name') list = list.slice().sort((a, b) => String(a.full_name).localeCompare(String(b.full_name), 'ar'));
  else list = list.slice().sort((a, b) => new Date(b.last_seen) - new Date(a.last_seen));
  if (!list.length) return `<p class="td-empty">${(d.students || []).length ? 'لا يوجد طالب بهذا الاسم.' : 'لم يسجّل أي طالب بعد. شارك رابط التطبيق مع طلابك.'}</p>`;
  return list.slice(0, 300).map(p => { const s = tdStatus(p), a = tdPct(p.ok_all, p.ans_all); return `<button class="td-row td-who st" data-act="td-st" data-id="${p.id}">
    <span class="av">${esc((p.full_name || '?').trim()[0] || '?')}</span>
    <span class="t"><b>${esc(p.full_name)}</b><small><span dir="ltr">@${esc(p.username)}</span> · ${esc((GRADES[p.grade] || {}).short || p.grade)}</small><small class="stt ${s.k}"><i></i>${s.t}</small></span>
    <span class="td-n"><b>${p.ans_7}</b><small>إجابة/أسبوع</small></span>
    <span class="td-n"><b>${a == null ? '—' : a + '%'}</b><small>الدقة</small></span>
  </button>`; }).join('') + (list.length > 300 ? '<p class="td-empty">يظهر أول 300 طالب. استخدم البحث للوصول إلى البقية.</p>' : '');
}

/* ---------- Student sheet ---------- */
async function tdStudent(id) {
  const p = (ADMIN_DATA.students || []).find(x => x.id === id); if (!p) return;
  const s = tdStatus(p), wa = tdWa(p, tdMsgBack(p)), acc = tdPct(p.ok_all, p.ans_all);
  const tiles = [['إجابات هذا الأسبوع', p.ans_7], ['الدقة الكلية', acc == null ? '—' : acc + '%'], ['أسئلة أتقنها', p.mastered], ['أيام نشاط (7 أيام)', p.days_7], ['مرات الدخول', p.visits], ['سجّل في', kwDate(p.created_at)]];
  const base = `<div class="td-sh">
    <header><span class="av big">${esc((p.full_name || '?').trim()[0] || '?')}</span><div><h2>${esc(p.full_name)}</h2><small><span dir="ltr">@${esc(p.username)}</span> · ${esc((GRADES[p.grade] || {}).name || '')}</small><small class="stt ${s.k}"><i></i>${s.t}</small></div></header>
    <div class="td-acts">${p.phone ? `<a class="btn" href="tel:${esc(p.phone)}">📞 <bdi dir="ltr">${esc(p.phone)}</bdi></a>` : ''}${wa ? `<a class="btn primary" href="${wa}" target="_blank" rel="noopener">💬 واتساب</a>` : ''}</div>
    <button class="btn wide td-certbtn" data-act="td-cert" data-id="${p.id}">🎖️ إصدار شهادة تقدير</button>
    <div class="td-mini">${tiles.map(([t, n]) => `<div><b>${n}</b><small>${t}</small></div>`).join('')}</div>
    <div id="td-sh-more">${ADMIN_DATA.needSql ? '' : '<p class="td-empty">جارٍ تحميل التفاصيل…</p>'}</div>
  </div>`;
  sheet(base, 'td-sheet');
  if (ADMIN_DATA.needSql) return;
  const r = await db.rpc('admin_student', { p_user: id });
  const box = document.getElementById('td-sh-more'); if (!box) return;
  if (r.error || !r.data) { box.innerHTML = '<p class="td-empty">تعذّر تحميل التفاصيل.</p>'; return; }
  const D = r.data, less = (D.lessons || []).map(x => Object.assign({ acc: tdPct(x.ok, x.n) }, x)).sort((a, b) => a.acc - b.acc);
  box.innerHTML = `<h3>نشاطه في آخر 30 يوماً</h3>${tdMini(D.daily)}
    ${less.length ? `<h3>دقته في الدروس</h3><div class="td-bars">${less.map(x => { const L = tdLesson(x.lesson); return `<div><span class="t"><b>${esc(L.t)}</b><small>(${esc(L.id)}) · ${x.n} إجابة</small></span><span class="trk"><i style="width:${x.acc}%"></i></span><b class="v">${x.acc}%</b></div>`; }).join('')}</div>` : ''}
    <h3>أسئلة ما زال يخطئ فيها</h3>${(D.wrong || []).length ? `<div class="td-hard">${D.wrong.map(w => { const q = tdQuestion(w.qid); return q && q.q ? `<details><summary><span class="rate"><b>${w.n}×</b><small>خطأ</small></span><span class="t"><span class="qtx">${qtext(q.q.q)}</span><small>الدرس (${q.l.id}) ${esc(q.l.t)}</small></span></summary><div class="ans"><p><small>الإجابة الصحيحة</small>${tdAnswer(q.q)}</p></div></details>` : ''; }).join('')}</div>` : '<p class="td-empty">لا توجد أخطاء معلّقة 👏</p>'}`;
}

/* ---------- Export ---------- */
function tdCsv() {
  const rows = [['الاسم', 'اسم المستخدم', 'الجوال', 'الصف', 'تاريخ التسجيل', 'آخر دخول', 'مرات الدخول', 'إجابات آخر 7 أيام', 'الصحيحة آخر 7 أيام', 'كل الإجابات', 'الدقة %', 'أسئلة متقنة', 'أيام النشاط (7 أيام)']];
  (ADMIN_DATA.students || []).forEach(p => rows.push([p.full_name, p.username, p.phone, (GRADES[p.grade] || {}).short || p.grade, kwDate(p.created_at), new Date(p.last_seen).toLocaleDateString('en-CA'), p.visits, p.ans_7, p.ok_7, p.ans_all, tdPct(p.ok_all, p.ans_all) ?? '', p.mastered, p.days_7]));
  const csv = '﻿' + rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `physics-tube-students-${new Date().toLocaleDateString('en-CA')}.csv`; document.body.appendChild(a); a.click(); a.remove();
  toast('تم تنزيل الملف، افتحه في Excel');
}

/* ---------- Actions & tooltip ---------- */
function tdAct(act, el) {
  const d = ADMIN_DATA;
  if (act === 'td-g') { if (d.g === el.dataset.g) return; d.g = el.dataset.g; d.dash = null; d.at = 0; render(false); }
  else if (act === 'td-m') { d.metric = el.dataset.m; render(false); }
  else if (act === 'td-sort') { d.sort = el.dataset.s; document.querySelectorAll('[data-act="td-sort"]').forEach(b => b.classList.toggle('on', b === el)); const box = document.getElementById('st-list'); if (box) box.innerHTML = studentRows(); }
  else if (act === 'td-allneed') { d.allNeed = !d.allNeed; render(false); }
  else if (act === 'td-allless') { d.allLess = !d.allLess; render(false); }
  else if (act === 'td-st') tdStudent(el.dataset.id);
  else if (act === 'td-csv') tdCsv();
  else if (act === 'td-cert') { const p = (ADMIN_DATA.students || []).find(x => x.id === el.dataset.id); if (p && typeof certTeacher === 'function') certTeacher(p); }
}
(function tdTips() {
  let tip = null;
  const hide = () => { if (tip) tip.style.opacity = 0; };
  document.addEventListener('pointerover', e => {
    const t = e.target.closest && e.target.closest('.td .tip, .td-sheet .tip'); if (!t) return hide();
    if (!tip) { tip = document.createElement('div'); tip.className = 'td-tip'; document.body.appendChild(tip); }
    tip.textContent = t.dataset.tip; const r = t.getBoundingClientRect();
    tip.style.opacity = 1; tip.style.left = Math.min(innerWidth - 8, Math.max(8, r.left + r.width / 2)) + 'px'; tip.style.top = Math.max(8, r.top - 8) + 'px';
  });
  addEventListener('scroll', hide, { passive: true });
})();
