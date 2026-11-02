'use strict';
/* الشارات والشهادات: شارات يجمعها الطالب من نشاطه في التطبيق، وشهادات تقدير قابلة للتنزيل والطباعة.
   Everything is computed on the device from the stored progress (bank, quizzes, lab, games, leaderboard).
   Uses: store, S, G, GRADES, QBM, QBD, QBR, qbBank, qbAll, qbStats, qbPct, qbStreak, PROFILE, ADMIN, USER, render, sheet, toast, esc, icon, navBar. */

/* ---------- Counters the badges need ---------- */
let QBS = store.get('qbs', null);
if (!QBS) { const v = Object.values(store.get('qbm', {})); QBS = { ok: v.filter(b => b > 0).reduce((t, b) => t + b, 0), all: v.length + v.filter(b => b > 1).reduce((t, b) => t + b - 1, 0) }; store.set('qbs', QBS); }
function achCount(ok) { QBS.all++; if (ok) QBS.ok++; store.set('qbs', QBS); clearTimeout(achCount.t); achCount.t = setTimeout(achCheck, 900); }
function achLb(d) {
  if (!d || !d.me || ADMIN) return;
  const w = store.get('lbw', {}), k = String(d.week_start).slice(0, 10);
  if (!w[k] || d.me.r < w[k]) { w[k] = d.me.r; store.set('lbw', w); setTimeout(achCheck, 300); }
}

/* ---------- Badge list ---------- */
const TIER = { b: ['#E59866', 'برونزية'], s: ['#C0C7D4', 'فضية'], g: ['#FFD23F', 'ذهبية'], d: ['#7FDBFF', 'ماسية'] };
function achDefs() {
  const B = qbBank(), all = B ? qbAll() : [];
  const days = Object.values(store.get('qbd', {})), maxDay = days.length ? Math.max(...days) : 0;
  const sprint = Math.max(0, ...Object.keys(QBR).filter(k => k.startsWith('sprint')).map(k => +QBR[k] || 0));
  const lessonP = B ? B.flatMap(c => c.ls.map(l => qbPct(qbStats(all.filter(x => x.l.id === l.id))))) : [];
  const quiz = Object.values(store.get('quiz', {})), quizMax = quiz.length ? Math.max(...quiz.map(x => x.best || 0)) : 0;
  const sims = new Set(); Object.values(store.get('act', {})).forEach(d => (d.s || []).forEach(r => sims.add(r)));
  const stars = Object.values(store.get('games', {})).reduce((t, g) => t + Object.values(g || {}).reduce((a, b) => a + (+b || 0), 0), 0);
  const lbw = Object.values(store.get('lbw', {})), xp = +store.get('xp', 0) || 0, ready = +store.get('prepTop', 0) || 0;
  const st = qbStreak(), gs = (GRADES[S.grade] || {}).short || '';
  const L = [
    ['first', '🌱', 'أول خطوة', 'أجب عن أول سؤال في بنك الأسئلة', QBS.all, 1, 'b'],
    ['ok50', '✅', 'منطلق', '50 إجابة صحيحة في بنك الأسئلة', QBS.ok, 50, 'b'],
    ['ok250', '💪', 'مجتهد', '250 إجابة صحيحة', QBS.ok, 250, 's'],
    ['ok1000', '🧠', 'عالِم صغير', '1000 إجابة صحيحة', QBS.ok, 1000, 'g'],
    ['goal', '🎯', 'هدف اليوم', 'أجب عن 20 سؤالاً في يوم واحد', maxDay, 20, 'b'],
    ['streak3', '🔥', 'ثلاثة أيام', 'ادرس من البنك 3 أيام متتالية', st, 3, 'b'],
    ['streak7', '⚡', 'أسبوع كامل', 'ادرس من البنك 7 أيام متتالية', st, 7, 's'],
    ['streak30', '🌋', 'شهر من الالتزام', 'ادرس من البنك 30 يوماً متتالياً', st, 30, 'd'],
    ['sprint10', '⏱️', 'سريع البديهة', '10 إجابات صحيحة في تحدي الدقيقة', sprint, 10, 's'],
    ['sprint20', '🚀', 'البرق', '20 إجابة صحيحة في تحدي الدقيقة', sprint, 20, 'g'],
    ['lesson', '👑', 'أتقنت درساً', 'أتقن كل أسئلة درس واحد في البنك', lessonP.length ? Math.max(...lessonP) : 0, 100, 's', '%'],
  ];
  (B || []).forEach((c, ci) => L.push([`ch.${S.grade}.${ci}`, c.ic, `بطل ${c.ch}`, `أتقن 90% من أسئلة فصل «${c.ch}» · ${gs}`, qbPct(qbStats(all.filter(x => x.ci === ci))), 90, 'g', '%', { cert: 'chapter', ch: c.ch }]));
  if (B) L.push([`bank.${S.grade}`, '💎', 'سيد البنك', `أتقن 90% من بنك أسئلة ${gs} كاملاً`, qbPct(qbStats(all)), 90, 'd', '%', { cert: 'bank' }]);
  L.push(
    ['ready', '🎓', 'جاهز للفاينال', 'اوصل إلى جاهزية 90% في «جهّزني للفاينال»', ready, 90, 'g', '%', { cert: 'ready' }],
    ['quiz100', '💯', 'العلامة الكاملة', 'احصل على 100% في نموذج من «جهّزني للاختبار القصير»', quizMax, 100, 's', '%'],
    ['lab5', '🧪', 'مستكشف المختبر', 'جرّب 5 تجارب مختلفة في المختبر', sims.size, 5, 'b'],
    ['stars20', '🎮', 'لاعب الفيزياء', 'اجمع 20 نجمة في ألعاب الفيزياء', stars, 20, 's'],
    ['top3', '🏆', 'من أبطال الأسبوع', 'كن من الثلاثة الأوائل في لوحة المتصدرين', lbw.filter(r => r <= 3).length, 1, 'g', '', { cert: 'top3' }],
    ['champ', '🥇', 'المتصدر', 'احصل على المركز الأول في لوحة المتصدرين', lbw.filter(r => r === 1).length, 1, 'd', '', { cert: 'champ' }],
    ['xp1000', '⭐', 'ألف نقطة', 'اجمع 1000 نقطة في التطبيق', xp, 1000, 's'],
  );
  return L.map(([id, ic, t, d, cur, goal, tier, unit, extra]) => Object.assign({ id, ic, t, d, cur: Math.min(+cur || 0, goal), goal, tier, unit: unit || '', ok: (+cur || 0) >= goal }, extra || {}));
}
let ACH = store.get('ach', null);
function achCheck(quiet) {
  const defs = achDefs(), first = !ACH; ACH = ACH || {};
  const fresh = defs.filter(b => b.ok && !ACH[b.id]);
  if (!fresh.length) { if (first) store.set('ach', ACH); return; }
  fresh.forEach(b => { ACH[b.id] = Date.now(); }); store.set('ach', ACH);
  if (quiet) return;
  // the first time this runs for an existing student, sum up instead of celebrating each one
  if (first && fresh.length > 1) return setTimeout(() => toast(`🎖️ حصلت على ${fresh.length} شارات! شاهدها في «حسابي»`), 600);
  const top = S.stack[S.stack.length - 1];
  if (top && top.type === 'bankrun' && QB.s && !QB.s.done) { ACH_PENDING.push(...fresh); return; }
  achCelebrate(fresh);
}
const ACH_PENDING = [];
function achFlush() { if (ACH_PENDING.length) { const f = ACH_PENDING.splice(0); setTimeout(() => achCelebrate(f), 500); } }
function achCelebrate(list) {
  // wait for another celebration (e.g. a new rank) or an open sheet to close first
  if (document.querySelector('.celebrate') || document.querySelector('#layer .sheet')) return setTimeout(() => achCelebrate(list), 1500);
  const top = S.stack[S.stack.length - 1];
  if (top && top.type === 'bankrun' && QB.s && !QB.s.done) { ACH_PENDING.push(...list); return; }
  const b = list[0], c = TIER[b.tier][0];
  sheet(`<div class="ach-cel" style="--tc:${c}">
    <div class="confetti" aria-hidden="true">${Array.from({ length: 26 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${(i % 7) * .1}s;--c:${['#FFD23F', '#2BD4B0', '#FF4D7A', '#4C86FF', '#A866FF'][i % 5]}"></i>`).join('')}</div>
    <small>شارة ${TIER[b.tier][1]} جديدة</small>
    <div class="ach-medal big"><span>${b.ic}</span></div>
    <h2>${esc(b.t)}</h2><p>${esc(b.d)}</p>
    ${list.length > 1 ? `<p class="more">و${list.length - 1} ${list.length === 2 ? 'شارة أخرى' : 'شارات أخرى'} 🎉</p>` : ''}
    ${b.cert ? `<button class="btn primary wide" data-act="ach-cert" data-id="${b.id}">🎖️ احصل على شهادتك</button>` : ''}
    <button class="btn ${b.cert ? '' : 'primary'} wide" data-go="badges" style="margin-top:8px">كل شاراتي</button>
  </div>`, 'ach-sheet');
}

/* ---------- Views ---------- */
function achCard() {
  const d = achDefs(), n = d.filter(b => b.ok || (ACH && ACH[b.id])).length;
  const next = d.filter(b => !b.ok).sort((a, b) => b.cur / b.goal - a.cur / a.goal)[0];
  return `<button class="ach-entry" data-go="badges"><span class="gi">🎖️</span><span class="t"><b>شاراتي وشهاداتي</b><small>${n} من ${d.length} شارة${next ? ` · التالية: ${next.ic} ${esc(next.t)}` : ' · أكملتها كلها! 👑'}</small></span><span class="qb-go">شاهد ${icon('chev')}</span></button>`;
}
function vBadges() {
  const d = achDefs(), got = b => b.ok || (ACH && ACH[b.id]), n = d.filter(got).length, pct = Math.round(n / d.length * 100);
  const certs = d.filter(b => b.cert && got(b));
  const tile = b => { const on = got(b), p = Math.round(b.cur / b.goal * 100);
    return `<button class="ach ${on ? 'on' : ''}" style="--tc:${TIER[b.tier][0]}" data-act="ach-info" data-id="${b.id}">
      <span class="ach-medal"><span>${b.ic}</span>${on ? '' : '<i class="lk">🔒</i>'}</span><b>${esc(b.t)}</b>
      ${on ? `<small>${ACH && ACH[b.id] ? new Date(ACH[b.id]).toLocaleDateString('ar-KW-u-nu-latn', { day: 'numeric', month: 'short' }) : 'حصلت عليها'}</small>` : `<span class="ach-p"><i style="width:${p}%"></i></span><small><bdi dir="ltr">${b.cur}${b.unit} / ${b.goal}${b.unit}</bdi></small>`}
    </button>`; };
  return `<div class="view push ach-v">${navBar()}
    <section class="ach-hero"><div><small>${esc(G().name)}</small><h1>شاراتي</h1><p>${n} من ${d.length} شارة · استمر لتجمعها كلها!</p></div>
      <span class="ach-ring">${ring(pct, 96, '#FFD23F', 9)}<b>${pct}%</b></span></section>
    <h2 class="sec">🎖️ شهاداتي <small>${certs.length ? 'اضغط لتنزيلها أو طباعتها' : ''}</small></h2>
    ${certs.length ? `<div class="ach-certs">${certs.map(b => `<button class="ach-cert" data-act="ach-cert" data-id="${b.id}"><span>📜</span><b>${esc(achCertText(b).title)}</b><small>${esc(achCertText(b).reason)}</small></button>`).join('')}</div>`
      : `<p class="td-empty">تحصل على شهادة تقدير عندما تتقن فصلاً كاملاً من بنك الأسئلة، أو تصل إلى جاهزية 90% قبل الاختبار، أو تصبح من أبطال الأسبوع في لوحة المتصدرين 🏆</p>`}
    <h2 class="sec">الشارات</h2>
    <div class="ach-grid">${d.map(tile).join('')}</div>
  </div>`;
}

/* ---------- Certificates ---------- */
function achCertText(b) {
  const gs = (GRADES[S.grade] || G()).name;
  if (b.cert === 'chapter') return { title: 'شهادة إتقان', reason: `تقديراً لإتقان أسئلة فصل «${b.ch}» في بنك الأسئلة`, grade: gs };
  if (b.cert === 'bank') return { title: 'شهادة تميّز', reason: 'تقديراً لإتقان بنك أسئلة الفيزياء كاملاً', grade: gs };
  if (b.cert === 'ready') return { title: 'شهادة تقدير', reason: 'تقديراً للوصول إلى جاهزية 90% استعداداً للفاينال', grade: gs };
  if (b.cert === 'champ') return { title: 'شهادة تميّز', reason: 'تقديراً للحصول على المركز الأول في لوحة المتصدرين الأسبوعية', grade: gs };
  return { title: 'شهادة تقدير', reason: 'تقديراً للتميّز بين أبطال الأسبوع في لوحة المتصدرين', grade: gs };
}
const CERT_F = '"SF Arabic","Geeza Pro","Noto Naskh Arabic","Noto Sans Arabic","Segoe UI",Tahoma,Arial,sans-serif';
function certCanvas(o) {
  const W = 1600, H = 1130, c = document.createElement('canvas'); c.width = W; c.height = H; c.dir = 'rtl';
  const x = c.getContext('2d'), NAVY = '#16235C', GOLD = '#C9A227', DARK = '#8A6D1A';
  const bg = x.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#FFFDF6'); bg.addColorStop(1, '#F4EAD2'); x.fillStyle = bg; x.fillRect(0, 0, W, H);
  // watermark atom
  x.save(); x.globalAlpha = .06; x.strokeStyle = NAVY; x.lineWidth = 7; x.translate(W / 2, H / 2 + 50);
  for (let i = 0; i < 3; i++) { x.rotate(Math.PI / 3); x.beginPath(); x.ellipse(0, 0, 360, 130, 0, 0, Math.PI * 2); x.stroke(); }
  x.fillStyle = NAVY; x.beginPath(); x.arc(0, 0, 30, 0, Math.PI * 2); x.fill(); x.restore();
  // frames
  x.strokeStyle = NAVY; x.lineWidth = 16; x.strokeRect(34, 34, W - 68, H - 68);
  x.strokeStyle = GOLD; x.lineWidth = 4; x.strokeRect(64, 64, W - 128, H - 128);
  x.strokeStyle = GOLD; x.lineWidth = 1.5; x.strokeRect(76, 76, W - 152, H - 152);
  [[64, 64], [W - 64, 64], [64, H - 64], [W - 64, H - 64]].forEach(([a, b]) => { x.save(); x.translate(a, b); x.rotate(Math.PI / 4); x.fillStyle = GOLD; x.fillRect(-18, -18, 36, 36); x.fillStyle = NAVY; x.fillRect(-8, -8, 16, 16); x.restore(); });
  const T = (s, y, font, col, maxW) => { x.font = font; x.fillStyle = col; let f = font; if (maxW) { let sz = parseInt(font.match(/(\d+)px/)[1], 10); while (x.measureText(s).width > maxW && sz > 20) { sz -= 2; f = font.replace(/\d+px/, sz + 'px'); x.font = f; } } x.fillText(s, W / 2, y); };
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'ltr';
  T('PHYSICS TUBE', 140, `800 30px ${CERT_F}`, NAVY);
  x.direction = 'rtl';
  T(`${o.grade} · مادة الفيزياء`, 186, `600 26px ${CERT_F}`, DARK);
  T(o.title, 290, `800 96px ${CERT_F}`, NAVY);
  x.strokeStyle = GOLD; x.lineWidth = 3; x.beginPath(); x.moveTo(W / 2 - 230, 360); x.lineTo(W / 2 + 230, 360); x.stroke();
  x.fillStyle = GOLD; x.beginPath(); x.arc(W / 2, 360, 7, 0, Math.PI * 2); x.fill();
  T('تُمنح هذه الشهادة إلى', 420, `500 34px ${CERT_F}`, '#4A4A4A');
  T(o.name, 520, `800 86px ${CERT_F}`, '#A07A12', 1150);
  x.strokeStyle = 'rgba(160,122,18,.45)'; x.lineWidth = 2; x.beginPath(); x.moveTo(W / 2 - 360, 585); x.lineTo(W / 2 + 360, 585); x.stroke();
  // reason (wrap to two lines if needed)
  x.font = `600 40px ${CERT_F}`; const words = o.reason.split(' '); let lines = [''];
  words.forEach(w => { const t = (lines[lines.length - 1] + ' ' + w).trim(); if (x.measureText(t).width > 1180 && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = t; });
  lines.slice(0, 2).forEach((s, i) => T(s, 660 + i * 58 - (lines.length > 1 ? 18 : 0), `600 40px ${CERT_F}`, '#24243A'));
  T('مع أطيب التمنيات بدوام التفوق والنجاح', 770, `500 30px ${CERT_F}`, '#666');
  // seal
  const sx = W / 2, sy = 925; x.save(); x.translate(sx, sy); x.fillStyle = GOLD; x.beginPath();
  for (let i = 0; i < 48; i++) { const r = i % 2 ? 92 : 104, a = i / 48 * Math.PI * 2; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.fill();
  x.fillStyle = '#E8C547'; x.beginPath(); x.arc(0, 0, 80, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#FFF5CC'; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, 70, 0, Math.PI * 2); x.stroke();
  x.fillStyle = NAVY; x.font = `800 38px ${CERT_F}`; x.textAlign = 'center'; x.fillText('★', 0, -26); x.font = `800 30px ${CERT_F}`; x.fillText(o.badge || 'تميّز', 0, 16); x.restore();
  // date (right) and signature (left)
  x.textAlign = 'center'; x.font = `500 26px ${CERT_F}`; x.fillStyle = '#666'; x.fillText('التاريخ', W - 330, 900);
  x.font = `700 32px ${CERT_F}`; x.fillStyle = NAVY; x.fillText(o.date, W - 330, 948);
  x.strokeStyle = '#999'; x.lineWidth = 2; x.beginPath(); x.moveTo(190, 948); x.lineTo(470, 948); x.stroke();
  x.font = `700 30px ${CERT_F}`; x.fillStyle = NAVY; x.fillText(o.sign || 'معلم مادة الفيزياء', 330, 985);
  if (o.signName) { x.font = `italic 600 34px ${CERT_F}`; x.fillStyle = '#2B3A7A'; x.fillText(o.signName, 330, 915); }
  return c;
}
const certDate = () => new Date().toLocaleDateString('ar-KW-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' });
let CERT_LAST = null;
function certShow(o) {
  const c = certCanvas(o), url = c.toDataURL('image/png'); CERT_LAST = { c, o };
  sheet(`<div class="cert-view"><h2>🎖️ ${esc(o.title)}</h2>
    <img src="${url}" alt="${esc(o.title)} باسم ${esc(o.name)}">
    <div class="cert-acts"><button class="btn primary" data-act="cert-dl">⬇︎ تنزيل</button><button class="btn" data-act="cert-share">${icon('share')}مشاركة</button><button class="btn" data-act="cert-print">🖨️ طباعة</button></div>
    ${o.edit ? `<button class="btn wide" data-act="ach-name" style="margin-top:8px">✏️ تعديل الاسم</button>` : ''}</div>`, 'cert-sheet');
}
function achCert(id, askName) {
  const b = achDefs().find(x => x.id === id); if (!b || !(b.ok || (ACH && ACH[b.id]))) return;
  const nm = (PROFILE && PROFILE.full_name) || store.get('certName', '') || S.name || '';
  if (!nm || askName) return sheet(`<h2>اسمك على الشهادة</h2><p>اكتب اسمك كما تريد أن يظهر على الشهادة.</p>
    <div class="field" style="margin-top:12px"><input id="cert-nm" maxlength="40" value="${esc(nm)}" placeholder="الاسم الثلاثي"></div>
    <button class="btn primary wide" data-act="ach-name-ok" data-id="${id}" style="margin-top:12px">إنشاء الشهادة</button>`);
  const t = achCertText(b);
  certShow(Object.assign({ name: nm, date: certDate(), badge: b.cert === 'chapter' || b.cert === 'ready' ? 'إتقان' : 'تميّز', edit: !(PROFILE && PROFILE.full_name), id }, t));
}
function certFile(cb) { CERT_LAST.c.toBlob(bl => cb(new File([bl], 'physics-tube-certificate.png', { type: 'image/png' })), 'image/png'); }
function achAct(act, el) {
  if (act === 'ach-info') {
    const b = achDefs().find(x => x.id === el.dataset.id); if (!b) return;
    const on = b.ok || (ACH && ACH[b.id]);
    sheet(`<div class="ach-cel" style="--tc:${TIER[b.tier][0]}"><small>شارة ${TIER[b.tier][1]}</small><div class="ach-medal big ${on ? '' : 'off'}"><span>${on ? b.ic : '🔒'}</span></div>
      <h2>${esc(b.t)}</h2><p>${esc(b.d)}</p>${on ? '<p class="more">✓ حصلت عليها</p>' : `<span class="ach-p wide"><i style="width:${Math.round(b.cur / b.goal * 100)}%"></i></span><p class="more">${b.cur}${b.unit} من ${b.goal}${b.unit}</p>`}
      ${on && b.cert ? `<button class="btn primary wide" data-act="ach-cert" data-id="${b.id}">🎖️ شهادتك</button>` : ''}</div>`, 'ach-sheet');
  }
  else if (act === 'ach-cert') achCert(el.dataset.id);
  else if (act === 'ach-name') achCert(CERT_LAST && CERT_LAST.o.id, true);
  else if (act === 'ach-name-ok') { const v = (document.getElementById('cert-nm').value || '').trim(); if (v.length < 3) return toast('اكتب اسمك'); store.set('certName', v); achCert(el.dataset.id); }
}
function certAct(act) {
  if (!CERT_LAST) return;
  if (act === 'cert-dl') { const a = document.createElement('a'); a.href = CERT_LAST.c.toDataURL('image/png'); a.download = 'physics-tube-certificate.png'; document.body.appendChild(a); a.click(); a.remove(); toast('تم تنزيل الشهادة'); }
  else if (act === 'cert-share') certFile(f => { if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f], text: `${CERT_LAST.o.title} من Physics Tube 🎖️` }).catch(() => {}); else certAct('cert-dl'); });
  else if (act === 'cert-print') {
    const w = window.open('', '_blank'); if (!w) return toast('اسمح بالنوافذ المنبثقة للطباعة، أو نزّل الشهادة واطبعها');
    w.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>شهادة</title><style>@page{size:A4 landscape;margin:0}html,body{margin:0;height:100%}img{width:100%;height:100%;object-fit:contain;display:block}</style></head><body><img src="${CERT_LAST.c.toDataURL('image/png')}" onload="setTimeout(()=>{print()},200)"></body></html>`);
    w.document.close();
  }
}

/* ---------- Teacher: issue a certificate to any student from the dashboard ---------- */
const CERT_REASONS = ['تقديراً للتفوق والتميّز في مادة الفيزياء', 'تقديراً للحصول على المركز الأول في لوحة المتصدرين الأسبوعية', 'تقديراً للتميّز بين أبطال الأسبوع في لوحة المتصدرين', 'تقديراً للالتزام والمثابرة في حل أسئلة بنك الأسئلة', 'تقديراً للتفوق في الاختبار القصير', 'تقديراً للتحسّن الملحوظ في مادة الفيزياء'];
function certTeacher(p) {
  sheet(`<h2>🎖️ إصدار شهادة</h2><p>للطالب: <b>${esc(p.full_name)}</b></p>
    <div style="display:grid;gap:12px;margin-top:14px">
      <div class="field"><label for="ct-t">نوع الشهادة</label><select id="ct-t"><option>شهادة تقدير</option><option>شهادة تميّز</option><option>شهادة إتقان</option><option>شهادة شكر</option></select></div>
      <div class="field"><label for="ct-r">سبب منح الشهادة</label><select id="ct-r">${CERT_REASONS.map(r => `<option>${esc(r)}</option>`).join('')}<option value="">سبب آخر…</option></select></div>
      <div class="field"><label for="ct-o">أو اكتب سبباً آخر (اختياري)</label><input id="ct-o" maxlength="70" placeholder="مثال: تقديراً لإتقان فصل الطاقة"></div>
      <div class="field"><label for="ct-s">التوقيع (اسم المعلم، اختياري)</label><input id="ct-s" maxlength="30" value="${esc(store.get('certSign', ''))}" placeholder="مثال: أ. محمد"></div>
      <button class="btn primary wide" data-act="ct-make" data-id="${p.id}">إنشاء الشهادة</button></div>`);
}
function certTeacherMake(id) {
  const p = (ADMIN_DATA.students || []).find(x => x.id === id); if (!p) return;
  const v = k => (document.getElementById(k).value || '').trim(), reason = v('ct-o') || v('ct-r'), sign = v('ct-s');
  if (!reason) return toast('اختر سبب الشهادة أو اكتبه');
  store.set('certSign', sign);
  const title = v('ct-t');
  certShow({ name: p.full_name, title, reason, grade: (GRADES[p.grade] || G()).name, date: certDate(), signName: sign, badge: title.includes('إتقان') ? 'إتقان' : title.includes('شكر') ? 'شكر' : 'تميّز' });
}

/* check once on start (quietly: no pop-ups when the app opens) */
setTimeout(() => achCheck(true), 1500);
