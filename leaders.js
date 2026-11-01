'use strict';
/* لوحة المتصدرين الأسبوعية: ترتيب طلاب الصف حسب إجاباتهم الصحيحة في بنك الأسئلة هذا الأسبوع.
   Loaded after the main script. Uses: db, USER, PROFILE, ADMIN, ACCOUNTS, S, GRADES, GRADE_ORDER, render, go, esc, icon, navBar, toast,
   authSheet, shareCard. Data comes from the leaderboard() function in supabase-leaderboard.sql. */
const LB = { at: 0, loading: false, data: null, error: '', g: null };
const lbCan = () => !!(db && USER && (PROFILE || ADMIN));

async function lbLoad(force) {
  if (!lbCan() || LB.loading) return;
  if (!force && LB.at && Date.now() - LB.at < 60000) return;  // also stops retry loops when the SQL file isn't run yet
  LB.loading = true;
  const r = await db.rpc('leaderboard', { p_grade: ADMIN ? (LB.g || S.grade) : null });
  LB.loading = false; LB.at = Date.now();
  if (r.error || !r.data) { LB.error = 'soon'; LB.data = null; }
  else { LB.error = ''; LB.data = r.data; if (typeof achLb === 'function') achLb(r.data); }
  const top = S.stack[S.stack.length - 1];
  if (!top || top.type === 'leaders') render(false);
}
// a finished bank round changes the points, so fetch fresh numbers next time
const lbDirty = () => { LB.at = 0; };

function lbLeft() {
  if (!LB.data) return '';
  const ms = new Date(LB.data.week_end) - Date.now(), d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5);
  return d >= 1 ? `${d} ${d === 1 ? 'يوم' : d === 2 ? 'يومان' : d <= 10 ? 'أيام' : 'يوماً'}${h ? ` و${h} ساعة` : ''}` : `${Math.max(h, 1)} ساعة`;
}
const lbPts = n => `${n} ${n === 1 ? 'نقطة' : n === 2 ? 'نقطتان' : n <= 10 ? 'نقاط' : 'نقطة'}`;

/* ---------- Home card ---------- */
function lbCard() {
  if (!db || !ACCOUNTS) return '';
  if (!USER) return `<button class="lb-entry" data-act="lb-open"><span class="gi">🏆</span><span class="t"><b>المتصدرون هذا الأسبوع</b><small>سجّل حسابك وتنافس مع زملائك في صفك</small></span><span class="qb-go">ابدأ ${icon('chev')}</span></button>`;
  if (!LB.loading && (!LB.at || Date.now() - LB.at > 60000)) setTimeout(() => lbLoad(), 0);
  const me = LB.data && LB.data.me, n = LB.data ? LB.data.players : 0;
  const sub = LB.error ? 'قريباً: تنافس مع زملائك في صفك' : !LB.data ? 'جارٍ تحميل الترتيب…'
    : me ? `ترتيبك #${me.r} من ${n} · ${lbPts(me.pts)}` : n ? `${n} ${n <= 10 ? 'طلاب' : 'طالباً'} يتنافسون · حل أسئلة البنك لتدخل الترتيب` : 'كن أول من يتصدر هذا الأسبوع!';
  return `<button class="lb-entry" data-go="leaders"><span class="gi">${me && me.r <= 3 ? ['🥇', '🥈', '🥉'][me.r - 1] : '🏆'}</span>
    <span class="t"><b>المتصدرون هذا الأسبوع</b><small>${sub}</small></span><span class="qb-go">${me ? 'الترتيب' : 'شاهد'} ${icon('chev')}</span></button>`;
}

/* ---------- Page ---------- */
function vLeaders() {
  const back = `<div class="view push lb">${navBar()}`;
  if (!lbCan()) return `${back}<div class="live-msg"><div class="em">🏆</div><h1>المتصدرون هذا الأسبوع</h1><p>سجّل حسابك لتنافس زملاءك في صفك.</p><button class="btn primary" data-act="lb-open">إنشاء حساب</button></div></div>`;
  if (LB.error) return `${back}<div class="live-msg"><div class="em">🏆</div><h1>لوحة المتصدرين قريباً</h1><p>${ADMIN ? 'شغّل ملف supabase-leaderboard.sql مرة واحدة في Supabase لتفعيلها.' : 'سيفعّلها معلمك قريباً. استمر في حل أسئلة البنك، فنقاطك محفوظة!'}</p></div></div>`;
  const D = LB.data;
  const chips = ADMIN ? `<div class="td-chips">${GRADE_ORDER.map(g => `<button class="${(LB.g || S.grade) === g ? 'on' : ''}" data-act="lb-g" data-g="${g}">${GRADES[g].short}</button>`).join('')}</div>` : '';
  if (!D) return `${back}<section class="lb-hero"><small>${esc(G().name)}</small><h1>المتصدرون هذا الأسبوع</h1><p>جارٍ تحميل الترتيب…</p></section>${chips}<div class="lb-pod sk"></div></div>`;
  const top = D.top || [], me = D.me, g = GRADES[D.grade] || G();
  const pod = [top[1], top[0], top[2]], place = ['p2', 'p1', 'p3'], medal = ['🥈', '🥇', '🥉'];
  const podium = top.length ? `<div class="lb-pod">${pod.map((x, i) => x ? `<div class="pl ${place[i]} ${x.me ? 'me' : ''}">
      <span class="m">${medal[i]}</span><span class="av">${esc((x.name || '?').trim()[0] || '?')}</span><b>${esc(x.name)}${x.me ? ' (أنت)' : ''}</b><small>${lbPts(x.pts)}</small>
      <span class="st"><i>${x.r}</i></span></div>` : `<div class="pl ${place[i]} empty"><span class="st"><i>${['2', '1', '3'][i]}</i></span></div>`).join('')}</div>`
    : `<div class="lb-empty"><div class="em">🚀</div><b>لا يوجد متصدر بعد هذا الأسبوع</b><p>حل أسئلة من بنك الأسئلة الآن وكن أول اسم في القائمة!</p><button class="btn primary" data-go="bank">ابدأ من بنك الأسئلة</button></div>`;
  const rest = top.slice(3);
  const meOut = me && me.r > 10 ? `<div class="lb-row me sticky"><span class="r">${me.r}</span><span class="t"><b>أنت</b><small>${me.n} إجابة هذا الأسبوع</small></span><span class="p">${lbPts(me.pts)}</span></div>` : '';
  const meIn = !ADMIN && !me && top.length ? `<p class="lb-hint">لم تدخل الترتيب بعد هذا الأسبوع. أجب عن سؤال واحد صحيح لتظهر في القائمة! 💪</p>` : '';
  const gap = me && me.r > 1 && me.r <= 11 ? (() => { const above = top.filter(x => x.pts > me.pts).slice(-1)[0]; return above ? `<p class="lb-hint">🔥 ينقصك <b>${above.pts - me.pts + 1}</b> ${above.pts - me.pts + 1 <= 10 ? 'نقاط' : 'نقطة'} لتتقدم إلى المركز ${above.r}</p>` : ''; })() : me && me.r === 1 ? '<p class="lb-hint">👑 أنت في الصدارة! حافظ على مركزك حتى نهاية الأسبوع.</p>' : '';
  const prev = (D.prev || []).length ? `<section class="lb-prev"><h2>أبطال الأسبوع الماضي</h2><div>${D.prev.map((x, i) => `<span><i>${['🥇', '🥈', '🥉'][i]}</i><b>${esc(x.name)}</b><small>${lbPts(x.pts)}</small></span>`).join('')}</div></section>` : '';
  return `${back}
    <section class="lb-hero"><small>${esc(g.name)} · ${D.players} ${D.players <= 10 ? 'طلاب' : 'طالباً'} في المنافسة</small><h1>المتصدرون هذا الأسبوع</h1>
      <p>⏳ يبدأ أسبوع جديد بعد <b>${lbLeft()}</b></p><button class="lb-ref" data-act="lb-refresh" aria-label="تحديث">${icon('replay')}</button></section>
    ${chips}
    ${podium}${gap}${meIn}
    ${rest.length ? `<div class="lb-list">${rest.map(x => `<div class="lb-row ${x.me ? 'me' : ''}"><span class="r">${x.r}</span><span class="av">${esc((x.name || '?').trim()[0] || '?')}</span><span class="t"><b>${esc(x.name)}${x.me ? ' (أنت)' : ''}</b><small>${x.n} إجابة</small></span><span class="p">${lbPts(x.pts)}</span></div>`).join('')}</div>` : ''}
    ${meOut}
    ${me && !ADMIN ? `<button class="btn wide lb-share" data-act="lb-share">${icon('share')}شارك ترتيبك</button>` : ''}
    <button class="btn primary wide lb-go" data-go="bank">⚡ اجمع نقاطاً من بنك الأسئلة</button>
    ${prev}
    <section class="lb-rules"><h2>كيف تُحسب النقاط؟</h2><ul>
      <li>✅ كل إجابة صحيحة في بنك الأسئلة = نقطة.</li>
      <li>🔁 السؤال الواحد يُحسب مرتين بحد أقصى في الأسبوع، فنوّع أسئلتك.</li>
      <li>📅 يبدأ الترتيب من الصفر كل يوم أحد، فلكل طالب فرصة جديدة.</li>
      <li>🙈 تظهر الأسماء الأولى فقط، وتظهر أفضل 10 مراكز.</li></ul></section>
  </div>`;
}

function lbAct(act, el) {
  if (act === 'lb-open') return authSheet('signup', () => go('leaders'));
  if (act === 'lb-refresh') { lbLoad(true); toast('جارٍ التحديث…'); }
  else if (act === 'lb-g') { LB.g = el.dataset.g; LB.data = null; render(false); lbLoad(true); }
  else if (act === 'lb-share' && LB.data && LB.data.me) { const m = LB.data.me;
    shareCard({ big: m.r <= 3 ? ['🥇', '🥈', '🥉'][m.r - 1] : `#${m.r}`, title: 'ترتيبي في لوحة المتصدرين', sub: `${(GRADES[LB.data.grade] || G()).name} · ${lbPts(m.pts)} هذا الأسبوع`, text: `أنا في المركز ${m.r} هذا الأسبوع في لوحة متصدري الفيزياء على Physics Tube 🏆 هل تتغلب عليّ؟ https://physics-tube.com/` }); }
}
function lbAfterRender(top) { if (top && top.type === 'leaders' && lbCan()) lbLoad(); }

// The home screen was drawn before this file loaded; draw it again with the leaderboard card.
if (!S.stack.length) render(false);
