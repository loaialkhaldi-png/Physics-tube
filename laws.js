'use strict';
/* ورقة القوانين: قوانين كل درس كما وردت في حلول بنوك الأسئلة (التوجيه الفني للعلوم) للصفوف الثلاثة.
   n: اسم القانون · f: الصيغة · u: الوحدة أو ملاحظة من البنك. Uses: S, G, esc, icon, navBar, render, store, toast. */
const LAWS_DATA = {
  g10: [
    { ch: 'علم الفيزياء', ic: '🔭', ls: [
      { id: '1-2', t: 'الكميات الفيزيائية', L: [
        { n: 'أبعاد السرعة', f: '[L/T]', u: 'm/s' },
        { n: 'أبعاد التسارع', f: '[L/T²] = [LT⁻²]', u: 'm/s²' },
        { n: 'أبعاد القوة (F = m.a)', f: '[ML/T²]', u: 'N' },
        { n: 'أبعاد المساحة', f: '[L²]', u: 'm²' },
        { n: 'أبعاد الحجم', f: '[L³]', u: 'm³' },
        { n: 'أبعاد الكثافة (الكتلة ÷ الحجم)', f: '[M/L³]' },
        { n: 'الكميات الأساسية', f: '[L] ، [M] ، [T]', u: 'الطول m ، الكتلة kg ، الزمن s' },
        { n: 'تحويل السرعة من km/h إلى m/s', f: 'v = (km/h) × 1000 ÷ 3600', u: 'مثال: 54 km/h = 15 m/s' },
      ] },
    ] },
    { ch: 'الحركة في بعد واحد', ic: '🏃', ls: [
      { id: '2-1', t: 'الكميات الفيزيائية العددية والمتجهة', L: [
        { n: 'السرعة العددية', f: 'v = d ÷ t', u: 'm/s · d المسافة المقطوعة' },
        { n: 'السرعة المتجهة', f: 'v = Δx ÷ t', u: 'm/s · Δx الإزاحة' },
        { n: 'التسارع', f: 'a = (v − v₀) ÷ t', u: 'm/s² · سالب عندما تتناقص السرعة' },
        { n: 'المسافة بسرعة ثابتة', f: 'd = v × t' },
      ] },
      { id: '2-2', t: 'معادلات الحركة المتسارعة بانتظام', L: [
        { n: 'المعادلة الأولى', f: 'v = v₀ + a t' },
        { n: 'المعادلة الثانية', f: 'Δx = v₀ t + ½ a t²' },
        { n: 'المعادلة الثالثة', f: 'v² = v₀² + 2 a Δx' },
        { n: 'ميل منحنى (v – t)', f: 'slope = Δv ÷ Δt = a' },
        { n: 'ميل منحنى (Δx – t²) من السكون', f: 'slope = ½ a' },
        { n: 'ميل منحنى (v² – Δx) من السكون', f: 'slope = 2a' },
      ] },
      { id: '2-3', t: 'السقوط الحر', L: [
        { n: 'السرعة', f: 'v = v₀ + g t', u: 'من السكون: v = g t' },
        { n: 'الإزاحة الرأسية', f: 'Δy = v₀ t + ½ g t²', u: 'من السكون: h = ½ g t²' },
        { n: 'السرعة والإزاحة', f: 'v² = v₀² + 2 g Δy' },
        { n: 'أقصى ارتفاع لجسم مقذوف لأعلى', f: 'h = v₀² ÷ 2g' },
        { n: 'زمن الصعود لأقصى ارتفاع', f: 't = v₀ ÷ g', u: 'زمن التحليق = 2 × زمن الصعود' },
        { n: 'زمن السقوط من ارتفاع h', f: 't = √(2h ÷ g)' },
        { n: 'تسارع الجاذبية الأرضية', f: 'g ≈ 10 m/s²', u: 'أو 9.8 m/s² حسب المسألة' },
      ] },
    ] },
    { ch: 'الحركة في بعدين', ic: '🎯', ls: [
      { id: '3-1', t: 'خصائص المتجهات', L: [
        { n: 'التمثيل الحسابي للمتجه', f: 'A = (المقدار , الزاوية)', u: 'مثال: (120 km/h , 130°)' },
        { n: 'طول المتجه عند تمثيله بيانياً', f: 'الطول = المقدار ÷ مقياس الرسم', u: 'مثال: 2.5 km بمقياس 1km:1cm = 2.5 cm' },
      ] },
      { id: '3-2', t: 'جمع المتجهات وتحليلها', L: [
        { n: 'متجهان في نفس الاتجاه', f: 'F_net = F₁ + F₂' },
        { n: 'متجهان متعاكسان', f: 'F_net = F₁ − F₂', u: 'باتجاه المتجه الأكبر' },
        { n: 'محصلة متجهين متعامدين', f: 'F = √(Fx² + Fy²)' },
        { n: 'اتجاه المحصلة', f: 'tanθ = Fy ÷ Fx' },
        { n: 'المركبة الأفقية', f: 'Fx = F cosθ' },
        { n: 'المركبة الرأسية', f: 'Fy = F sinθ' },
      ] },
      { id: '3-3', t: 'ضرب المتجهات', L: [
        { n: 'الضرب العددي (القياسي)', f: 'A · B = AB cosθ', u: 'ناتجه كمية عددية · إبدالي' },
        { n: 'الضرب الاتجاهي', f: 'A × B = AB sinθ', u: 'ناتجه متجه · يُحدد اتجاهه بقاعدة اليد اليمنى · غير إبدالي' },
        { n: 'تساوي مقداري الضربين', f: 'θ = 45°' },
      ] },
      { id: '3-4', t: 'حركة المقذوفات', L: [
        { n: 'السرعة الأفقية (ثابتة)', f: 'v_x = v₀ cosθ' },
        { n: 'السرعة الرأسية', f: 'v_y = v₀ sinθ + g t' },
        { n: 'زمن الوصول لأقصى ارتفاع', f: 't_h = v₀ sinθ ÷ g', u: 'زمن التحليق T = 2 t_h' },
        { n: 'أقصى ارتفاع', f: 'h_max = (v₀ sinθ)² ÷ 2g' },
        { n: 'المدى الأفقي', f: 'R = v₀² sin2θ ÷ g', u: 'أكبر مدى عند 45° · زاويتان مجموعهما 90° لهما نفس المدى' },
        { n: 'الإطلاق الأفقي من ارتفاع', f: 'h = ½ g t² ، Δx = v₀ₓ × t' },
        { n: 'السرعة الكلية', f: 'v = √(v_x² + v_y²)' },
      ] },
    ] },
  ],
  g11: [
    { ch: 'حركة المقذوفات', ic: '🎯', ls: [
      { id: '1-1', t: 'الكميات العددية والكميات المتجهة', L: [
        { n: 'محصلة متجهين بينهما زاوية θ', f: 'R = √(A² + B² + 2AB cosθ)' },
        { n: 'اتجاه المحصلة', f: 'sinα = B sinθ / R' },
        { n: 'محصلة متجهين متعامدين', f: 'R = √(A² + B²) ، tanθ = B / A' },
        { n: 'في نفس الاتجاه (θ = 0°)', f: 'R = F₁ + F₂' },
        { n: 'متعاكسان (θ = 180°)', f: 'R = F₁ − F₂' },
        { n: 'الضرب العددي', f: 'A·B = AB cosθ' },
        { n: 'الضرب الاتجاهي', f: '|A×B| = AB sinθ' },
      ] },
      { id: '2-1', t: 'تحليل المتجهات', L: [
        { n: 'المركبة الأفقية', f: 'Fₓ = F cosθ' },
        { n: 'المركبة الرأسية', f: 'Fᵧ = F sinθ' },
        { n: 'المحصلة من المركبات', f: 'F = √(ΣFₓ² + ΣFᵧ²)' },
        { n: 'اتجاه المحصلة', f: 'tanθ = ΣFᵧ / ΣFₓ' },
        { n: 'الوزن على مستوى مائل (موازية للمستوى)', f: 'F₁ = W sinθ' },
        { n: 'الوزن على مستوى مائل (عمودية على المستوى)', f: 'F₂ = W cosθ' },
      ] },
      { id: '3-1', t: 'حركة القذيفة', L: [
        { n: 'السرعة الأفقية', f: 'vₓ = v₀ cosθ' },
        { n: 'السرعة الرأسية الابتدائية', f: 'vᵧ = v₀ sinθ' },
        { n: 'زمن الوصول لأقصى ارتفاع', f: 't = v₀ sinθ / g' },
        { n: 'أقصى ارتفاع', f: 'h = v₀² sin²θ / 2g' },
        { n: 'المدى الأفقي', f: 'R = v₀² sin2θ / g' },
        { n: 'الإطلاق الأفقي', f: 'Δy = ½ g t² ، Δx = v × t' },
      ] },
    ] },
    { ch: 'الحركة الدائرية', ic: '🌀', ls: [
      { id: '1-2', t: 'الحركة الدائرية', L: [
        { n: 'السرعة الخطية', f: 'v = 2πr / T' },
        { n: 'السرعة الخطية بدلالة عدد الدورات', f: 'v = 2πrN / t' },
        { n: 'السرعة الزاوية', f: 'ω = 2π / T = 2πN / t', u: 'rad/s' },
        { n: 'العلاقة بين السرعة الخطية والزاوية', f: 'v = ω × r' },
        { n: 'زمن الدورة', f: 'T = 2π / ω' },
        { n: 'التسارع المركزي', f: 'a_c = v² / r = 4π²r / T²', u: 'm/s²' },
        { n: 'التسارع الخطي', f: 'a = Δv / Δt' },
        { n: 'التسارع الزاوي', f: 'θ″ = Δω / Δt' },
      ] },
      { id: '2-2', t: 'القوة الجاذبة المركزية', L: [
        { n: 'القوة الجاذبة المركزية', f: 'F_c = m × v² / r = m × a_c', u: 'N' },
        { n: 'معامل الاحتكاك', f: 'μ = f / N' },
      ] },
    ] },
    { ch: 'مركز الثقل', ic: '⚖️', ls: [
      { id: '3-3', t: 'تحديد موضع مركز الكتلة أو مركز الثقل', L: [
        { n: 'الإحداثي السيني لمركز الكتلة', f: 'x = (m₁x₁ + m₂x₂ + …) / (m₁ + m₂ + …)' },
        { n: 'الإحداثي الصادي لمركز الكتلة', f: 'y = (m₁y₁ + m₂y₂ + …) / (m₁ + m₂ + …)' },
      ] },
    ] },
  ],
  g12: [
    { ch: 'الطاقة', ic: '⚡', ls: [
      { id: '1-1', t: 'الشغل', L: [
        { n: 'شغل قوة منتظمة', f: 'W = F d cosθ', u: 'J = N·m · ينعدم عند θ = 90°' },
        { n: 'قوة الوزن', f: 'F = m g' },
        { n: 'ارتفاع الجسم على مستوى مائل', f: 'h = d sinθ' },
        { n: 'شغل الوزن على مستوى مائل', f: 'W = m g d sinθ' },
        { n: 'شغل الوزن عند الإزاحة الرأسية', f: 'W = m g Δh', u: 'سالب عند الصعود · لا يتوقف على شكل المسار' },
        { n: 'شغل قوة الاحتكاك', f: 'W = f d cos180 = −f d' },
        { n: 'قانون النابض', f: 'F = K Δx', u: 'K بوحدة N/m' },
        { n: 'الشغل المبذول على النابض', f: 'W = ½ K Δx² = ½ F Δx' },
        { n: 'الشغل من منحنى (F – x)', f: 'W = المساحة تحت المنحنى' },
        { n: 'الشغل الكلي', f: 'W_T = W₁ + W₂ + …', u: 'صفر عندما تكون السرعة ثابتة' },
      ] },
      { id: '1-2', t: 'الشغل والطاقة', L: [
        { n: 'الطاقة الحركية', f: 'KE = ½ m v²', u: 'J = kg.m²/s²' },
        { n: 'نظرية الشغل والطاقة', f: 'W = ΔKE' },
        { n: 'الطاقة الكامنة التثاقلية', f: 'PE = m g h' },
        { n: 'شغل الوزن والطاقة الكامنة', f: 'W = −ΔPE' },
        { n: 'الطاقة الكامنة المرنة (نابض)', f: 'PE = ½ k Δx²' },
        { n: 'الطاقة الكامنة المرنة (خيط مطاطي)', f: 'PE = ½ C Δθ²', u: 'C بوحدة N.m/rad²' },
        { n: 'الطاقة الميكانيكية', f: 'ME = PE + KE = m g h + ½ m v²' },
        { n: 'الطاقة الكلية', f: 'E = ME + U' },
      ] },
      { id: '1-3', t: 'حفظ (بقاء) الطاقة', L: [
        { n: 'حفظ الطاقة الميكانيكية (نظام معزول بإهمال الاحتكاك)', f: 'ΔME = 0 ⇒ ME₁ = ME₂ ⇒ KE₁ + PE₁ = KE₂ + PE₂' },
        { n: 'حفظ الطاقة الميكانيكية (بدون احتكاك)', f: 'ΔKE = −ΔPE ⇒ ΔPE = −ΔKE' },
        { n: 'سرعة جسم سقط من سكون رأسياً (بإهمال الاحتكاك)', f: 'v = √(2 g h)' },
        { n: 'التغير في الطاقة الكلية', f: 'ΔE = ΔME + ΔU', u: 'في النظام المعزول ΔE = 0' },
        { n: 'عدم حفظ الطاقة الميكانيكية (مع وجود احتكاك)', f: 'ΔME = −ΔU = W_f = −f d', u: 'ΔU = −W_f' },
        { n: 'البندول عند أقصى إزاحة زاوية', f: 'PE = m g L (1 − cosθ)', u: 'حيث \u2066h = L (1 − cosθ)\u2069 ارتفاع الثقل عن موضع الاستقرار' },
        { n: 'البندول عند موضع الاستقرار', f: 'KE = m g L (1 − cosθ)' },
        { n: 'سرعة جسم سقط من سكون على مستوى مائل أملس', f: 'v = √(2 g d sinθ)' },
        { n: 'السرعة النهائية للبندول عند موضع الاستقرار', f: 'v = √(2 g h) = √(2 g L (1 − cosθ))' },
      ] },
    ] },
    { ch: 'ميكانيكا الدوران', ic: '🔄', ls: [
      { id: '2-1', t: 'عزم القوة', L: [
        { n: 'عزم القوة', f: 'τ = F d sinθ', u: 'N.m · موجب عكس عقارب الساعة' },
        { n: 'قوة عمودية على الذراع', f: 'τ = F d' },
        { n: 'عزم الازدواج', f: 'C = F d sinθ = F × d', u: 'd المسافة العمودية بين القوتين' },
        { n: 'شرط الاتزان الدوراني', f: 'Στ = 0 ⇒ Στ_cw = Στ_acw' },
        { n: 'اتزان الأرجوحة', f: 'm₁ d₁ = m₂ d₂' },
      ] },
      { id: '2-2', t: 'القصور الذاتي الدوراني', L: [
        { n: 'كتلة نقطية', f: 'I = m r²', u: 'kg.m²' },
        { n: 'نظام من كتل نقطية', f: 'I = m₁d₁² + m₂d₂² + …' },
        { n: 'نظرية المحور الموازي (هوغنس)', f: 'I = I₀ + m d²' },
        { n: 'أسطوانة مصمتة حول محورها', f: 'I₀ = ½ m r²' },
        { n: 'كرة مصمتة حول مركزها', f: 'I₀ = ⅖ m r²' },
      ] },
    ] },
    { ch: 'كمية الحركة الخطية', ic: '💥', ls: [
      { id: '3-1', t: 'كمية الحركة والدفع', L: [
        { n: 'كمية الحركة', f: 'P = m v', u: 'kg.m/s' },
        { n: 'التغير في كمية الحركة', f: 'ΔP = P_f − P_i = m (v_f − v_i)' },
        { n: 'الدفع', f: 'I = F Δt = ΔP = m Δv', u: 'N.s = kg.m/s' },
        { n: 'متوسط القوة', f: 'F = ΔP ÷ Δt' },
        { n: 'الدفع من منحنى (F – t)', f: 'I = المساحة تحت المنحنى' },
      ] },
      { id: '3-2', t: 'حفظ كمية الحركة والتصادمات', L: [
        { n: 'حفظ كمية الحركة', f: 'm₁v₁ + m₂v₂ = m₁v₁′ + m₂v₂′' },
        { n: 'الارتداد (من السكون)', f: 'm₁ v₁′ = −m₂ v₂′' },
        { n: 'التصادم اللامرن كلياً (التحام)', f: 'v′ = (m₁v₁ + m₂v₂) ÷ (m₁ + m₂)' },
        { n: 'الطاقة الحركية قبل التصادم', f: 'KE = ½ m₁v₁² + ½ m₂v₂²' },
        { n: 'الطاقة الحركية بعد التصادم اللامرن كلياً', f: 'KE = ½ (m₁ + m₂) v′²' },
        { n: 'التصادم المرن (سرعة الجسم الأول)', f: 'v₁′ = (2m₂v₂ + (m₁ − m₂)v₁) ÷ (m₁ + m₂)' },
        { n: 'التصادم المرن (سرعة الجسم الثاني)', f: 'v₂′ = (2m₁v₁ − (m₁ − m₂)v₂) ÷ (m₁ + m₂)' },
        { n: 'التصادم المرن (الطاقة الحركية)', f: 'ΔKE = 0', u: 'الطاقة الحركية محفوظة' },
        { n: 'البندول القذفي', f: '½ m_T v′² = m_T g h', u: 'ومنها \u2066v′ = √(2 g h)\u2069' },
        { n: 'الطاقة الحركية المفقودة', f: 'ΔKE = KE_f − KE_i' },
      ] },
    ] },
  ],
};

const LW = { ch: 'all', q: '', fav: store.get('lawFav', {}), flash: null, edit: false, ed: null, cache: null };
const lwKey = (lid, i) => `${S.grade}:${lid}.${i}`;
/* تعديلات المعلم تُحفظ في جدول content بالمفتاح laws.<الصف> (نص JSON في عمود video):
   e: قوانين معدّلة { "رقم الدرس|الاسم الأصلي": {n,f,u} } · d: قوانين محذوفة ["رقم الدرس|الاسم الأصلي"] · a: قوانين مضافة [{id,lid,n,f,u}] */
const lwRaw = () => { const r = (typeof REMOTE !== 'undefined' && REMOTE['laws.' + S.grade]); return (r && r.video) || ''; };
function lwCust() {
  let o = {}; try { o = JSON.parse(lwRaw() || '{}') || {}; } catch (e) {}
  return { e: o.e && typeof o.e === 'object' ? o.e : {}, d: Array.isArray(o.d) ? o.d : [], a: Array.isArray(o.a) ? o.a : [] };
}
function lwData() {
  const base = LAWS_DATA[S.grade]; if (!base) return null;
  const raw = lwRaw(); if (LW.cache && LW.cache.g === S.grade && LW.cache.raw === raw) return LW.cache.D;
  const C = lwCust();
  const D = base.map(c => ({ ch: c.ch, ic: c.ic, ls: c.ls.map(l => ({ id: l.id, t: l.t,
    L: l.L.map((x, i) => ({ x, i, o: l.id + '|' + x.n })).filter(r => !C.d.includes(r.o)).map(r => Object.assign({}, r.x, C.e[r.o] || {}, { _o: r.o, _i: r.i }))
      .concat(C.a.filter(a => a && a.lid === l.id).map(a => ({ n: a.n, f: a.f, u: a.u, _a: a.id }))) })) }));
  LW.cache = { g: S.grade, raw, D }; return D;
}
function lwAll() {
  return (lwData() || []).flatMap((c, ci) => c.ls.flatMap(l => l.L.map(x => Object.assign({ ci, c, l, k: x._a ? `${S.grade}:${l.id}+${x._a}` : lwKey(l.id, x._i) }, x))));
}
const lwCanEdit = () => LW.edit && typeof ADMIN !== 'undefined' && !!ADMIN;
const lwF = f => `<code dir="ltr">${esc(f)}</code>`;

function lawsCard() {
  const n = lwAll().length; if (!n) return '';
  return `<button class="lw-entry" data-go="laws"><span class="gi">📐</span><span class="t"><b>ورقة القوانين</b><small>${n} قانوناً من ${esc(G().short)} · للمراجعة السريعة</small></span><span class="qb-go">افتح ${icon('chev')}</span></button>`;
}
function vLaws() {
  const D = lwData(); if (!D) return `<div class="view push">${navBar()}<div class="live-msg"><div class="em">📐</div><h1>ورقة القوانين غير متاحة لهذا الصف بعد</h1></div></div>`;
  const all = lwAll(), q = LW.q.trim().toLowerCase(), favs = all.filter(x => LW.fav[x.k]);
  const hit = x => !q || [x.n, x.f, x.u, x.l.t].some(v => String(v || '').toLowerCase().includes(q));
  const chips = [['all', 'الكل'], ['fav', `⭐ المفضلة${favs.length ? ` (${favs.length})` : ''}`]].concat(D.map((c, i) => [String(i), `${c.ic} ${c.ch}`]));
  const card = x => `<div class="lw-card ${LW.fav[x.k] ? 'fav' : ''}"><div class="t"><b>${esc(x.n)}</b>${lwF(x.f)}${x.u ? `<small>${esc(x.u)}</small>` : ''}</div>
    <button class="star" data-act="lw-fav" data-k="${x.k}" aria-label="${LW.fav[x.k] ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}">${LW.fav[x.k] ? '★' : '☆'}</button>
    ${lwCanEdit() ? `<div class="lw-ed"><button data-act="lw-edit" data-k="${x.k}">✏️ تعديل</button><button class="del" data-act="lw-del" data-k="${x.k}">🗑️ حذف</button></div>` : ''}</div>`;
  let body;
  if (LW.ch === 'fav') body = favs.filter(hit).length ? `<div class="lw-grid">${favs.filter(hit).map(card).join('')}</div>` : '<p class="td-empty">اضغط ☆ بجانب أي قانون لإضافته إلى المفضلة، لتجد القوانين التي تحتاج حفظها في مكان واحد.</p>';
  else {
    body = D.map((c, ci) => (LW.ch !== 'all' && +LW.ch !== ci) ? '' : c.ls.map(l => {
      const xs = all.filter(x => x.ci === ci && x.l === l).filter(hit); if (!xs.length && !(lwCanEdit() && !q)) return '';
      return `<section class="lw-sec"><h2><span>${c.ic}</span>${esc(l.t)}<small>الدرس (${l.id})</small></h2><div class="lw-grid">${xs.map(card).join('')}</div>
        ${lwCanEdit() ? `<button class="lw-add" data-act="lw-new" data-lid="${l.id}">＋ أضف قانوناً في هذا الدرس</button>` : ''}</section>`;
    }).join('')).join('') || '<p class="td-empty">لا يوجد قانون بهذا الاسم.</p>';
  }
  return `<div class="view push lw">${navBar()}
    <section class="lw-hero"><small>${esc(G().name)}</small><h1>ورقة القوانين</h1><p>${all.length} قانوناً من حلول بنك الأسئلة، مرتبة حسب الدروس.</p>
      <div class="lw-acts"><button class="btn primary" data-act="lw-flash">🃏 احفظ بالبطاقات</button><button class="btn" data-act="lw-print">🖨️ طباعة</button></div>
      ${typeof ADMIN !== 'undefined' && ADMIN ? `<div class="lw-acts"><button class="btn ${LW.edit ? 'primary' : ''}" data-act="lw-editmode">${LW.edit ? '✔️ إنهاء التعديل' : '✏️ تعديل القوانين (للمعلم)'}</button></div>` : ''}</section>
    ${lwCanEdit() ? `<div class="lw-admin"><b>وضع التعديل</b><p>ما تعدّله أو تضيفه هنا يظهر لجميع طلاب ${esc(G().name)} بعد حفظه.</p>
      <div class="lw-acts"><button class="btn primary" data-act="lw-new">＋ قانون جديد</button>${lwCust().d.length ? `<button class="btn" data-act="lw-restore">↩️ استرجاع المحذوف (${lwCust().d.length})</button>` : ''}</div></div>` : ''}
    <div class="field lw-search"><input id="lw-q" type="search" placeholder="ابحث عن قانون… مثل: الطاقة الحركية أو KE" value="${esc(LW.q)}" aria-label="بحث في القوانين"></div>
    <div class="td-chips lw-chips">${chips.map(([k, t]) => `<button class="${LW.ch === k ? 'on' : ''}" data-act="lw-ch" data-k="${k}">${t}</button>`).join('')}</div>
    <div id="lw-body">${body}</div>
    ${lwPrintHTML()}
  </div>`;
}

/* ---------- نسخة الطباعة: ورقة A4 واحدة فيها كل قوانين الصف ---------- */
function lwPrintHTML() {
  const D = lwData(); if (!D) return '';
  const fav = LW.ch === 'fav', all = lwAll().filter(x => !fav || LW.fav[x.k]);
  if (!all.length) return '';
  const body = D.map((c, ci) => {
    let first = true;
    return c.ls.map(l => {
      const xs = all.filter(x => x.ci === ci && x.l === l); if (!xs.length) return '';
      const chap = first ? `<div class="lwp-chap"><span>${c.ic}</span>${esc(c.ch)}</div>` : ''; first = false;
      return `${chap}<div class="lwp-les"><bdi dir="ltr">${esc(l.id)}</bdi><span>${esc(l.t)}</span></div>`
        + xs.map(x => `<div class="lwp-law"><b>${esc(x.n)}</b>${lwF(x.f)}${x.u ? `<small>${esc(x.u)}</small>` : ''}</div>`).join('');
    }).join('');
  }).join('');
  return `<div id="lw-print" class="lwp" aria-hidden="true">
    <header class="lwp-head"><div><small>${esc(G().name)}</small><h1>${fav ? 'قوانيني المفضلة' : 'ورقة القوانين'}</h1></div>
      <div class="lwp-meta"><b>${all.length}</b><span>قانوناً</span><em>Physics Tube</em></div></header>
    <div class="lwp-body">${body}</div></div>`;
}
/* يصغّر الخط تدريجياً حتى تتسع كل القوانين في صفحة واحدة */
function lwFit() {
  const el = document.getElementById('lw-print'); if (!el) return 0;
  const body = el.querySelector('.lwp-body'); el.classList.add('measure');
  let fs = 12;
  for (; fs > 4.5; fs -= .25) {
    el.style.setProperty('--fs', fs + 'pt');
    if (body.scrollWidth <= body.clientWidth + 1 && body.scrollHeight <= body.clientHeight + 1) break;
  }
  el.classList.remove('measure'); return fs;
}
window.addEventListener('beforeprint', () => { try { lwFit(); } catch (e) {} });

/* ---------- Flashcards: name → reveal the formula ---------- */
function lwFlash(start) {
  if (start) { const pool = (LW.ch === 'fav' ? lwAll().filter(x => LW.fav[x.k]) : lwAll().filter(x => LW.ch === 'all' || x.ci === +LW.ch));
    if (!pool.length) return toast('أضف قوانين إلى المفضلة أولاً');
    LW.flash = { list: pool.sort(() => Math.random() - .5), i: 0, open: false, known: 0 }; }
  const F = LW.flash; if (!F) return;
  if (F.i >= F.list.length) return sheet(`<div class="lw-done"><div class="em">🎉</div><h2>أنهيت ${F.list.length} بطاقة</h2><p>عرفت ${F.known} من ${F.list.length} قانوناً.</p>
    <button class="btn primary wide" data-act="lw-flash">جولة جديدة</button><button class="btn wide" data-act="close" style="margin-top:8px">إغلاق</button></div>`);
  const x = F.list[F.i];
  sheet(`<div class="lw-flash"><small>${F.i + 1} من ${F.list.length} · ${esc(x.l.t)}</small>
    <div class="fc ${F.open ? 'open' : ''}" data-act="lw-turn"><b>${esc(x.n)}</b>${F.open ? `${lwF(x.f)}${x.u ? `<small>${esc(x.u)}</small>` : ''}` : '<span class="tap">اكتب القانون في ذهنك، ثم اضغط لكشفه</span>'}</div>
    ${F.open ? `<div class="two"><button class="btn" data-act="lw-next" data-k="0">✗ لم أتذكره</button><button class="btn primary" data-act="lw-next" data-k="1">✓ تذكرته</button></div>` : ''}</div>`, 'lw-sheet');
}

const LW_SYM = ['Δ', 'θ', 'τ', 'ω', 'π', 'α', 'Σ', '√(', '²', '³', '½', '×', '÷', '=', '+', '−', '⇒', '°', '′', '₀', '₁', '₂'];
function lwSheet(x, lid) {
  const D = lwData() || [], C = lwCust(), edited = x && x._o && C.e[x._o];
  const ls = D.flatMap(c => c.ls);
  LW.ed = { k: x ? x.k : null, lid: x ? x.l.id : (lid || (ls[0] && ls[0].id)) };
  sheet(`<div class="lw-form"><h2>${x ? 'تعديل القانون' : 'قانون جديد'}</h2>
    ${x ? '' : `<div class="field"><label for="lwe-l">الدرس</label><select id="lwe-l">${ls.map(l => `<option value="${l.id}" ${l.id === LW.ed.lid ? 'selected' : ''}>${esc(l.t)} (${l.id})</option>`).join('')}</select></div>`}
    <div class="field"><label for="lwe-n">اسم القانون</label><input id="lwe-n" maxlength="120" placeholder="مثال: الطاقة الحركية" value="${x ? esc(x.n) : ''}"></div>
    <div class="field"><label for="lwe-f">القانون (الصيغة)</label><input id="lwe-f" maxlength="200" dir="ltr" placeholder="KE = ½ m v²" value="${x ? esc(x.f) : ''}"></div>
    <div class="lw-sym" aria-label="رموز للإدراج">${LW_SYM.map(c => `<button type="button" data-act="lw-ins" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <p class="lw-tip">اضغط رمزاً لإدراجه في الصيغة. للكسر اكتب ÷ أو ( / ) بين مسافتين، وللرمز السفلي اكتب _ مثل v_y.</p>
    <div class="field"><label for="lwe-u">ملاحظة أو وحدة (اختياري)</label><input id="lwe-u" maxlength="200" placeholder="مثال: J = N·m" value="${x ? esc(x.u || '') : ''}"></div>
    <button class="btn primary wide" data-act="lw-save">حفظ ونشر للطلاب</button>
    ${edited ? '<button class="btn wide" data-act="lw-reset" style="margin-top:8px">↩️ استرجاع الصيغة الأصلية</button>' : ''}
    <button class="btn wide" data-act="close" style="margin-top:8px">إلغاء</button></div>`, 'lw-sheet');
}
async function lwStore(C, msg) {
  if (typeof saveRow !== 'function') return false;
  const ok = await saveRow('laws.' + S.grade, { video: JSON.stringify(C) });
  if (ok) { closeSheet(); toast(msg || 'تم الحفظ وظهر للطلاب'); }
  return ok;
}
const lwFind = k => lwAll().find(x => x.k === k);

function lwAct(act, el) {
  if (act === 'lw-editmode') { if (typeof ADMIN === 'undefined' || !ADMIN) return; LW.edit = !LW.edit; render(false); }
  else if (act === 'lw-new') { if (lwCanEdit()) lwSheet(null, el.dataset.lid); }
  else if (act === 'lw-edit') { const x = lwFind(el.dataset.k); if (x && lwCanEdit()) lwSheet(x); }
  else if (act === 'lw-ins') {
    const i = document.getElementById('lwe-f'); if (!i) return;
    const a = i.selectionStart == null ? i.value.length : i.selectionStart, b = i.selectionEnd == null ? a : i.selectionEnd, c = el.dataset.c;
    i.value = i.value.slice(0, a) + c + i.value.slice(b); i.focus(); i.setSelectionRange(a + c.length, a + c.length);
  }
  else if (act === 'lw-save') {
    if (!lwCanEdit()) return;
    const n = (document.getElementById('lwe-n').value || '').trim(), f = (document.getElementById('lwe-f').value || '').trim(), u = (document.getElementById('lwe-u').value || '').trim();
    if (!n || !f) return toast('اكتب اسم القانون وصيغته');
    const C = lwCust(), x = LW.ed.k ? lwFind(LW.ed.k) : null;
    if (!x) { const sel = document.getElementById('lwe-l'); C.a.push({ id: 'x' + Date.now().toString(36), lid: sel ? sel.value : LW.ed.lid, n, f, u }); }
    else if (x._a) { const a = C.a.find(r => r.id === x._a); if (a) Object.assign(a, { n, f, u }); }
    else C.e[x._o] = { n, f, u };
    lwStore(C);
  }
  else if (act === 'lw-reset') { const x = LW.ed && lwFind(LW.ed.k); if (!x || !x._o) return; const C = lwCust(); delete C.e[x._o]; lwStore(C, 'رجع القانون إلى صيغته الأصلية'); }
  else if (act === 'lw-del') {
    const x = lwFind(el.dataset.k); if (!x || !lwCanEdit()) return;
    LW.ed = { k: x.k };
    sheet(`<div class="lw-done"><div class="em">🗑️</div><h2>حذف هذا القانون؟</h2><p><b>${esc(x.n)}</b></p><p>سيختفي من صفحة القوانين عند جميع الطلاب.</p>
      <button class="btn primary wide" data-act="lw-del-ok">نعم، احذف</button><button class="btn wide" data-act="close" style="margin-top:8px">إلغاء</button></div>`, 'lw-sheet');
  }
  else if (act === 'lw-del-ok') {
    const x = LW.ed && lwFind(LW.ed.k); if (!x || !lwCanEdit()) return;
    const C = lwCust();
    if (x._a) C.a = C.a.filter(r => r.id !== x._a); else { if (!C.d.includes(x._o)) C.d.push(x._o); delete C.e[x._o]; }
    delete LW.fav[x.k]; store.set('lawFav', LW.fav);
    lwStore(C, 'تم حذف القانون');
  }
  else if (act === 'lw-restore') { if (!lwCanEdit()) return; const C = lwCust(); C.d = []; lwStore(C, 'تم استرجاع القوانين المحذوفة'); }
  else if (act === 'lw-ch') { LW.ch = el.dataset.k; render(false); }
  else if (act === 'lw-fav') { const k = el.dataset.k; if (LW.fav[k]) delete LW.fav[k]; else LW.fav[k] = 1; store.set('lawFav', LW.fav); render(false); }
  else if (act === 'lw-flash') lwFlash(true);
  else if (act === 'lw-turn') { if (LW.flash) { LW.flash.open = true; lwFlash(); } }
  else if (act === 'lw-next') { const F = LW.flash; if (!F) return; if (el.dataset.k === '1') F.known++; else { const x = F.list[F.i]; LW.fav[x.k] = 1; store.set('lawFav', LW.fav); toast('أضفناه إلى ⭐ المفضلة لتراجعه'); } F.i++; F.open = false; lwFlash(); }
  else if (act === 'lw-print') { LW.ch = LW.ch === 'fav' ? 'fav' : 'all'; LW.q = ''; render(false); setTimeout(() => { lwFit(); window.print(); }, 400); }
}
document.addEventListener('input', e => {
  if (e.target.id !== 'lw-q') return;
  LW.q = e.target.value; const pos = e.target.selectionStart; render(false);
  const i = document.getElementById('lw-q'); if (i) { i.focus(); i.setSelectionRange(pos, pos); }
});
