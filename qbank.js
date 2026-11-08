'use strict';
/* بنك الأسئلة التفاعلي: مسار الفصول والدروس، جولات بكل أنواع الأسئلة، إتقان ومراجعة ذكية، تحدي الدقيقة، وهدف يومي.
   Loaded after the main script and games.js, so it uses: store, S, G, go, render, transition, toast, esc, icon, qtext, ring, starStr,
   addXP, track, shareCard, navBar, SFX. Questions come from bank-g10.js (window.BANK_G10), bank-g11.js (window.BANK_G11) and bank-g12.js (window.BANK_G12). */
const QB_SRC = 'من بنك الأسئلة 2025–2026';
const QB_GOAL = 20, QB_ROUND = 10, QB_SPRINT = 60;
const QB_KIND = { term: 'المصطلح العلمي', tf: 'صح أم خطأ', fill: 'أكمل الفراغ', mcq: 'اختر الإجابة', num: 'مسألة', card: 'بطاقة مراجعة' };
const QB_KIC = { term: '🏷️', tf: '✔️', fill: '✍️', mcq: '🔘', num: '🧮', card: '🃏' };
let QBM = store.get('qbm', {});   // question id → mastery box: −1 أخطأ آخر مرة، 1 و 2 و 3 إجابات صحيحة متتالية (2 فأكثر = متقَن)
let QBD = store.get('qbd', {});   // day → number of answered questions
let QBR = store.get('qbr', {});   // records: { sprint: best }
const QB = { s: null, timer: 0 };

const qbBank = () => ({ g10: window.BANK_G10, g11: window.BANK_G11, g12: window.BANK_G12 })[S.grade] || null;
const qbSrc = () => S.grade === 'g10' && window.BANK_G10_SRC ? window.BANK_G10_SRC : QB_SRC;
const qbTerm = () => S.grade === 'g10' ? 'الفصل الدراسي الأول' : 'الفترة الأولى';
const qbPre = () => S.grade === 'g11' ? '' : S.grade.slice(1) + ':';   // keeps each grade's progress apart
const qbRK = () => S.grade === 'g11' ? 'sprint' : 'sprint' + S.grade;
const qbAll = () => { const B = qbBank(); return B ? B.flatMap((c, ci) => c.ls.flatMap(l => l.qs.map((q, i) => ({ q, id: `${qbPre()}${l.id}.${i}`, l, c, ci })))) : []; };
const qbLesson = id => { for (const c of qbBank() || []) for (const l of c.ls) if (l.id === id) return { c, l }; return null; };
const qbMastered = id => (QBM[id] || 0) >= 2;
const qbStats = list => ({ n: list.length, done: list.filter(x => qbMastered(x.id)).length, seen: list.filter(x => QBM[x.id] != null).length, wrong: list.filter(x => QBM[x.id] === -1).length, pts: list.reduce((t, x) => t + ((QBM[x.id] || 0) >= 2 ? 1 : QBM[x.id] === 1 ? .5 : 0), 0) });
const qbToday = () => QBD[dayKey()] || 0;
function qbStreak() { let n = 0; const d = new Date(); if (!QBD[dayKey(d)]) d.setDate(d.getDate() - 1); while (QBD[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); } return n; }
const qbShuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const qbPct = st => st.n ? Math.round(st.pts / st.n * 100) : 0;  // a question answered right once counts half; twice in a row = mastered

/* ---------- Picking questions: wrong first, then new, then the least mastered ---------- */
function qbPick(pool, n) {
  const rank = x => { const b = QBM[x.id]; return b === -1 ? 0 : b == null ? 1 : b === 1 ? 2 : 3 + b; };
  const groups = {}; qbShuffle(pool).forEach(x => (groups[rank(x)] = groups[rank(x)] || []).push(x));
  const out = Object.keys(groups).sort((a, b) => a - b).flatMap(k => groups[k]).slice(0, n);
  // spread the question types so the round keeps changing
  const byK = {}; out.forEach(x => (byK[x.q.k] = byK[x.q.k] || []).push(x));
  const mixed = []; while (mixed.length < out.length) Object.values(byK).forEach(arr => { if (arr.length) mixed.push(arr.shift()); });
  return mixed;
}
// options for one item (correct answer first in data; shown shuffled)
function qbOptions(x) {
  const q = x.q;
  if (q.k === 'mcq') return qbShuffle(q.o.map((t, i) => ({ t, ok: i === 0 })));
  if (q.k === 'fill') return qbShuffle([{ t: q.a, ok: true }].concat(q.o.map(t => ({ t, ok: false }))));
  if (q.k === 'term') {
    const pool = [...new Set(qbAll().filter(y => y.q.k === 'term' && y.q.a !== q.a).sort((a, b) => (b.ci === x.ci) - (a.ci === x.ci) || Math.random() - .5).map(y => y.q.a))];
    return qbShuffle([{ t: q.a, ok: true }].concat(qbShuffle(pool.slice(0, 6)).slice(0, 3).map(t => ({ t, ok: false }))));
  }
  return null;
}

// spread question types so a mock exam keeps changing
function qbMix(out) { const byK = {}; out.forEach(x => (byK[x.q.k] = byK[x.q.k] || []).push(x)); const m = []; while (m.length < out.length) Object.values(byK).forEach(a => { if (a.length) m.push(a.shift()); }); return m; }
/* ---------- Sessions ---------- */
function qbStart(mode, scope) {
  const all = qbAll(); let pool = all, title = 'جولة عشوائية', n = QB_ROUND;
  if (mode === 'lesson') { const L = qbLesson(scope); pool = all.filter(x => x.l.id === scope); title = L.l.t; }
  else if (mode === 'chapter') { const c = (qbBank() || [])[+scope]; pool = all.filter(x => x.ci === +scope); title = 'اختبار الفصل: ' + c.ch; n = 15; }
  else if (mode === 'mistakes') { pool = all.filter(x => QBM[x.id] === -1); title = 'أخطائي في البنك'; n = 15; }
  else if (mode === 'prep' || mode === 'mock' || mode === 'pwrong') { const ids = String(scope).split(','); pool = all.filter(x => ids.includes(x.l.id) && (mode !== 'pwrong' || QBM[x.id] === -1)); title = mode === 'mock' ? 'اختبار تجريبي' : mode === 'pwrong' ? 'أخطائي في دروس الفاينال' : 'مراجعة الفاينال'; n = mode === 'mock' ? 20 : 15; }
  else if (mode === 'sprint') { pool = all.filter(x => ['tf', 'mcq', 'fill', 'term'].includes(x.q.k)); title = 'تحدي الدقيقة'; n = 200; }
  if (!pool.length) return toast(mode === 'mistakes' ? 'لا توجد أخطاء محفوظة، أحسنت! 🎉' : 'لا توجد أسئلة هنا بعد');
  const items = (mode === 'sprint' ? qbShuffle(pool) : mode === 'mock' ? qbMix(qbShuffle(pool).slice(0, n)) : qbPick(pool, n)).map(x => Object.assign({}, x, { opts: qbOptions(x) }));
  const before = qbStats(mode === 'lesson' ? pool : all).done;
  QB.s = { mode, scope, title, items, i: 0, ans: [], streak: 0, best: 0, xp: 0, before, t0: Date.now(), left: QB_SPRINT, done: false, flip: false };
  if (S.stack.length && S.stack[S.stack.length - 1].type === 'bankrun') render(); else go('bankrun');
}
function qbMark(x, ok) {
  const b = QBM[x.id];
  QBM[x.id] = ok ? Math.min(3, (b > 0 ? b : 0) + 1) : -1; store.set('qbm', QBM);
  const k = dayKey(); QBD[k] = (QBD[k] || 0) + 1;
  QBD = Object.fromEntries(Object.keys(QBD).sort().slice(-120).map(d => [d, QBD[d]])); store.set('qbd', QBD);
  if (QBD[k] === QB_GOAL) setTimeout(() => toast('🎯 حققت هدف اليوم: ' + QB_GOAL + ' سؤالاً! +30 نقطة'), 600), addXP(30);
}
function qbAnswer(ok, extra) {
  const s = QB.s; if (!s || s.done) return; const x = s.items[s.i]; if (s.ans[s.i]) return;
  s.streak = ok ? s.streak + 1 : 0; s.best = Math.max(s.best, s.streak);
  const gain = ok ? 10 + Math.min(s.streak - 1, 5) * 2 : 0; s.xp += gain;
  s.ans[s.i] = Object.assign({ ok, gain }, extra || {});
  qbMark(x, ok);
  if (typeof achCount === 'function') achCount(ok);
  if (typeof tdLogAnswer === 'function') tdLogAnswer(`${S.grade}:${x.l.id}.${x.id.split('.').pop()}`, ok);
  if (typeof SFX !== 'undefined') { SFX.init(); SFX.play(ok ? 'pop' : 'fail'); }
  if (navigator.vibrate && !ok) navigator.vibrate(60);
  if (s.mode === 'sprint') { if (ok) s.score = (s.score || 0) + 1; setTimeout(() => { if (QB.s === s && !s.done) { s.i++; if (s.i >= s.items.length) qbFinish(); else qbPaint(); } }, ok ? 260 : 650); qbPaint(); return; }
  qbPaint();
}
function qbNext() {
  const s = QB.s; if (!s) return;
  if (s.i + 1 >= s.items.length) return qbFinish();
  s.i++; s.flip = false; qbPaint(true);
}
function qbFinish() {
  if (typeof lbDirty === 'function') lbDirty();
  const s = QB.s; if (!s || s.done) return; s.done = true; clearInterval(QB.timer); QB.timer = 0;
  const n = s.ans.filter(Boolean).length, ok = s.ans.filter(a => a && a.ok).length;
  s.pct = n ? Math.round(ok / n * 100) : 0; s.ok = ok; s.n = n;
  if (s.mode === 'sprint') { s.newBest = (s.score || 0) > (QBR[qbRK()] || 0); if (s.newBest) { QBR[qbRK()] = s.score || 0; store.set('qbr', QBR); } }
  const pool = s.mode === 'lesson' ? qbAll().filter(x => x.l.id === s.scope) : qbAll();
  if (typeof achFlush === 'function') achFlush();
  s.gained = qbStats(pool).done - s.before;
  if (s.xp) addXP(s.xp);
  if (n) track('q');
  if (typeof SFX !== 'undefined' && s.pct >= 70) SFX.play('win');
  qbPaint(true);
}

/* ---------- Views ---------- */
function vBank() {
  const B = qbBank(); if (!B) return `<div class="view push">${navBar()}<div class="live-msg"><div class="em">🏦</div><h1>بنك الأسئلة متاح للصفوف العاشر والحادي عشر والثاني عشر</h1></div></div>`;
  const all = qbAll(), st = qbStats(all), today = qbToday(), streak = qbStreak();
  return `<div class="view push qbank">${navBar()}
    <section class="qb-hero">
      <div class="qb-hero-t"><small>${esc(G().name)} · ${qbTerm()}</small><h1>بنك الأسئلة</h1><p>${all.length} سؤالاً ${esc(qbSrc())}</p></div>
      <div class="qb-rings">
        <span class="qb-r">${ring(qbPct(st), 92, '#2BD4B0', 9)}<b>${qbPct(st)}%</b><small>إتقان</small></span>
        <span class="qb-r">${ring(Math.min(100, today / QB_GOAL * 100), 92, '#FFB020', 9)}<b>${Math.min(today, 99)}/${QB_GOAL}</b><small>هدف اليوم</small></span>
        <span class="qb-r flame ${streak ? 'on' : ''}"><span class="fl">🔥</span><b>${streak}</b><small>${streak === 1 ? 'يوم متتالٍ' : 'أيام متتالية'}</small></span>
      </div>
    </section>
    <div class="qb-quick">
      <button data-act="qb-start" data-m="sprint" style="--c:#FF4D7A"><span>⚡</span><b>تحدي الدقيقة</b><small>${QBR[qbRK()] ? 'رقمك القياسي ' + QBR[qbRK()] : 'كم سؤالاً تجيب في 60 ثانية؟'}</small></button>
      <button data-act="qb-start" data-m="mistakes" style="--c:#FFB020"><span>🎯</span><b>أخطائي</b><small>${st.wrong ? st.wrong + ' سؤالاً للمراجعة' : 'لا توجد أخطاء'}</small></button>
      <button data-act="qb-start" data-m="mix" style="--c:#4C86FF"><span>🔀</span><b>جولة عشوائية</b><small>من كل الفصول</small></button>
    </div>
    ${typeof prepCard === 'function' ? prepCard() : ''}
    ${typeof lbCard === 'function' ? lbCard() : ''}
    ${typeof lawsCard === 'function' ? lawsCard() : ''}
    ${B.map((c, ci) => { const cs = qbStats(all.filter(x => x.ci === ci)); return `<section class="qb-ch" style="--g1:${c.c[0]};--g2:${c.c[1]}">
      <div class="qb-ch-h"><span class="ic">${c.ic}</span><span class="t"><small>الفصل ${['الأول', 'الثاني', 'الثالث'][ci] || ci + 1}</small><b>${esc(c.ch)}</b></span><span class="pc">${qbPct(cs)}%</span></div>
      <div class="qb-bar"><i style="width:${qbPct(cs)}%"></i></div>
      <div class="qb-ls">${c.ls.map(l => { const ls = qbStats(all.filter(x => x.l.id === l.id)), p = qbPct(ls), kinds = [...new Set(l.qs.map(q => q.k))];
        return `<button class="qb-l ${p === 100 ? 'full' : ''}" data-act="qb-start" data-m="lesson" data-s="${l.id}">
          <span class="qb-lr">${ring(p, 56, p === 100 ? '#FFD23F' : '#fff', 5)}<b>${p === 100 ? '👑' : p + '%'}</b></span>
          <span class="t"><small>الدرس (${l.id})</small><b>${esc(l.t)}</b><span class="k">${kinds.map(k => QB_KIC[k]).join(' ')} · ${l.qs.length} سؤالاً${ls.wrong ? ` · <em>${ls.wrong} للمراجعة</em>` : ''}</span></span>
          <span class="go">${icon('chev')}</span></button>`; }).join('')}</div>
      <button class="qb-test" data-act="qb-start" data-m="chapter" data-s="${ci}">📝 اختبار الفصل (15 سؤالاً)</button>
    </section>`; }).join('')}
    <p class="hint">الأسئلة والإجابات ${esc(qbSrc())}. السؤال الذي تخطئ فيه يعود إليك أكثر حتى تتقنه.</p>
  </div>`;
}
function qbQuestionHTML(x, a) {
  const q = x.q, s = QB.s;
  let text = qtext(q.q);
  if (q.k === 'fill') text = text.replace(/_{3,}/, a ? `<span class="qb-blank ok">${qtext(q.a)}</span>` : '<span class="qb-blank">؟</span>');
  let body = '';
  if (q.k === 'tf') {
    body = `<div class="qb-tf">${[[1, '✓', 'صح'], [0, '✗', 'خطأ']].map(([v, ic, t]) => { const cls = a ? (v === q.a ? 'right' : a.pick === v ? 'wrong' : 'dim') : ''; return `<button class="qopt ${cls}" data-act="qb-tf" data-v="${v}" ${a ? 'disabled' : ''}><span class="ql">${ic}</span><span class="qt">${t}</span></button>`; }).join('')}</div>`;
  } else if (x.opts) {
    body = `<div class="qopts">${x.opts.map((o, j) => { const cls = a ? (o.ok ? 'right' : a.pick === j ? 'wrong' : 'dim') : ''; return `<button class="qopt ${cls}" data-act="qb-pick" data-j="${j}" ${a ? 'disabled' : ''}><span class="ql">${'أبجد'[j]}</span><span class="qt">${qtext(o.t)}</span>${a && o.ok ? icon('check') : ''}</button>`; }).join('')}</div>`;
  } else if (q.k === 'num') {
    body = `<div class="qnum ${a ? (a.ok ? 'right' : 'wrong') : ''}"><input id="qb-in" inputmode="decimal" autocomplete="off" placeholder="اكتب الناتج" ${a ? `value="${esc(a.val)}" disabled` : ''}><span class="qu" dir="ltr">${esc(q.u || '')}</span></div>
      ${a ? '' : '<button class="btn primary qcheck" data-act="qb-num">تحقّق من الإجابة</button>'}`;
  } else if (q.k === 'card') {
    body = s.flip || a ? `<div class="qb-card-a">${q.a}</div>${a ? '' : `<p class="qb-ask">هل كانت إجابتك مثل هذه؟</p><div class="qb-self"><button class="btn" data-act="qb-self" data-v="0">✗ لم أعرفها</button><button class="btn primary" data-act="qb-self" data-v="1">✓ عرفتها</button></div>`}`
      : `<button class="qb-flip" data-act="qb-flip"><span>🃏</span><b>فكّر في الإجابة، ثم اضغط لكشفها</b></button>`;
  }
  if (q.img) body = `<button class="qb-img" data-act="qb-zoom" aria-label="تكبير الرسم"><img src="${q.img}" alt="رسم السؤال" loading="lazy"></button>` + body;
  if (q.aimg && (a || (q.k === 'card' && s.flip))) { const fig = `<div class="qb-img ans"><small>✓ الإجابة من البنك</small><img src="${q.aimg}" alt="رسم الإجابة" loading="lazy"></div>`; body = body.includes('<p class="qb-ask">') ? body.replace('<p class="qb-ask">', fig + '<p class="qb-ask">') : body + fig; }
  return { text, body };
}
function vBankRun() {
  const s = QB.s; if (!s) return `<div class="view push">${navBar()}<div class="live-msg"><div class="em">🏦</div><h1>اختر درساً من البنك</h1><button class="btn primary" data-act="back">رجوع</button></div></div>`;
  if (s.done) return qbResultHTML();
  const x = s.items[s.i], a = s.ans[s.i], q = x.q, { text, body } = qbQuestionHTML(x, a), sprint = s.mode === 'sprint';
  const head = `<div class="nav"><button class="circle" data-act="back" aria-label="خروج">${icon('back')}</button>
      <span class="qhead"><b>${esc(s.title)}</b><small>${sprint ? `النتيجة: ${s.score || 0}` : `سؤال ${s.i + 1} من ${s.items.length}`}</small></span>
      <span class="qstreak ${s.streak >= 2 ? 'hot' : ''}">🔥${s.streak}</span></div>`;
  const bar = sprint ? `<div class="qb-timer"><i id="qb-tbar" style="width:${s.left / QB_SPRINT * 100}%"></i><b id="qb-t">${s.left}</b></div>`
    : `<div class="qbar">${s.items.map((_, k) => `<i class="${s.ans[k] ? (s.ans[k].ok ? 'ok' : 'no') : k === s.i ? 'cur' : ''}"></i>`).join('')}</div>`;
  const fb = a && !sprint ? `<div class="qfb ${a.ok ? 'ok' : 'no'}"><b>${a.ok ? (s.streak >= 3 ? `رائع! ${s.streak} إجابات صحيحة متتالية 🔥` : ['أحسنت! ✨', 'إجابة صحيحة! 👏', 'ممتاز! 🌟'][s.i % 3]) : q.k === 'card' ? 'سجّلناها للمراجعة، ستعود إليك 📌' : 'إجابة غير صحيحة'}</b>
      ${a.ok && a.gain ? `<span class="qb-gain">+${a.gain} نقطة</span>` : ''}
      ${!a.ok && q.k === 'num' ? `<div class="qwhy"><small>الإجابة الصحيحة</small><bdi dir="ltr">${q.n} ${esc(q.u || '')}</bdi></div>` : ''}
      ${!a.ok && q.k === 'tf' ? `<div class="qwhy"><small>الصواب</small>العبارة ${q.a ? 'صحيحة' : 'غير صحيحة'} علمياً.</div>` : ''}
      ${q.w ? `<div class="qwhy"><small>${q.k === 'tf' ? 'التصحيح' : 'الحل'}</small>${q.w}</div>` : ''}
      <button class="btn primary" data-act="qb-next">${s.i + 1 < s.items.length ? 'السؤال التالي' : 'النتيجة'} ${icon('chev')}</button></div>` : '';
  return `<div class="view push qrun qbrun" style="--qc:${(x.c.c || [])[0] || '#4C86FF'}">${head}${bar}
    <div class="qcard qb-q" id="qb-q"><span class="qtype">${QB_KIC[q.k]} ${QB_KIND[q.k]}</span><span class="qb-src">الدرس (${x.l.id}) ${esc(x.l.t)}</span>
      <h2 class="qq">${text}</h2>${body}</div>${fb}</div>`;
}
function qbResultHTML() {
  const s = QB.s, sprint = s.mode === 'sprint', pct = s.pct, msg = sprint ? (s.newBest ? ['رقم قياسي جديد! 🏆', 'تفوقت على نفسك، حاول أن تكسره مرة أخرى.'] : ['انتهى الوقت! ⏱️', `رقمك القياسي ${QBR[qbRK()] || 0}. حاول أن تتجاوزه!`])
    : pct >= 90 ? ['أداء أسطوري! 🏆', 'أنت متمكن من هذه الأسئلة.'] : pct >= 70 ? ['أحسنت! 🌟', 'جولة أخرى وتتقن الدرس كله.'] : pct >= 50 ? ['بداية جيدة 💪', 'الأسئلة التي أخطأت فيها ستعود إليك لتتقنها.'] : ['لا بأس، هكذا نتعلم 📚', 'راجع الحلول ثم أعد المحاولة، ستتحسن بسرعة.'];
  const conf = pct >= 70 || s.newBest ? '<div class="confetti" aria-hidden="true">' + Array.from({ length: 30 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${(i % 7) * .12}s;--c:${['#2BD4B0', '#FFB020', '#FF4D7A', '#4C86FF', '#A866FF'][i % 5]}"></i>`).join('') + '</div>' : '';
  const wrong = s.items.map((x, k) => ({ x, a: s.ans[k] })).filter(o => o.a && !o.a.ok);
  return `<div class="view push qrun" style="--qc:#2BD4B0">${navBar()}
    <section class="qres">${conf}
      ${sprint ? `<span class="qr-ring"><b style="font-size:56px">${s.score || 0}</b><small>إجابة صحيحة في دقيقة</small></span>` : `<span class="qr-ring">${ring(pct, 150, pct >= 70 ? '#32D17A' : pct >= 50 ? '#FFB020' : '#FF6B6B', 12)}<b>${pct}%</b><small>${s.ok} من ${s.n}</small></span>`}
      <h1>${msg[0]}</h1><p>${msg[1]}</p>
      <div class="qr-stats"><div><b>${s.ok}</b><small>صحيحة</small></div><div><b>${s.n - s.ok}</b><small>خاطئة</small></div><div><b>🔥${s.best}</b><small>أطول سلسلة</small></div><div><b>+${s.xp}</b><small>نقطة</small></div></div>
      ${s.gained > 0 ? `<span class="qr-badge">👑 أتقنت ${s.gained} ${s.gained === 1 ? 'سؤالاً جديداً' : s.gained <= 10 ? 'أسئلة جديدة' : 'سؤالاً جديداً'}</span>` : ''}
      <span class="qr-badge" style="background:rgba(255,176,32,.14);color:#FFC34D">🎯 هدف اليوم ${Math.min(qbToday(), QB_GOAL)}/${QB_GOAL}${qbToday() >= QB_GOAL ? ' ✓' : ''}</span>
    </section>
    ${typeof prepResult === 'function' ? prepResult(s) : ''}
    <div class="actions">
      <button class="btn primary" data-act="qb-again">${icon('replay')}${sprint ? 'حاول مرة أخرى' : 'جولة جديدة'}</button>
      <button class="btn" data-act="back">${icon('exam')}البنك</button>
      <button class="btn wide" data-act="qb-share">${icon('share')}شارك نتيجتك وتحدَّ أصدقاءك</button>
    </div>
    ${wrong.length ? `<h2 class="sec">راجع ما أخطأت فيه</h2><div class="qlist">${wrong.map(({ x }) => `<details class="qli no"><summary><span class="n">✕</span><span class="t">${qtext(x.q.q)}</span></summary>
      <div class="qli-b">${x.q.img ? `<img class="qb-rimg" src="${x.q.img}" alt="" loading="lazy">` : ''}<p><span class="lbl">الإجابة الصحيحة:</span> ${x.q.k === 'tf' ? (x.q.a ? 'صح' : 'خطأ') : x.q.k === 'num' ? `<bdi dir="ltr">${x.q.n} ${esc(x.q.u || '')}</bdi>` : x.q.k === 'card' ? x.q.a : qtext(x.q.k === 'mcq' ? x.q.o[0] : x.q.a)}</p>${x.q.aimg ? `<img class="qb-rimg" src="${x.q.aimg}" alt="" loading="lazy">` : ''}${x.q.w ? `<div class="qwhy"><small>الحل</small>${x.q.w}</div>` : ''}</div></details>`).join('')}</div>` : ''}
  </div>`;
}
// repaint only the session view (keeps the page from jumping)
function qbPaint(scroll) {
  const top = S.stack[S.stack.length - 1]; if (!top || top.type !== 'bankrun') return;
  const v = document.querySelector('#app > .view'); if (!v) return render(false);
  const tmp = document.createElement('div'); tmp.innerHTML = vBankRun(); v.replaceWith(tmp.firstElementChild);
  if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
  const inp = document.getElementById('qb-in'); if (inp && !inp.disabled && matchMedia('(hover: hover)').matches) inp.focus();
  if (!scroll) { const fb = document.querySelector('.qfb'); if (fb) setTimeout(() => fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80); }
}
function qbAfterRender(top) {
  if (!(top && top.type === 'bankrun')) { clearInterval(QB.timer); QB.timer = 0; return; }
  const s = QB.s;
  if (s && s.mode === 'sprint' && !s.done && !QB.timer) QB.timer = setInterval(() => {
    if (!QB.s || QB.s !== s || s.done) { clearInterval(QB.timer); QB.timer = 0; return; }
    s.left = Math.max(0, QB_SPRINT - Math.floor((Date.now() - s.t0) / 1000));
    const t = document.getElementById('qb-t'), b = document.getElementById('qb-tbar'); if (t) { t.textContent = s.left; t.parentElement.classList.toggle('low', s.left <= 10); } if (b) b.style.width = (s.left / QB_SPRINT * 100) + '%';
    if (!s.left) qbFinish();
  }, 250);
}
const qbNum = v => parseFloat(String(v).trim().replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[٫,]/g, '.').replace(/[^\d.\-]/g, ''));
function qbAct(act, el) {
  const s = QB.s, d = el.dataset;
  if (act === 'qb-start') return qbStart(d.m, d.s);
  if (!s) return;
  const x = s.items[s.i];
  if (act === 'qb-pick') qbAnswer(x.opts[+d.j].ok, { pick: +d.j });
  else if (act === 'qb-tf') qbAnswer(+d.v === x.q.a, { pick: +d.v });
  else if (act === 'qb-num') {
    const v = (document.getElementById('qb-in') || {}).value || '', n = qbNum(v);
    if (!isFinite(n)) return toast('اكتب الناتج رقماً');
    const tol = x.q.tol != null ? x.q.tol : Math.max(.01, Math.abs(x.q.n) * .01);
    qbAnswer(Math.abs(n - x.q.n) <= tol + 1e-9, { val: v });
  }
  else if (act === 'qb-flip') { s.flip = true; qbPaint(); }
  else if (act === 'qb-zoom') el.classList.toggle('big');
  else if (act === 'qb-self') qbAnswer(d.v === '1');
  else if (act === 'qb-next') qbNext();
  else if (act === 'qb-again') qbStart(s.mode, s.scope);
  else if (act === 'qb-share') shareCard(s.mode === 'sprint' ? { big: `⚡${s.score || 0}`, title: 'تحدي الدقيقة في بنك الأسئلة', sub: `${G().name} · ${s.score || 0} إجابة صحيحة في 60 ثانية`, text: `أجبت ${s.score || 0} أسئلة صحيحة في دقيقة واحدة في بنك أسئلة الفيزياء على Physics Tube. هل تتغلب عليّ؟ https://physics-tube.com/` }
    : { big: `${s.pct}%`, title: s.title, sub: `${s.ok} من ${s.n} · بنك أسئلة ${G().name}`, text: `حصلت على ${s.pct}% في «${s.title}» من بنك أسئلة الفيزياء على Physics Tube. هل تتغلب عليّ؟ https://physics-tube.com/` });
}
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target && e.target.id === 'qb-in') { e.preventDefault(); const b = document.querySelector('[data-act="qb-num"]'); if (b) b.click(); } });

/* ---------- Entry cards ---------- */
function qbCard() {
  if (!qbBank()) return '';
  const all = qbAll(), st = qbStats(all), today = qbToday();
  return `<button class="qb-entry" data-go="bank"><span class="gi">🏦</span>
    <span class="t"><b>بنك الأسئلة</b><small>${all.length} سؤالاً · أتقنت ${st.done} · اليوم ${Math.min(today, QB_GOAL)}/${QB_GOAL}</small></span>
    <span class="qb-go">${today ? 'واصل' : 'ابدأ'} ${icon('chev')}</span></button>`;
}

// The home screen was drawn before this file loaded; draw it again with the bank card.
if (!S.stack.length) render(false);
