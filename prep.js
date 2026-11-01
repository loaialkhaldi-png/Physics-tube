'use strict';
/* جهّزني للاختبار: يقيس جاهزية الطالب في دروس الاختبار من بنك الأسئلة، ويضع له خطة يومية حتى موعد الاختبار،
   ويبني له جولة مراجعة ذكية واختباراً تجريبياً. دروس الاختبار يحددها المعلم مع موعد الاختبار (إعلان المعلم)،
   أو يختارها الطالب بنفسه. Uses: qbBank, qbAll, qbStats, qbPct, qbStart, qbToday, QBM, getNotice, daysLeft, store, S, G, esc, icon, navBar, ring, render, toast. */

const prepKey = () => 'prep.' + S.grade;
function prepTeacher() { const n = typeof getNotice === 'function' ? getNotice() : null; return n && Array.isArray(n.bank) && n.bank.length ? n : null; }
function prepLessons() {
  const B = qbBank(); if (!B) return [];
  const ids = B.flatMap(c => c.ls.map(l => l.id));
  const t = prepTeacher(); if (t) return t.bank.filter(id => ids.includes(id));
  const mine = store.get(prepKey(), null);
  return Array.isArray(mine) ? mine.filter(id => ids.includes(id)) : ids;
}
function prepStats(ids) {
  const pool = qbAll().filter(x => ids.includes(x.l.id)), st = qbStats(pool);
  return { pool, st, pct: qbPct(st), wrong: st.wrong, fresh: st.n - st.seen, done: st.done };
}
const prepLevel = p => p >= 90 ? ['جاهز للاختبار 💪', '#32D17A'] : p >= 70 ? ['شبه جاهز، بقي القليل', '#2BD4B0'] : p >= 40 ? ['في الطريق الصحيح', '#FFB020'] : ['تحتاج بداية قوية', '#FF6B6B'];
function prepExam() {
  const n = typeof getNotice === 'function' ? getNotice() : null;
  const left = n && n.date ? daysLeft(n.date) : null;
  return n && left != null && left >= 0 ? { n, left } : null;
}
function prepRecord(p) { if (p > (+store.get('prepTop', 0) || 0)) store.set('prepTop', p); }

/* ---------- Entry buttons ---------- */
function prepBtn(cls = 'nbtn pri') { return qbBank() ? `<button class="${cls}" data-go="prep">🎯 جهّزني للاختبار</button>` : ''; }
function prepCard() {
  if (!qbBank()) return '';
  const ids = prepLessons(), s = prepStats(ids), ex = prepExam(), lv = prepLevel(s.pct);
  return `<button class="prep-entry" data-go="prep" style="--rc:${lv[1]}"><span class="pr">${ring(s.pct, 54, lv[1], 6)}<b>${s.pct}%</b></span>
    <span class="t"><b>🎯 جهّزني للاختبار</b><small>${ex ? (ex.left === 0 ? 'الاختبار اليوم! ' : `باقي ${ex.left} ${ex.left === 1 ? 'يوم' : ex.left === 2 ? 'يومان' : ex.left <= 10 ? 'أيام' : 'يوماً'} · `) : ''}جاهزيتك ${s.pct}% · ${lv[0]}</small></span>
    <span class="qb-go">ابدأ ${icon('chev')}</span></button>`;
}

/* ---------- Page ---------- */
function vPrep() {
  const B = qbBank();
  if (!B) return `<div class="view push">${navBar()}<div class="live-msg"><div class="em">🎯</div><h1>متاح لصفوف بنك الأسئلة</h1></div></div>`;
  const ids = prepLessons(), s = prepStats(ids), lv = prepLevel(s.pct), ex = prepExam(), teacher = prepTeacher();
  prepRecord(s.pct);
  const left = s.st.n - s.done, days = ex ? Math.max(1, ex.left) : 7, perDay = Math.max(10, Math.ceil((left + s.wrong) / days)), today = qbToday();
  const all = qbAll(), lessons = B.flatMap((c, ci) => c.ls.map(l => { const st = qbStats(all.filter(x => x.l.id === l.id)); return { c, l, st, p: qbPct(st), on: ids.includes(l.id) }; }));
  const sel = lessons.filter(x => x.on).sort((a, b) => a.p - b.p);
  const gauge = `<svg class="prep-g" viewBox="0 0 220 128" aria-hidden="true"><path d="M20 112 A90 90 0 0 1 200 112" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="16" stroke-linecap="round"/>
    ${s.pct > 0 ? `<path d="M20 112 A90 90 0 0 1 200 112" fill="none" stroke="${lv[1]}" stroke-width="16" stroke-linecap="round" pathLength="100" stroke-dasharray="${s.pct} 101"/>` : ''}</svg>`;
  return `<div class="view push prep">${navBar()}
    <section class="prep-hero" style="--lc:${lv[1]}">
      <small>${esc(G().name)}${ex ? ` · ${esc(ex.n.title)}` : ''}</small><h1>جهّزني للاختبار</h1>
      ${ex ? `<span class="prep-days">${ex.left === 0 ? '🚀 الاختبار اليوم' : `⏳ باقي <b>${ex.left}</b> ${ex.left === 1 ? 'يوم' : ex.left === 2 ? 'يومان' : ex.left <= 10 ? 'أيام' : 'يوماً'}`}</span>` : ''}
      <div class="prep-gw">${gauge}<span class="v"><b>${s.pct}%</b><small>جاهزيتك</small></span></div>
      <p class="lvl">${lv[0]}</p>
      <div class="prep-stats"><span><b>${s.done}</b><small>متقنة 👑</small></span><span><b>${s.wrong}</b><small>أخطاء للمراجعة 🎯</small></span><span><b>${s.fresh}</b><small>لم تحلها بعد</small></span></div>
    </section>
    ${s.pct < 100 ? `<div class="prep-plan"><span class="ic">📅</span><span class="t"><b>خطتك: ${perDay} سؤالاً يومياً${ex ? ' حتى الاختبار' : ''}</b><small>حللت اليوم ${today} من ${perDay}</small><span class="ach-p"><i style="width:${Math.min(100, today / perDay * 100)}%"></i></span></span></div>` : '<p class="lb-hint">👑 أتقنت كل أسئلة دروس الاختبار! راجع ورقة القوانين وادخل الاختبار بثقة.</p>'}
    <div class="prep-acts">
      <button class="prep-a main" data-act="prep-go" data-m="prep"><span>⚡</span><b>جولة المراجعة الذكية</b><small>15 سؤالاً: أخطاؤك أولاً، ثم ما لم تحله</small></button>
      <button class="prep-a" data-act="prep-go" data-m="mock"><span>📝</span><b>اختبار تجريبي</b><small>20 سؤالاً منوّعة من كل الدروس</small></button>
      ${s.wrong ? `<button class="prep-a" data-act="prep-go" data-m="pwrong"><span>🎯</span><b>أخطائي فقط</b><small>${s.wrong} ${s.wrong <= 10 ? 'أسئلة' : 'سؤالاً'} تنتظرك</small></button>` : ''}
      ${typeof lawsCard === 'function' && typeof LAWS_DATA !== 'undefined' && LAWS_DATA[S.grade] ? `<button class="prep-a" data-go="laws"><span>📐</span><b>ورقة القوانين</b><small>راجع القوانين قبل الاختبار</small></button>` : ''}
    </div>
    <h2 class="sec">دروس الاختبار <small>${teacher ? '🔒 حددها معلمك' : 'اضغط لتغييرها'}</small></h2>
    ${teacher ? `<div class="prep-ls">${sel.map(x => prepRow(x, false)).join('')}</div>`
      : `<div class="prep-ls">${lessons.map(x => prepRow(x, true)).join('')}</div>`}
  </div>`;
}
function prepRow(x, pick) {
  const lv = prepLevel(x.p);
  return `<${pick ? `button data-act="prep-pick" data-id="${x.l.id}"` : 'div'} class="prep-l ${x.on ? 'on' : 'off'}">
    ${pick ? `<span class="ck">${x.on ? '✓' : ''}</span>` : ''}
    <span class="t"><b>${esc(x.l.t)}</b><small>الدرس (${x.l.id}) · ${esc(x.c.ch)}${x.on && x.st.wrong ? ` · <em>${x.st.wrong} للمراجعة</em>` : ''}</small><span class="ach-p"><i style="width:${x.p}%;background:${lv[1]}"></i></span></span>
    <b class="v">${x.p}%</b></${pick ? 'button' : 'div'}>`;
}
function prepAct(act, el) {
  if (act === 'prep-pick') {
    const B = qbBank(); let ids = prepLessons(); const id = el.dataset.id;
    ids = ids.includes(id) ? ids.filter(x => x !== id) : ids.concat(id);
    if (!ids.length) return toast('اختر درساً واحداً على الأقل');
    store.set(prepKey(), B.flatMap(c => c.ls.map(l => l.id)).filter(x => ids.includes(x))); render(false);
  }
  else if (act === 'prep-go') {
    const ids = prepLessons(), m = el.dataset.m;
    PREP.before = prepStats(ids).pct;
    qbStart(m, ids.join(','));
  }
}
const PREP = { before: null };
/* shown on the bank's results page after a prep session */
function prepResult(s) {
  if (!['prep', 'mock', 'pwrong'].includes(s.mode) || PREP.before == null) return '';
  const now = prepStats(String(s.scope).split(',')).pct, d = now - PREP.before; prepRecord(now);
  return `<div class="prep-res"><span>🎯</span><span class="t"><b>جاهزيتك الآن ${now}%</b><small>${d > 0 ? `▲ تقدمت ${d}% في هذه الجولة` : 'استمر، كل جولة تقرّبك من الجاهزية'}</small></span><button class="btn" data-go="prep">الخطة</button></div>`;
}
