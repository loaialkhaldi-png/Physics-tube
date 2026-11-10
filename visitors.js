'use strict';
/* شاشة «الزوار» في لوحة المعلم: عدد الزوار كل يوم، وما الذي يجذبهم في التطبيق.
   Loaded after teacher.js. Uses: db, ADMIN, S, SIMS, GAMES, TABS, UNIT_BY_ID, render, esc, icon, navBar, lessonTitle, kwDate,
   tdPanel, tdActivity, tdHeat (from teacher.js). Data comes from supabase-visitors.sql (admin_visitors). */
const VIS = { data: null, loading: false, error: '', needSql: false, at: 0 };

async function visLoad(force) {
  if (!db || !ADMIN || VIS.loading) return;
  if (!force && VIS.data && Date.now() - VIS.at < 60000) return;
  VIS.loading = true; VIS.error = ''; VIS.needSql = false;
  const top = S.stack[S.stack.length - 1]; if (top && top.type === 'visitors') render(false);
  let r;
  try { r = await db.rpc('admin_visitors'); } catch (e) { r = { error: { message: String(e) } }; }
  VIS.loading = false;
  if (r.error) {
    const m = String(r.error.message || '') + ' ' + String(r.error.code || '');
    if (/admin_visitors|42883|PGRST202|schema cache/i.test(m)) VIS.needSql = true; else VIS.error = 'تعذّر تحميل أرقام الزوار، تأكد من الاتصال بالإنترنت ثم اضغط تحديث.';
  } else { VIS.data = r.data; VIS.at = Date.now(); }
  const t2 = S.stack[S.stack.length - 1]; if (t2 && t2.type === 'visitors') render(false);
}

/* ---------- Names ---------- */
const VIS_FEATURES = {
  lesson: ['📚', 'الدروس'], unit: ['📂', 'صفحات الوحدات'], sim: ['🧪', 'المحاكاة'], games: ['🎮', 'الألعاب'], game: ['🎮', 'الألعاب'], glevel: ['🎮', 'الألعاب'],
  bank: ['🧠', 'بنك الأسئلة'], bankrun: ['🧠', 'بنك الأسئلة'], quiz: ['📝', 'جهّزني للاختبار القصير'], qrun: ['📝', 'جهّزني للاختبار القصير'], mistakes: ['📝', 'جهّزني للاختبار القصير'],
  prep: ['🎯', 'جهّزني للفاينال'], laws: ['📐', 'ورقة القوانين'], badges: ['🏅', 'الشارات'], leaders: ['🏆', 'المتصدرون'], class: ['👩‍🏫', 'الحصة'], live: ['👩‍🏫', 'الحصة'], curr: ['📖', 'المنهج'],
};
function visLabel(k, ref) {
  const key = String(ref || '').split(':').slice(1).join(':');
  if (k === 'lesson') { const t = lessonTitle(key); return { t: t.t, sub: t.sub }; }
  if (k === 'unit') { const u = UNIT_BY_ID[key]; return { t: u ? u.title : key, sub: 'صفحة الوحدة' }; }
  if (k === 'pdf') {
    if (String(ref).includes('.')) { const t = lessonTitle(ref); return { t: t.t, sub: 'مذكرة · ' + t.sub }; }
    const u = UNIT_BY_ID[ref]; return { t: u ? u.title : String(ref), sub: 'ملفات الوحدة' };
  }
  if (k === 'sim') { const s = typeof SIMS !== 'undefined' && SIMS[key]; return { t: (s && (s.t || s.title || s.name)) || key, sub: 'محاكاة' }; }
  if (k === 'game') { const g = typeof GAMES !== 'undefined' && GAMES[key]; return { t: g ? g.t : key, sub: 'لعبة' }; }
  if (k === 'tab') { const t = TABS.find(x => x[0] === key); return { t: t ? t[1] : key, sub: 'قسم رئيسي' }; }
  return { t: String(ref), sub: '' };
}

/* ---------- View ---------- */
function visKpis(D) {
  const pct = D.u7 ? Math.round(D.member_7 / D.u7 * 100) : null;
  const tiles = [
    ['👀', 'زوار اليوم', D.today, `أمس: ${D.yesterday}`, '#4C86FF'],
    ['📅', 'زوار آخر 7 أيام', D.u7, D.new_7 ? `منهم ${D.new_7} زائر جديد` : 'لا زوار جدد', '#2BD4B0'],
    ['🗓️', 'زوار آخر 30 يوماً', D.u30, `منذ البداية: ${D.total}`, '#FFB020'],
    ['🎓', 'طلاب مسجّلون بينهم', D.member_7, pct != null ? `${pct}% من زوار الأسبوع` : '', '#A866FF'],
  ];
  return `<div class="td-kpis">${tiles.map(([ic, t, n, sub, c]) => `<div class="td-kpi" style="--c:${c}"><span class="ic">${ic}</span><b>${n == null ? '—' : n}</b><span class="t">${t}</span><small>${esc(sub)}</small></div>`).join('')}</div>`;
}
function visTop(D, k, title, sub, empty) {
  const rows = (D.top || []).filter(x => x.k === k);
  return tdPanel(title, sub, rows.length ? `<div class="td-list">${rows.map((x, i) => { const l = visLabel(k, x.ref); return `<div class="td-row"><span class="td-who"><span class="av num">${i + 1}</span><span class="t"><b>${esc(l.t)}</b><small>${esc(l.sub)}</small></span></span><span class="td-n"><b>${x.n}</b><small>${x.u} زائر</small></span></div>`; }).join('')}</div>` : `<p class="td-empty">${empty}</p>`);
}
function vVisitors() {
  const D = VIS.data;
  const head = `<header class="td-hero">
      <div><small>لوحة المعلم</small><h1>الزوار</h1><p>${VIS.loading && !VIS.at ? 'جارٍ تحميل البيانات…' : VIS.at ? `آخر تحديث ${new Date(VIS.at).toLocaleTimeString('ar-KW-u-nu-latn', { hour: 'numeric', minute: '2-digit' })} · العدّ مجهول بدون أسماء` : ''}</p></div>
      <button class="td-refresh ${VIS.loading ? 'spin' : ''}" data-act="vis-refresh" aria-label="تحديث">${icon('replay')}</button>
    </header>
    ${VIS.error ? `<p class="td-alert">${VIS.error}</p>` : ''}
    ${VIS.needSql ? `<p class="td-alert info">📌 لتظهر أرقام الزوار: شغّل ملف <b>supabase-visitors.sql</b> مرة واحدة في Supabase، ثم اضغط تحديث.</p>` : ''}`;
  if (!D) return `<div class="view push td">${navBar()}${head}${VIS.needSql || VIS.error ? '' : `<div class="td-kpis">${[0, 1, 2, 3].map(() => '<div class="td-kpi sk"></div>').join('')}</div>`}</div>`;

  const act = tdActivity(D.daily, 'u', 'زائر');
  const daily = tdPanel('الزوار كل يوم', `${Math.round(act.last7 / 7 * 10) / 10} زائر يومياً في آخر 7 أيام`, act.svg, 'wide');

  // What attracts them: views grouped by feature
  const groups = {};
  (D.sections || []).forEach(s => { const f = VIS_FEATURES[s.k]; if (!f) return; const g = groups[f[1]] || (groups[f[1]] = { ic: f[0], t: f[1], n: 0 }); g.n += s.n; });
  const feat = Object.values(groups).sort((a, b) => b.n - a.n), fmax = Math.max(1, ...feat.map(g => g.n));
  const featP = tdPanel('🔥 ما الذي يجذبهم؟', 'عدد مرات الفتح في آخر 30 يوماً',
    feat.length ? `<div class="td-bars">${feat.map(g => `<div><span class="t"><b>${g.ic} ${esc(g.t)}</b></span><span class="trk"><i style="width:${Math.max(3, Math.round(g.n / fmax * 100))}%"></i></span><b class="v">${g.n}</b></div>`).join('')}</div>` : '<p class="td-empty">ستظهر هنا الأقسام الأكثر استخداماً بعد أن يتصفح الزوار التطبيق.</p>');

  const tabs = (D.top || []).filter(x => x.k === 'tab');
  const tmax = Math.max(1, ...tabs.map(x => x.n));
  const tabP = tdPanel('🧭 الأقسام الرئيسية', 'الرئيسية · المختبر · المذكرات · حسابي',
    tabs.length ? `<div class="td-bars">${tabs.map(x => { const l = visLabel('tab', x.ref); return `<div class="tip" data-tip="${esc(`${x.u} زائر`)}"><span class="t"><b>${esc(l.t)}</b></span><span class="trk"><i style="width:${Math.max(3, Math.round(x.n / tmax * 100))}%"></i></span><b class="v">${x.n}</b></div>`; }).join('')}</div>` : '<p class="td-empty">لا توجد بيانات بعد.</p>');

  const lessP = visTop(D, 'lesson', '🎬 أكثر الدروس فتحاً', 'آخر 30 يوماً', 'لا توجد دروس مفتوحة بعد.');
  const unitP = visTop(D, 'unit', '📂 أكثر الوحدات زيارة', 'آخر 30 يوماً', 'لا توجد بيانات بعد.');
  const pdfP = visTop(D, 'pdf', '📄 أكثر المذكرات فتحاً', 'آخر 30 يوماً', 'لا توجد مذكرات مفتوحة بعد.');
  const gameP = visTop(D, 'game', '🎮 أكثر الألعاب لعباً', 'آخر 30 يوماً', 'لا توجد ألعاب مفتوحة بعد.');
  const simP = visTop(D, 'sim', '🧪 أكثر المحاكاة استخداماً', 'آخر 30 يوماً', 'لا توجد بيانات بعد.');
  const heatP = tdPanel('🕒 متى يدخلون؟', 'آخر 30 يوماً بتوقيت الكويت', tdHeat(D.heat));
  const gr = D.grades || {}, gtot = Math.max(1, (gr.g10 || 0) + (gr.g11 || 0) + (gr.g12 || 0));
  const gradeP = tdPanel('🏫 الزوار حسب الصف', 'آخر 7 أيام (حسب الصف المختار في التطبيق)',
    `<div class="td-bars">${[['g10', 'العاشر'], ['g11', 'الحادي عشر'], ['g12', 'الثاني عشر']].map(([g, t]) => `<div><span class="t"><b>${t}</b></span><span class="trk"><i style="width:${Math.round((gr[g] || 0) / gtot * 100)}%"></i></span><b class="v">${gr[g] || 0}</b></div>`).join('')}</div>`);

  const note = D.u30 ? '' : '<p class="td-alert info">📌 بدأ العدّ الآن. ستظهر الأرقام بعد أن يفتح الزوار التطبيق بعد هذا التحديث (قد يحتاجون لإغلاق التطبيق وفتحه مرة واحدة ليتحدّث).</p>';
  return `<div class="view push td">${navBar()}${head}${note}${visKpis(D)}
    <div class="td-grid">${daily}${featP}${tabP}${lessP}${unitP}${pdfP}${gameP}${simP}${gradeP}${heatP}</div>
    <p class="td-note">ℹ️ «الزائر» هو جهاز واحد (جوال أو لابتوب). إن فتح الطالب التطبيق من جهازين يُحسب زائرين. حسابك أنت لا يُحسب.</p>
  </div>`;
}
