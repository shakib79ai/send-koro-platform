/* Send Koro restaurant prototype (portal web + PWA). Integer cents. Pretend data only. */
(function () {
  const M = window.SK_MODE || { layout: 'web' };
  const PHONE = M.layout === 'phone';
  const root = document.getElementById('app'); root.classList.add('cx', 'staff'); if (M.theme === 'navy') root.classList.add('navy');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const money = (c) => (c < 0 ? '−' : '') + '$' + (Math.abs(c) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const IMG = (n) => (String(n).startsWith('data:') ? n : 'img/' + n + '.jpg');
  // Logo M3 "Fork Ring, arrow breaks out" (brand kit v1). Colours come from CSS (.sk-mark).
  const LOGO = (c, size = 34) => `<svg class="sk-mark" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true"><path class="mk-r" d="M92.94 47.75A43 43 0 1 1 82.45 21.79" fill="none" stroke-width="7" stroke-linecap="round"/><g transform="rotate(-22 50 50)"><path class="mk-t" d="M17 42H34M17 50H34M17 58H34" fill="none" stroke-width="4.6" stroke-linecap="round"/><path class="mk-f" d="M32 37.5H37Q46 37.5 49 46L50.5 50L49 54Q46 62.5 37 62.5H32Z"/><path class="mk-a" d="M49 50H84" fill="none" stroke-width="6.5" stroke-linecap="round"/><path class="mk-h" d="M80 40.5L97 50L80 59.5Z" stroke-width="2" stroke-linejoin="round"/></g></svg>`;
  const WORD = '<span class="sk-name">Send <i class="k">Koro</i></span>';
  const BASE_DELIVERY = 848; // example delivery fee for a $30 order with an 18% tip
  // Delivery markup (same rule as services/payments priceDelivery): D = courier price + the delivery money's card-fee share.
  const COURIER = 780; // typical courier quote (P)
  const stripeFee = (q) => (q ? Math.ceil((q * 290) / 10000) + 30 : 0);
  // Payout fee: Send Koro pays out and settles to the courier (own driver or Uber Direct/DoorDash): 0.25% of (courier + tip) + 25¢.
  const payoutFee = (tip) => Math.ceil(((COURIER + tip) * 25) / 10000) + 25;
  function priceD(shareOf, food, taxC, tip, P = COURIER, payout = Math.ceil(((P + tip) * 25) / 10000) + 25) {
    let D = P + payout;
    for (let i = 0; i < 20; i++) { const R = shareOf(D); const C = D - R; const Q = food + taxC + C + tip; const share = Q ? Math.min(D + tip, Math.round((stripeFee(Q) * (C + tip)) / Q)) : 0; const need = P + payout + share; if (need <= D) break; D = need; }
    return D;
  }
  const TIERS = [[250000, 5000], [500000, 10000], [750000, 15000], [1000000, 25000], [1500000, 35000], [Infinity, 50000]];
  const planFor = (net) => (net <= 0 ? 5000 : TIERS.find((t) => net <= t[0])[1]);
  const tierLabel = (i) => (i === 0 ? 'Up to $2,500' : i === TIERS.length - 1 ? 'Above $15,000' : `${money(TIERS[i - 1][0] + 1).replace('.01', '')}–${money(TIERS[i][0]).replace('.00', '')}`);
  const processing = (food) => Math.round((food * 29) / 1000) + 30; // 2.9% + 30¢ on food, paid by the restaurant
  const DAYMS = 86400000;

  // ---------- state ----------
  const S = {
    signedIn: true, phone: '', codeSent: false, code: '',
    screen: PHONE ? 'home' : 'overview', stack: [],
    accepting: true, busy: false,
    role: 'owner',
    orders: [], seq: 1050, detailId: null,
    hist: { range: 'week', status: 'all', q: '' },
    menu: [
      { s: 'Popular', items: [
        { id: 'gcb', name: 'Grilled Chicken Bowl', desc: 'Chicken, quinoa, greens, tomatoes, feta', price: 1500, img: 'chicken_bowl', on: true, groups: [{ name: 'Size', required: true, max: 1, choices: [['Regular', 0], ['Large', 300]] }, { name: 'Extras', required: false, max: 3, choices: [['Avocado', 200], ['Extra chicken', 400], ['Extra feta', 100]] }] },
        { id: 'slm', name: 'Salmon Bowl', desc: 'Roasted salmon, rice, avocado, greens', price: 1300, img: 'hero_bowl', on: true, over: { b2: { price: 1450, on: false } }, groups: [{ name: 'Size', required: true, max: 1, choices: [['Regular', 0], ['Large', 300]] }] },
        { id: 'hrv', name: 'Harvest Salad', desc: 'Greens, tomatoes, olives, feta', price: 1100, img: 'salad', on: true, groups: [] },
        { id: 'scb', name: 'Spicy Chicken Bites', desc: 'Crispy chicken, gochujang glaze', price: 900, img: 'spicy', on: false, where: ['b1'], groups: [] },
      ] },
      { s: 'Drinks', items: [
        { id: 'igt', name: 'Iced Green Tea', desc: 'Unsweetened', price: 350, img: '', on: true, groups: [] },
        { id: 'lmd', name: 'Mint Lemonade', desc: 'Fresh lemon and mint', price: 450, img: '', on: true, groups: [] },
      ] },
    ],
    menuTab: 0, edit: null, menuLoc: 'all',
    month: 'oct', moneyId: null, payoutOpen: null,
    planInput: '6240',
    rule: { type: 'split', mode: 'fixed', fixed: '3.00', pct: '50', over: '30.00', cap: '5.00', budget: '600.00', version: 3 },
    ruleDraft: null,
    team: [{ name: 'Shakib Haider', phone: '(718) 555-0100', role: 'owner' }, { name: 'Maya Lin', phone: '(718) 555-0123', role: 'manager' }, { name: 'Jordan Ruiz', phone: '(347) 555-0180', role: 'staff' }],
    week: [['Monday', true, '11:00', '22:00'], ['Tuesday', true, '11:00', '22:00'], ['Wednesday', true, '11:00', '22:00'], ['Thursday', true, '11:00', '22:00'], ['Friday', true, '11:00', '23:30'], ['Saturday', true, '11:00', '23:30'], ['Sunday', true, '12:00', '21:00']],
    closeDraft: { date: '', note: '' }, licOpen: null,
    profile: { name: 'Brooklyn Bowl Co.', cuisine: 'Bowls', address: '412 7th Ave, Brooklyn, NY 11215', phone: '(718) 555-0100', about: 'Fresh grain bowls and salads made to order in Park Slope.', halal: true, veg: false, pickup: true, cover: 'hero_bowl' },
    store: { prep: '20', serviceCharge: false, serviceCharge_pct: '0', packaging: '0.00', taxRate: '8.875' },
    notif: { sound: true, repeat: true, sms: true, email: true, payouts: true },
    business: { legal: 'Brooklyn Bowl Co. LLC', dba: 'Brooklyn Bowl Co.', entity: 'LLC', ein: '12-3456789', dos: '5938201', email: 'billing@brooklynbowl.co', owner: 'Shakib Haider' },
    branches: [
      { id: 'b1', name: 'Park Slope', address: '412 7th Ave, Brooklyn, NY 11215', phone: '(718) 555-0100', cuisines: ['Bowls', 'Salads', 'Halal'], juris: 'nyc', status: 'live', areaSet: true, octNet: 624000, novSoFar: 184650, ownAcct: 'acct_…9C7', ownConnected: false, accepting: true, prep: '20', radius: '3', taxRate: '8.875', hoursSet: true, deliverySet: true, payout: 'same', week: null, closures: [['2026-11-26', 'Thanksgiving']] },
      { id: 'b2', name: 'Williamsburg', address: '150 Bedford Ave, Brooklyn, NY 11249', phone: '(718) 555-0144', cuisines: ['Bowls', 'Salads'], juris: 'nyc', status: 'setup', octNet: 0, novSoFar: 0, ownAcct: 'acct_…7B1', ownConnected: false, accepting: false, prep: '20', radius: '2.5', taxRate: '', hoursSet: false, deliverySet: false, payout: 'same', week: null, closures: [] },
    ],
    branchId: 'b1', bdraft: null, cuisineQ: '', licBranch: null,
    lic: {
      b1: { health: { number: '50123456', expires: '2027-06-30', file: 'fse-permit-park-slope.pdf', status: 'verified' }, manager: { number: 'FPC 1189234', holder: 'Shakib Haider', file: 'food-protection-cert.pdf', status: 'verified' }, tax: { number: '12-3456789', file: 'certificate-of-authority.pdf', status: 'verified' }, grade: { number: 'A', status: 'verified' } },
      b2: { tax: { number: '12-3456789', file: 'certificate-of-authority.pdf', status: 'review' } },
    },
    licAccount: {},
    signup: { step: 1, owner: '', phone: '', email: '', code: '', name: '', address: '', cuisines: [], locs: '1', agree: false, tax: false },
    taxAccepted: true, stripe: true, agree: { signed: true, licenses: true, food: true, bathroom: true },
    rv: { loc: 'all', f: 'all', replyId: null, draft: '' }, sub: { cancel: false, unpaid: false, card: 'Visa •••• 4242 · expires 08/28' },
    help: { topic: 'order', order: '', msg: '', sent: [] },
    modal: null, toast: '',
  };
  S.branches.forEach((b) => { b.week = S.week.map((d) => [...d]); });
  const M2MODAL = {};
  Object.assign(S, { learnDone: {}, learnQ: '', learnTrack: 'all', lessonId: 'start' });
  const bIdx = () => Math.max(0, S.branches.findIndex((b) => b.id === S.branchId));
  const B = () => S.branches[bIdx()];
  const tax = (food) => Math.round((food * Math.round((parseFloat(B().taxRate) || 0) * 1000)) / 100000);
  const getPath = (path) => path.split('.').reduce((o, k) => (o[k] == null ? (o[k] = {}) : o[k]), S);

  const FIRST = [
    { lines: [['Grilled Chicken Bowl', 2, 1500, 'Large · Avocado'], ['Mint Lemonade', 1, 450, '']], customer: 'Ana R.', fulfil: 'delivery', tipPct: 18, note: 'Extra napkins please' },
    { lines: [['Salmon Bowl', 1, 1300, ''], ['Harvest Salad', 1, 1100, 'No olives']], customer: 'Dev P.', fulfil: 'pickup', tipPct: 0, note: '' },
    { lines: [['Grilled Chicken Bowl', 1, 1500, ''], ['Iced Green Tea', 2, 350, '']], customer: 'Kim T.', fulfil: 'delivery', tipPct: 20, note: 'Nut allergy, please be careful' },
    { lines: [['Harvest Salad', 2, 1100, 'Extra feta'], ['Salmon Bowl', 1, 1300, '']], customer: 'Luis M.', fulfil: 'delivery', tipPct: 15, note: '' },
  ];
  let firstIdx = 0;
  function capC() { const c = Math.round((parseFloat(S.rule.cap) || 0) * 100); return c > 0 ? c : BASE_DELIVERY; }
  function shareFor(food, rule, Dp) {
    const r = rule || S.rule; const BASE_DELIVERY = Dp == null ? 848 : Dp;
    const cap = (() => { const c = Math.round((parseFloat(r.cap) || 0) * 100); return c > 0 ? c : BASE_DELIVERY; })();
    if (r.type === 'customer') return 0;
    if (r.type === 'restaurant') return Math.min(BASE_DELIVERY, cap);
    if (r.type === 'freeOver') return food >= Math.round(parseFloat(r.over || 0) * 100) ? Math.min(BASE_DELIVERY, cap) : 0;
    const raw = r.mode === 'pct' ? Math.round((BASE_DELIVERY * Math.min(100, parseFloat(r.pct) || 0)) / 100) : Math.round((parseFloat(r.fixed) || 0) * 100);
    return Math.min(raw, BASE_DELIVERY, cap);
  }
  function mkOrder(t, ageSec, id) {
    const food = t.lines.reduce((a, l) => a + l[1] * l[2], 0);
    const del = t.fulfil === 'delivery';
    const tipPre = del ? Math.round((food * t.tipPct) / 100) : 0;
    const fee = del ? priceD((D) => shareFor(food, null, D), food, tax(food), tipPre) : 0;
    const share = del ? shareFor(food, null, fee) : 0;
    const tip = del ? Math.round((food * t.tipPct) / 100) : 0;
    const placed = new Date(Date.now() - (ageSec || 0) * 1000);
    const o = { id: id || 'SK' + S.seq++, customer: t.customer, lines: t.lines, fulfil: t.fulfil, note: t.note || '', food, share, tax: tax(food), tip, fee, status: 'new', deadline: placed.getTime() + 300000, placed, prep: +S.store.prep || 20, timeline: [['Order placed, card held', placed]] };
    o.total = o.food + o.fee - o.share + o.tax + o.tip;
    o.net = o.food + o.tax - o.share - processing(o.food);
    return o;
  }
  const done = [];
  // Past orders for history and earnings
  const PAST = [];
  const pastSpec = [[0.06, 'completed'], [0.09, 'completed'], [0.12, 'declined', 'Too busy right now'], [0.15, 'completed'], [0.2, 'completed'], [1.1, 'completed'], [1.3, 'declined', 'No answer in 5 minutes (auto-declined)'], [1.4, 'completed'], [2.2, 'completed'], [3.1, 'completed'], [5.4, 'completed'], [9, 'completed']];
  const NAMES = ['Sam K.', 'Priya S.', 'Omar F.', 'Lena W.', 'Tariq H.', 'Rosa G.', 'Ben C.', 'Nia J.', 'Ari L.', 'Mei Z.', 'Chris D.', 'Fatima A.'];
  pastSpec.forEach(([days, st, reason], i) => {
    const t = { ...FIRST[i % FIRST.length], customer: NAMES[i] };
    if (i === 0) t.lines = [['Grilled Chicken Bowl', 2, 1500, '']], t.fulfil = 'delivery', t.tipPct = 18;
    const o = mkOrder(t, Math.round(days * 86400), 'SK' + (1049 - i));
    o.status = st;
    // Send Koro promo credit (referral or promo code) on some orders: the card pays less now; Send Koro reimburses it on the monthly invoice.
    if (st === 'completed' && (i === 1 || i === 4)) { o.credit = i === 1 ? 500 : 1000; o.total -= o.credit; }
    if (st === 'declined') { o.reason = reason + ' · hold released'; o.timeline.push(['Declined · hold released', new Date(o.placed.getTime() + 120000)]); }
    else o.timeline.push(['Accepted, card charged', new Date(o.placed.getTime() + 60000)], ['Marked ready', new Date(o.placed.getTime() + 1200000)], [o.fulfil === 'delivery' ? 'Handed to courier' : 'Picked up', new Date(o.placed.getTime() + 1500000)]);
    PAST.push(o);
  });
  S.orders.push(mkOrder(FIRST[0], 70));
  const prepO = mkOrder(FIRST[1], 600); prepO.status = 'preparing'; prepO.readyAt = Date.now() + 9 * 60000; prepO.timeline.push(['Accepted, card charged', new Date(Date.now() - 540000)]); S.orders.push(prepO);
  const readyO = mkOrder(FIRST[2], 1500); readyO.status = 'ready'; readyO.timeline.push(['Accepted, card charged', new Date(Date.now() - 1440000)], ['Marked ready', new Date(Date.now() - 120000)]); S.orders.push(readyO);
  firstIdx = 3;
  const allOrders = () => [...S.orders, ...done, ...PAST];
  const findAny = (id) => allOrders().find((o) => o.id === id);

  const LEDGER = {
    oct: { label: 'October 2026', orders: 214, food: 624000, tax: 55380, share: 51200, refunds: 4200, plan: 0, planNote: 'First month free' },
    sep: { label: 'September 2026', orders: 168, food: 488000, tax: 43310, share: 39600, refunds: 2600, plan: 0, planNote: 'Not on Send Koro yet (signed up Oct 1)' },
  };
  const ledgerCalc = (L) => { const proc = Math.round((L.food * 29) / 1000) + 30 * L.orders; return { ...L, proc, net: L.food + L.tax - L.share - proc - L.refunds - L.plan }; };
  const PAYOUTS = [
    { id: 'po_1103', date: 'Nov 3', period: 'Oct 27 – Nov 2', orders: 52, food: 152600, tax: 13543, share: 12400, refunds: 900 },
    { id: 'po_1027', date: 'Oct 27', period: 'Oct 20 – Oct 26', orders: 48, food: 140200, tax: 12443, share: 11600, refunds: 0 },
    { id: 'po_1020', date: 'Oct 20', period: 'Oct 13 – Oct 19', orders: 41, food: 121000, tax: 10739, share: 9800, refunds: 1500 },
    { id: 'po_1013', date: 'Oct 13', period: 'Oct 6 – Oct 12', orders: 39, food: 112400, tax: 9976, share: 9200, refunds: 1800 },
  ].map((p) => { const proc = Math.round((p.food * 29) / 1000) + 30 * p.orders; return { ...p, proc, net: p.food + p.tax - p.share - proc - p.refunds }; });
  const TAXMONTHS = [['October 2026', 624000, 55380], ['September 2026', 488000, 43310]];

  // ---------- roles ----------
  const ACCESS = {
    owner: null,
    manager: ['overview', 'home', 'orders', 'newOrder', 'orderDetail', 'history', 'reviews', 'menu', 'editItem', 'cats', 'mods', 'editGroup', 'menus', 'promos', 'editPromo', 'hours', 'notifications', 'help', 'learn', 'lesson', 'legalDoc', 'legalList', 'settings', 'more', 'noAccess'],
    staff: ['orders', 'newOrder', 'orderDetail', 'notifications', 'help', 'learn', 'lesson', 'legalDoc', 'legalList', 'more', 'noAccess'],
  };
  const can = (s) => !ACCESS[S.role] || ACCESS[S.role].includes(s);
  const ROLE = { owner: 'Owner', manager: 'Manager', staff: 'Staff' };

  // ---------- nav ----------
  function go(s, extra) { if (extra) Object.assign(S, extra); if (!can(s)) { S.blocked = s; s = 'noAccess'; } if (S.screen !== s) S.stack.push(S.screen); S.screen = s; S.modal = null; render(true); }
  function tabTo(s) { S.stack = []; if (!can(s)) { S.blocked = s; s = 'noAccess'; } S.screen = s; S.modal = null; render(true); }
  function back() { S.screen = S.stack.pop() || homeFor(); render(true); }
  const homeFor = () => (S.role === 'staff' ? 'orders' : PHONE ? 'home' : 'overview');
  let tt; function toast(m) { S.toast = m; render(); clearTimeout(tt); tt = setTimeout(() => { S.toast = ''; render(); }, 2800); }
  // New-order alert: "order up" (two counter-bell dings + a rising tune). Rings at once, then every 10 s
  // (if "Keep ringing" is on) until every new order is accepted or declined. The tab title flashes.
  const ORDER_MP3 = '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';
  let actx = null, orderBuf = null, lastRing = 0, titleFlip = false;
  const BASE_TITLE = document.title;
  function audio() { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; actx = actx || new C(); if (actx.state === 'suspended') actx.resume(); return actx; }
  function loadOrderBuf() {
    if (orderBuf || !actx) return Promise.resolve(orderBuf);
    const bin = atob(ORDER_MP3); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new Promise((res) => actx.decodeAudioData(u.buffer, (x) => { orderBuf = x; res(x); }, () => res(null)));
  }
  function playOrderSound() { try { if (!audio()) return; loadOrderBuf().then((x) => { if (!x) return; const src = actx.createBufferSource(); src.buffer = x; src.connect(actx.destination); src.start(); }); } catch (e) { /* sound blocked */ } }
  function ringNow() { lastRing = Date.now(); if (S.notif.sound) playOrderSound(); try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) { /* ignore */ } }
  function ringTick() {
    const waiting = S.orders.filter((o) => o.status === 'new').length;
    if (!waiting) { lastRing = 0; if (document.title !== BASE_TITLE) document.title = BASE_TITLE; return; }
    if (!lastRing || (S.notif.repeat && Date.now() - lastRing >= 10000)) ringNow();
    titleFlip = !titleFlip; document.title = titleFlip ? `🔔 ${waiting} new order${waiting > 1 ? 's' : ''}` : BASE_TITLE;
  }
  const beep = ringNow;
  document.addEventListener('pointerdown', () => { try { if (audio()) { const b0 = actx.createBuffer(1, 1, 22050); const src = actx.createBufferSource(); src.buffer = b0; src.connect(actx.destination); src.start(0); loadOrderBuf(); } } catch (e) { /* ignore */ } }, { once: true, capture: true });
  function copyText(text) { try { navigator.clipboard.writeText(text).then(() => toast('Copied. Paste it into a spreadsheet.'), () => { S.modal = { type: 'copy', text }; render(); }); } catch (e) { S.modal = { type: 'copy', text }; render(); } }

  // ---------- timers ----------
  setInterval(() => {
    let changed = false;
    for (const o of S.orders) {
      if (o.status === 'new' && Date.now() >= o.deadline) { o.status = 'declined'; o.reason = 'No answer in 5 minutes (auto-declined) · hold released'; o.timeline.push(['Auto-declined · hold released', new Date()]); done.unshift(o); changed = true; toast(`${o.id} auto-declined. The customer's hold was released.`); }
    }
    S.orders = S.orders.filter((o) => o.status !== 'declined' && o.status !== 'completed');
    for (const b of S.branches) if (!b.accepting && typeof b.closedUntil === 'number' && Date.now() >= b.closedUntil) { b.accepting = true; b.closedUntil = null; changed = true; toast(`${b.name} reopened automatically.`); }
    tickCountdowns();
    ringTick();
    if (changed) render();
  }, 1000);
  function tickCountdowns() { document.querySelectorAll('[data-cd]').forEach((el) => { const left = Math.max(0, Math.ceil((+el.dataset.cd - Date.now()) / 1000)); el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; el.style.color = left < 60 ? 'var(--red)' : ''; }); }

  // ---------- pieces ----------
  const statusPill = (o) => ({ new: '<span class="pill p-o">New · needs answer</span>', preparing: '<span class="pill p-g">Preparing</span>', ready: '<span class="pill" style="background:#1E5442;color:#fff">Ready</span>', completed: '<span class="pill p-n">Completed</span>', declined: '<span class="pill p-r">Declined</span>' }[o.status]);
  const fmtTime = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const fmtDay = (d) => { const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / DAYMS); return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : d.toLocaleDateString([], { month: 'short', day: 'numeric' }); };
  const head = (title, sub, right = '') => PHONE ? `<div class="row" style="background:var(--g);color:#fff;padding:12px;position:sticky;top:0;z-index:5">${S.stack.length ? `<button data-a="back" aria-label="Back" style="width:44px;height:44px;border:0;background:transparent;color:#fff;font-size:24px">‹</button>` : '<span style="width:8px"></span>'}<div class="grow"><b style="font-size:18px">${esc(title)}</b>${sub ? `<div style="font-size:12px;color:#C9D3CD">${esc(sub)}</div>` : ''}</div>${right}</div>` : `${S.stack.length ? '<button class="btn gh" data-a="back" style="align-self:flex-start;padding:0;min-height:32px">← Back</button>' : ''}<div class="row between wrap"><div><h1 style="font-size:30px;color:var(--ink)">${esc(title)}</h1>${sub ? `<div class="mut">${esc(sub)}</div>` : ''}</div><div class="row wrap">${right}</div></div>`;
  const body = (inner) => PHONE ? `<div class="col" style="padding:14px 14px 24px;gap:12px">${inner}</div>` : inner;
  const narrow = (inner) => `<div class="col" style="${PHONE ? '' : 'max-width:760px'}">${inner}</div>`;
  const sw = (attrs, on, label) => `<span class="switch k"><input type="checkbox" role="switch" aria-label="${esc(label)}" ${attrs} ${on ? 'checked' : ''}><i aria-hidden="true"></i></span>`;

  function itemsList(o) { return o.lines.map((l) => `<div class="rw" style="padding:2px 0"><span><b>${l[1]}×</b> ${esc(l[0])}${l[3] ? `<span class="mut sm-t" style="display:block">${esc(l[3])}</span>` : ''}</span><span>${money(l[1] * l[2])}</span></div>`).join(''); }
  function actions(o) {
    if (o.status === 'new') return `<div class="row wrap"><label class="f" style="flex:1 1 120px">Prep time (min)<select class="in" data-prep="${o.id}">${[10, 15, 20, 25, 30, 45].map((m) => `<option ${m === o.prep ? 'selected' : ''}>${m}</option>`).join('')}</select></label><button class="btn grow" data-a="accept" data-id="${o.id}" style="align-self:flex-end;background:#1E5442">Accept order</button></div><button class="btn ln" data-a="declineAsk" data-id="${o.id}" style="color:var(--red);border-color:var(--red)">Decline</button><span class="mut sm-t">Accepting charges the customer's card ${money(o.total)}. No answer in 5 minutes auto-declines and releases the hold.</span>`;
    if (o.status === 'preparing') return `<div class="row wrap"><button class="btn grow" data-a="ready" data-id="${o.id}" style="background:#1E5442">Mark ready</button><button class="btn ln sm" data-a="addTime" data-id="${o.id}">+5 min</button></div>`;
    if (o.status === 'ready') return `<button class="btn dk" data-a="complete" data-id="${o.id}">${o.fulfil === 'delivery' ? 'Handed to courier' : 'Customer picked up'}</button>`;
    return '';
  }
  function orderCard(o) {
    return `<div class="card pad col" style="${o.status === 'new' ? 'border:2px solid var(--o)' : ''}">
      <div class="row between"><button class="btn gh" data-a="detail" data-id="${o.id}" style="padding:0;min-height:0;color:var(--ink)"><b style="font-size:20px">${o.id}</b>&nbsp;<span class="mut">· ${esc(o.customer)} ›</span></button>${o.status === 'new' ? `<b style="font-size:20px;font-variant-numeric:tabular-nums" data-cd="${o.deadline}">5:00</b>` : statusPill(o)}</div>
      <div class="row wrap sm-t"><span class="pill ${o.fulfil === 'delivery' ? 'p-g' : 'p-n'}">${o.fulfil === 'delivery' ? 'Delivery' : 'Pickup'}</span><span class="mut">Placed ${fmtTime(o.placed)}</span>${o.status === 'preparing' ? `<span class="mut">· ready by ${fmtTime(new Date(o.readyAt))}</span>` : ''}</div>
      <div>${itemsList(o)}</div>
      ${o.note ? `<div class="note n-w sm-t"><b>Customer note:</b> ${esc(o.note)}</div>` : ''}
      <div class="rw sm-t"><span class="mut">Food ${money(o.food)} · tax ${money(o.tax)}${o.share ? ` · your delivery share ${money(o.share)}` : ''}</span>${can('orderMoney') ? `<button class="btn gh" data-a="money" data-id="${o.id}" style="min-height:0;padding:0;font-size:13px">You get ${money(o.net)} →</button>` : ''}</div>
      ${actions(o)}</div>`;
  }

  // ---------- screens ----------
  const V = {};
  V.signin = () => `<div class="col" style="min-height:${PHONE ? '100%' : '100vh'};justify-content:center;align-items:center;padding:24px 16px;background:${PHONE ? 'var(--bg)' : 'var(--g)'}"><div class="card pad col" style="width:100%;max-width:420px;gap:14px;padding:24px">
    <span class="logo" style="font-size:22px;color:var(--ink)">${LOGO('', 49)}${WORD} <span class="pill p-g">for restaurants</span></span>
    <h1 style="font-size:26px;color:var(--ink)">${S.codeSent ? 'Enter your code' : 'Sign in to your restaurant'}</h1>
    <p class="mut" style="margin:0">${S.codeSent ? `We texted a 6-digit code to ${esc(S.phone)}. <b>Prototype: any 6 digits work.</b>` : 'Owners, managers and staff sign in with a text code. No passwords.'}</p>
    ${S.codeSent ? `<label class="f">6-digit code<input class="in" id="r-code" data-m="code" inputmode="numeric" maxlength="6" value="${esc(S.code)}" style="font-size:22px;letter-spacing:.4em;text-align:center;font-weight:800"></label><button class="btn" data-a="verify">Sign in</button><button class="btn gh" data-a="changePhone">Use a different number</button>` : `<label class="f">Mobile number<input class="in" id="r-phone" data-m="phone" inputmode="tel" placeholder="(718) 555-0100" value="${esc(S.phone)}"></label><button class="btn" data-a="sendCode">Text me a code</button>`}
    <div class="note n-g row wrap" style="gap:8px"><span class="grow"><b>New to Send Koro?</b> List your restaurant: $0 commission, first month free.</span><button class="btn sm" data-a="toSignup">Create account</button></div><button class="btn ln" data-a="lcTab" data-to="learn" style="white-space:normal;line-height:1.25;padding-block:10px">How Send Koro works: Learning center</button></div></div>`;

  const RV = window.SK_REVIEWS;
  const RV_LOCS = Object.entries(RV.LOCS).filter(([, L]) => L.branch).map(([k, L]) => [k, L]);
  if (!S.reviews) S.reviews = RV.clone().filter((r) => RV_LOCS.some(([k]) => k === r.loc));
  const rvLocKey = (bid) => (RV_LOCS.find(([, L]) => L.branch === bid) || [])[0];
  const rvMini = () => { const k = rvLocKey(B().id); const sm = k && RV.summary(k); if (!sm || B().status !== 'live') return '';
    const open = S.reviews.filter((r) => r.loc === k && r.complaint && r.complaint.status === 'open').length; const noReply = S.reviews.filter((r) => r.loc === k && !r.reply).length;
    return `<button class="card pad row wrap" data-a="${PHONE ? 'go' : 'tabTo'}" data-to="reviews" style="text-align:left;width:100%;gap:12px;align-items:center"><span class="col" style="gap:2px"><span class="mut sm-t">Customer rating · ${esc(B().name)}</span><b style="font-size:24px;color:var(--ink)">★ ${sm.rating.toFixed(1)} <span class="mut sm-t" style="font-weight:600">${sm.count.toLocaleString('en-US')} ratings</span></b></span><span class="grow"></span><span class="pill ${open ? 'p-r' : 'p-g'}">${open} open complaint${open === 1 ? '' : 's'}</span><span class="pill p-n">${noReply} without a reply</span><span class="mut">›</span></button>`; };
  V.reviews = () => {
    const st = S.rv; const locs = RV_LOCS.filter(([, L]) => S.branches.some((b) => b.id === L.branch));
    const keys = st.loc === 'all' ? locs.map(([k]) => k) : [st.loc];
    const list = S.reviews.filter((r) => keys.includes(r.loc)).filter((r) => st.f === 'all' || (st.f === 'complaints' ? r.complaint : st.f === 'low' ? r.stars <= 3 : !r.reply));
    const sums = keys.map((k) => RV.summary(k)).filter(Boolean);
    const notices = RV.NOTICES.filter((n) => keys.includes(n.loc));
    const actions = (r) => st.replyId === r.id ? `<div class="col" style="gap:8px"><label class="f">Public reply<textarea class="in" id="rv-reply" data-m="rv.draft" maxlength="600" placeholder="Thank the customer or explain what you’re doing about it">${esc(st.draft)}</textarea></label><div class="row wrap"><button class="btn sm" data-a="rvReplySave" data-id="${r.id}">Post reply</button><button class="btn gh sm" data-a="rvReplyCancel">Cancel</button></div><span class="mut sm-t">Replies are public. Don’t share personal details or argue; refunds go through “Report a problem”.</span></div>`
      : `<div class="row wrap" style="gap:8px">${r.reply ? `<button class="btn gh sm" data-a="rvReplyOpen" data-id="${r.id}">Edit reply</button>` : `<button class="btn ln sm" data-a="rvReplyOpen" data-id="${r.id}">Reply</button>`}${r.reported ? '<span class="pill p-n">Reported to Send Koro</span>' : `<button class="btn gh sm" data-a="rvReport" data-id="${r.id}">Report review</button>`}</div>`;
    return `${head('Ratings and reviews', 'What customers say about your store · complaints and replies')}${body(`
      ${notices.map((n) => `<div class="note n-r"><b>Notice from Send Koro · ${esc(n.date)}</b><br>${esc(n.text)}</div>`).join('')}
      ${locs.length > 1 ? `<div class="chips" role="tablist">${[['all', 'All locations'], ...locs.map(([k, L]) => [k, L.area])].map(([k, l]) => `<button class="chip ${st.loc === k ? 'on' : ''}" role="tab" aria-selected="${st.loc === k}" data-a="rvLoc" data-v="${k}">${esc(l)}</button>`).join('')}</div>` : ''}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(${PHONE ? 260 : 340}px,1fr));gap:12px">${sums.map((sm) => `<div class="card pad col" style="gap:12px"><b style="font-size:18px">${esc(sm.area)}</b>${RV.summaryHTML(sm)}${RV.complaintsHTML(sm)}</div>`).join('')}</div>
      <div class="note n-w sm-t">Customers see your rating, the complaint categories and counts, the reviews and your replies. Complaint details go only to Send Koro. Repeated or serious complaints (allergen, hygiene) can lead to a warning, a pause or deactivation (Partner Agreement, “Ratings and complaints”).</div>
      <div class="chips" role="tablist">${[['all', 'All'], ['complaints', 'Complaints'], ['low', '1–3 stars'], ['noreply', 'Needs a reply']].map(([k, l]) => `<button class="chip ${st.f === k ? 'on' : ''}" role="tab" aria-selected="${st.f === k}" data-a="rvF" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="rv-list">${list.map((r) => RV.cardHTML(r, 'restaurant', { showLoc: st.loc === 'all' && locs.length > 1, actions: actions(r) })).join('') || '<span class="mut">Nothing here.</span>'}</div>`)}`;
  };
  V.overview = V.home = () => {
    const L = ledgerCalc(LEDGER.oct);
    const today = allOrders().filter((o) => o.status === 'completed' && fmtDay(o.placed) === 'Today');
    const nw = S.orders.filter((o) => o.status === 'new');
    const tiles = [['Orders today', String(today.length)], ['Food sales today', money(today.reduce((a, o) => a + o.food, 0))], ['October net', money(L.net)], ['Plan this month · ' + B().name, planInfo(B()).nowLabel]];
    const pend = S.branches.filter((b) => b.status !== 'live');
    return `${head(PHONE ? S.profile.name : 'Good evening, ' + S.team[0].name.split(' ')[0], PHONE ? (B().accepting ? (S.busy ? 'Open · busy (+15 min)' : 'Open · accepting orders') : 'Paused · not accepting') : S.profile.name + ' · ' + B().name, PHONE ? '' : '<button class="btn sm" data-a="simNew">Simulate new order</button>')}${body(`
      ${PHONE && S.branches.length > 1 ? `<label class="card pad row" style="gap:10px"><b>Location</b><select class="in grow" data-branch="1" style="height:42px">${S.branches.map((b) => `<option value="${b.id}" ${b.id === S.branchId ? 'selected' : ''}>${esc(b.name)}${b.status === 'live' ? '' : ' (setup)'}</option>`).join('')}</select></label>` : ''}
      ${pend.length ? `<button class="note n-w" data-a="setupBranch" data-id="${pend[0].id}" style="border:0;text-align:left;width:100%"><b>${esc(pend[0].name)} isn’t live yet →</b> finish its store setup</button>` : ''}
      ${openCard()}
      ${nw.length ? `<button class="note" data-a="${PHONE ? 'go' : 'tabTo'}" data-to="${PHONE ? 'newOrder' : 'orders'}" style="border:0;text-align:left;background:var(--o);color:#fff;font-size:17px;width:100%"><b>${nw.length} new order${nw.length > 1 ? 's' : ''} waiting</b> · answer before the timer ends →</button>` : ''}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(${PHONE ? 150 : 200}px,1fr));gap:12px">${tiles.map(([l, v]) => `<div class="card pad"><div class="mut sm-t">${l}</div><b style="font-size:24px;color:var(--ink)">${v}</b></div>`).join('')}</div>
      ${rvMini()}
      ${PHONE ? '<button class="btn" data-a="simNew">Simulate a new order</button>' : ''}
      <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start">
      <div class="card pad col" style="flex:2 1 340px"><div class="row between"><b style="font-size:18px">Live orders</b><button class="btn gh" data-a="tabTo" data-to="orders" style="min-height:0">See all →</button></div>${S.orders.length ? S.orders.map((o) => `<button data-a="detail" data-id="${o.id}" class="row" style="border:0;border-top:1px solid var(--line);background:none;padding:10px 0;text-align:left;width:100%"><b style="width:70px">${o.id}</b><span class="grow">${esc(o.customer)} · ${o.lines.reduce((a, l) => a + l[1], 0)} items</span>${o.status === 'new' ? `<b data-cd="${o.deadline}">5:00</b>` : statusPill(o)}</button>`).join('') : '<div class="empty">No live orders.</div>'}</div>
      <div class="card pad col" style="flex:1 1 260px"><b style="font-size:18px">Quick links</b>${[['menu', 'Mark a dish sold out'], ['hours', 'Change today’s hours'], ['history', 'Find a past order'], ['earnings', 'See this month’s money'], ['delivery', 'Who pays delivery']].filter(([k]) => can(k)).map(([k, l]) => `<button class="row" data-a="go" data-to="${k}" style="border:0;border-top:1px solid var(--line);background:none;padding:10px 0;text-align:left;width:100%"><span class="grow">${l}</span><span class="mut">›</span></button>`).join('')}</div></div>
      <div class="note n-g"><b>$0 commission.</b> You keep your food sales minus card processing (2.9% + 30¢ on food) and any delivery share you choose. Your plan is a flat monthly fee.</div>`)}`;
  };

  V.newOrder = () => {
    const o = S.orders.find((x) => x.status === 'new');
    if (!o) return `${head('New order')}${body(`<div class="card empty col" style="align-items:center"><b style="color:var(--ink);font-size:18px">No new orders right now</b><span>New orders ring and open this screen.</span><button class="btn" data-a="simNew">Simulate a new order</button><button class="btn ln sm" data-a="tab" data-to="orders">Go to live orders</button></div>`)}`;
    const others = S.orders.filter((x) => x.status === 'new').length - 1;
    return `<div style="background:var(--o);color:#0A1F18;padding:18px 16px;text-align:center" class="col"><span style="font-weight:800;letter-spacing:.1em;font-size:13px">NEW ORDER${others ? ` · ${others} MORE WAITING` : ''}</span><b style="font-size:48px;font-variant-numeric:tabular-nums;line-height:1" data-cd="${o.deadline}">5:00</b><span style="font-size:14px">left to answer</span></div>
      ${body(`<div class="row between"><div><b style="font-size:24px">${o.id}</b><div class="mut">${esc(o.customer)} · ${o.fulfil === 'delivery' ? 'Delivery' : 'Pickup'} · placed ${fmtTime(o.placed)}</div></div><span class="pill ${o.fulfil === 'delivery' ? 'p-g' : 'p-n'}">${o.fulfil === 'delivery' ? 'Courier coming' : 'Customer collects'}</span></div>
      <div class="card pad col" style="gap:4px">${itemsList(o)}</div>
      ${o.note ? `<div class="note n-w"><b>Customer note:</b> ${esc(o.note)}</div>` : ''}
      <div class="card pad col" style="gap:2px">${moneyLines(o, false)}</div>
      ${actions(o)}`)}`;
  };

  V.orders = () => {
    const col = (st, title) => { const list = S.orders.filter((o) => o.status === st); return `<div class="col" style="flex:1 1 300px;min-width:0"><div class="row between"><b style="font-size:17px">${title}</b><span class="pill p-n">${list.length}</span></div>${list.map((o) => orderCard(o)).join('') || '<div class="card empty">Nothing here.</div>'}</div>`; };
    return `${head('Live orders', `${S.orders.length} active`, `${can('history') ? `<button class="btn ln sm" data-a="go" data-to="history">History</button>` : ''}<button class="btn sm" data-a="simNew">${PHONE ? '+ Test' : 'Simulate new order'}</button>`)}${body(`<div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start">${col('new', 'New')}${col('preparing', 'Preparing')}${col('ready', 'Ready')}</div>
      ${done.length ? `<div class="card pad col"><b>Finished this session</b>${done.map((o) => `<button data-a="detail" data-id="${o.id}" class="row" style="border:0;border-top:1px solid var(--line);background:none;padding:8px 0;text-align:left;width:100%"><b style="width:70px">${o.id}</b><span class="grow">${esc(o.customer)}${o.reason ? `<span class="mut sm-t" style="display:block">${esc(o.reason)}</span>` : ''}</span>${statusPill(o)}</button>`).join('')}</div>` : ''}`)}`;
  };

  // Order money card: delivery orders always show the delivery fee and who pays it (customer, restaurant, or split).
  function moneyLines(o, declined) {
    const r = (l, v, cls = '') => `<div class="rw ${cls}"><span class="mut">${l}</span><span>${v}</span></div>`;
    const cust = o.fee - o.share;
    const who = !o.fee ? '' : !o.share ? 'Customer pays all' : !cust ? 'You pay all (free delivery)' : 'Split';
    const del = o.fulfil !== 'delivery' ? r('Pickup', 'No delivery fee')
      : r('Delivery fee', money(o.fee)) + `<div class="rw"><span class="mut sm-t" style="padding-left:12px">${who}: customer ${money(cust)} · you ${money(o.share)}</span><span></span></div>` + r('Courier tip <span class="sm-t">(100% to the courier)</span>', money(o.tip));
    return r('Food', money(o.food)) + del + r(`Tax you collected (${esc(B().taxRate)}%)`, money(o.tax))
      + (o.credit ? r('Send Koro promo credit <span class="sm-t">(paid by Send Koro)</span>', money(-o.credit), 'save') : '')
      + `<div class="rw" style="border-top:1px solid var(--line);padding-top:6px"><b>${o.credit ? 'Customer’s card paid' : 'Customer paid'}</b><b>${declined ? '$0.00 (hold released)' : money(o.total)}</b></div>`
      + `<b class="sm-t" style="margin-top:10px">You get</b>` + r('Food + tax', money(o.food + o.tax)) + (o.share ? r('Your delivery share', money(-o.share)) : '') + r('Card processing on food', money(-processing(o.food))) + r('Send Koro commission', '$0.00')
      + (o.credit && !declined ? r('Paid to your Stripe account now', money(o.net - o.credit)) + r('Promo credit, reimbursed on your next monthly invoice', money(o.credit)) : '')
      + `<div class="rw tot"><span>You get</span><span>${declined ? '$0.00' : money(o.net)}</span></div>`;
  }
  V.orderDetail = () => {
    const o = findAny(S.detailId); if (!o) return V.orders();
    const declined = o.status === 'declined';
    return `${head('Order ' + o.id, `${esc(o.customer)} · ${fmtDay(o.placed)} ${fmtTime(o.placed)}`)}${body(narrow(`
      <div class="card pad col"><div class="row between wrap"><div class="row wrap">${statusPill(o)}<span class="pill ${o.fulfil === 'delivery' ? 'p-g' : 'p-n'}">${o.fulfil === 'delivery' ? 'Delivery' : 'Pickup'}</span></div>${o.status === 'new' ? `<b style="font-size:20px" data-cd="${o.deadline}">5:00</b>` : ''}</div>
        ${o.reason ? `<div class="note n-r sm-t">${esc(o.reason)}. The customer was never charged.</div>` : ''}
        <div>${itemsList(o)}</div>${o.note ? `<div class="note n-w sm-t"><b>Customer note:</b> ${esc(o.note)}</div>` : ''}${actions(o)}</div>
      <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start">
      <div class="card pad col" style="flex:1 1 280px;gap:10px"><b>Timeline</b><ol style="list-style:none;margin:0;padding:0" class="col">${o.timeline.map(([t, d]) => `<li class="row" style="align-items:flex-start"><span style="width:10px;height:10px;border-radius:99px;background:#1E5442;margin-top:5px;flex:none"></span><span class="grow">${esc(t)}</span><span class="mut sm-t">${fmtTime(d)}</span></li>`).join('')}</ol></div>
      <div class="card pad col" style="flex:1 1 280px;gap:2px"><b style="margin-bottom:6px">Money</b>${moneyLines(o, declined)}${can('orderMoney') ? `<button class="btn gh" data-a="money" data-id="${o.id}" style="align-self:flex-start;padding:0">Full breakdown →</button>` : ''}</div></div>
      <div class="card pad col"><b>Need help with this order?</b><span class="mut sm-t">Missing item, courier issue or a customer complaint: our team handles refunds and talks to the customer.</span><button class="btn ln sm" data-a="helpFor" data-id="${o.id}" style="align-self:flex-start">Report a problem</button></div>`))}`;
  };

  V.history = () => {
    const H = S.hist; const q = H.q.trim().toLowerCase();
    const list = [...done, ...PAST].filter((o) => {
      const age = (Date.now() - o.placed.getTime()) / DAYMS;
      if (H.range === 'today' && fmtDay(o.placed) !== 'Today') return false;
      if (H.range === 'week' && age > 7) return false;
      if (H.status !== 'all' && o.status !== H.status) return false;
      if (q && !(o.id.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q))) return false;
      return true;
    }).sort((a, b) => b.placed - a.placed);
    const sum = list.filter((o) => o.status === 'completed').reduce((a, o) => a + o.food, 0);
    return `${head('Order history', `${list.length} orders · ${money(sum)} food sales`)}${body(`
      <div class="row wrap"><label class="row grow" style="min-width:220px;height:46px;padding:0 12px;border-radius:10px;border:1.5px solid var(--line2);background:var(--card)"><span class="mut">⌕</span><input id="h-q" data-m="hist.q" data-live="1" placeholder="Search order number or customer" value="${esc(H.q)}" style="border:0;outline:0;flex:1;min-width:0;background:transparent"></label></div>
      <div class="chips">${[['today', 'Today'], ['week', 'Last 7 days'], ['all', 'All time']].map(([k, l]) => `<button class="chip ${H.range === k ? 'on' : ''}" data-a="histRange" data-v="${k}">${l}</button>`).join('')}<span style="width:8px;flex:none"></span>${[['all', 'All'], ['completed', 'Completed'], ['declined', 'Declined']].map(([k, l]) => `<button class="chip ${H.status === k ? 'on' : ''}" data-a="histStatus" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="card col" style="gap:0;padding:4px 16px">${list.length ? list.map((o) => `<button data-a="detail" data-id="${o.id}" class="row" style="border:0;border-bottom:1px solid var(--line);background:none;padding:12px 0;text-align:left;width:100%;flex-wrap:wrap"><b style="width:70px">${o.id}</b><span class="grow" style="min-width:140px">${esc(o.customer)}<span class="mut sm-t" style="display:block">${fmtDay(o.placed)} ${fmtTime(o.placed)} · ${o.fulfil === 'delivery' ? 'Delivery' : 'Pickup'} · ${o.lines.reduce((a, l) => a + l[1], 0)} items</span></span>${statusPill(o)}<b style="width:80px;text-align:right">${o.status === 'completed' ? money(o.food) : '$0.00'}</b></button>`).join('') : '<div class="empty">No orders match.</div>'}</div>`)}`;
  };

  V.menu = () => {
    ensureMenus();
    const sec = S.menu[S.menuTab]; const L = S.menuLoc || 'all'; const isAll = L === 'all';
    const br = S.branches.find((b) => b.id === L); if (!isAll && !br) S.menuLoc = 'all';
    const total = S.menu.reduce((a, s) => a + s.items.length, 0);
    const here = isAll ? total : S.menu.reduce((a, s) => a + s.items.filter((it) => soldAt(it, L)).length, 0);
    const card = (it, i) => {
      const sold = isAll || soldAt(it, L); const on = isAll ? it.on : onAt(it, L); const price = isAll ? it.price : priceAt(it, L);
      const varies = isAll && S.branches.some((b) => soldAt(it, b.id) && priceAt(it, b.id) !== it.price);
      const offSome = isAll && it.on && S.branches.some((b) => soldAt(it, b.id) && !onAt(it, b.id));
      return `<div class="card" style="display:flex;gap:12px;padding:12px;${sold && on ? '' : 'opacity:.7'}">${it.img ? `<img src="${IMG(it.img)}" alt="" style="width:76px;height:76px;border-radius:10px;object-fit:cover;flex:none">` : `<span style="width:76px;height:76px;border-radius:10px;background:var(--gt);flex:none;display:flex;align-items:center;justify-content:center;color:var(--gx);font-size:12px;font-weight:700">No photo</span>`}
        <div class="col grow" style="gap:4px;min-width:0"><b>${esc(it.name)}${it.popular ? ' <span class="pill p-n" style="font-size:11px">Popular</span>' : ''}</b>${promoFor(it) ? `<span class="pill p-r" style="align-self:flex-start;font-size:11px">${esc(badgeText(promoFor(it)))}</span>` : ''}<div class="row wrap" style="gap:4px">${dietBadges(it)}${it.cal ? `<span class="mut sm-t">${esc(it.cal)} cal</span>` : ''}</div><span class="mut sm-t">${esc(it.desc)}${it.groups.length ? ` · ${it.groups.length} option group${it.groups.length > 1 ? 's' : ''}` : ''}</span>
        <div class="row between wrap" style="gap:6px"><b>${money(price)}${!isAll && price !== it.price ? ` <span class="mut sm-t" style="font-weight:600">(main ${money(it.price)})</span>` : ''}${varies ? ' <span class="mut sm-t" style="font-weight:600">· price varies</span>' : ''}</b>${!sold ? '<span class="pill p-n">Not sold here</span>' : `<span class="pill ${on ? 'p-g' : 'p-r'}">${on ? (offSome ? 'Sold out at some' : 'Available') : isAll && it.soldUntil === 'off' ? 'Sold out · until turned on' : 'Sold out today'}</span>`}</div>
        ${isAll ? `<span class="sm-t" style="color:var(--gx);font-weight:700">${whereText(it)}</span>` : ''}
        <div class="row between">${sold ? `<label class="row sm-t">${sw(`data-a="${isAll ? 'toggleItem' : 'toggleItemLoc'}" data-i="${i}"`, on, it.name + ' available')}${isAll ? 'All locations' : 'Here'}</label>` : `<button class="btn ln sm" data-a="sellHere" data-i="${i}">Sell at ${esc(br.name)}</button>`}<button class="btn ln sm" data-a="editItem" data-i="${i}">Edit</button></div></div></div>`;
    };
    return `${head('Menu', isAll ? `All locations · ${total} items` : `${br.name} · ${here} of ${total} dishes sold here`, `<button class="btn ln sm" data-a="addSection">+ Section</button><button class="btn sm" data-a="newItem">+ Add item</button>`)}${body(`
      ${menuTabs('menu')}
      <div class="row wrap" style="gap:8px"><b class="sm-t">Showing</b><div class="chips">${[['all', 'All locations'], ...S.branches.map((b) => [b.id, b.name])].map(([k, l]) => `<button class="chip ${L === k ? 'on' : ''}" data-a="menuLoc" data-v="${k}">${esc(l)}</button>`).join('')}</div></div>
      <div class="note ${isAll ? 'n-g' : 'n-w'} sm-t">${isAll ? 'You’re editing the menu for <b>all locations</b>. Pick a location above to set its own prices, mark dishes sold out only there, or choose which dishes it sells.' : `You’re editing <b>${esc(br.name)}</b> only. Sold out and price changes here don’t affect your other locations.`}</div>
      <div class="chips" role="tablist">${S.menu.map((s, i) => `<button class="chip ${i === S.menuTab ? 'on' : ''}" role="tab" aria-selected="${i === S.menuTab}" data-a="menuTab" data-i="${i}">${esc(s.s)} (${s.items.length})</button>`).join('')}</div>
      ${sec.items.length ? '' : `<div class="card empty col" style="align-items:center"><b style="color:var(--ink)">No dishes in ${esc(sec.s)} yet</b><div class="row"><button class="btn sm" data-a="newItem">+ Add item</button><button class="btn ln sm" data-a="delSection" style="color:var(--red);border-color:var(--red)">Delete section</button></div></div>`}
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(${PHONE ? 280 : 340}px,1fr));gap:12px">${sec.items.map(card).join('')}</div>`)}`;
  };
  const soldAt = (it, bid) => !it.where || it.where === 'all' || it.where.includes(bid);
  const ovr = (it, bid) => (it.over && it.over[bid]) || {};
  const priceAt = (it, bid) => (ovr(it, bid).price != null ? ovr(it, bid).price : it.price);
  const onAt = (it, bid) => it.on && ovr(it, bid).on !== false;
  const whereText = (it) => (!it.where || it.where === 'all' ? `All ${S.branches.length} locations` : `${it.where.length} of ${S.branches.length} locations: ${S.branches.filter((b) => it.where.includes(b.id)).map((b) => b.name).join(', ')}`);
  function editFrom(it, idx, sec) {
    const over = {}; S.branches.forEach((b) => { const o = ovr(it, b.id); over[b.id] = { price: o.price != null ? (o.price / 100).toFixed(2) : '', on: o.on !== false }; });
    const some = !!(it.where && it.where !== 'all'); const set = {}; S.branches.forEach((b) => { set[b.id] = some ? it.where.includes(b.id) : true; });
    normItem(it); return { idx, sec, orig: sec, name: it.name, desc: it.desc, price: (it.price / 100).toFixed(2), pickupPrice: it.pickupPrice != null ? (it.pickupPrice / 100).toFixed(2) : '', popular: !!it.popular, diet: [...it.diet], cal: it.cal, taxable: it.taxable !== false, state: it.on ? 'on' : it.soldUntil === 'off' ? 'off' : 'today', avail: it.avail, availDays: [...it.availDays], availFrom: it.availFrom, availTo: it.availTo, on: it.on, img: it.img, groups: JSON.parse(JSON.stringify(it.groups)).map((g) => ({ ...g, choices: g.choices.map((c) => [c[0], typeof c[1] === 'number' ? (c[1] / 100).toFixed(2) : c[1], !!c[2], !!c[3]]) })), over, whereSome: some, whereSet: set };
  }
  function newEdit() {
    const over = {}; const set = {}; S.branches.forEach((b) => { over[b.id] = { price: '', on: true }; set[b.id] = S.menuLoc && S.menuLoc !== 'all' ? b.id === S.menuLoc : true; });
    return { isNew: true, sec: S.menuTab, name: '', desc: '', price: '', pickupPrice: '', popular: false, diet: [], cal: '', taxable: true, state: 'on', avail: 'menu', availDays: ['1', '2', '3', '4', '5'], availFrom: '11:00', availTo: '15:00', on: true, img: '', groups: [], over, whereSome: !!(S.menuLoc && S.menuLoc !== 'all'), whereSet: set };
  }
  function locCard(e) {
    return `<div class="card pad col"><b style="font-size:17px">Locations and prices</b>
      ${[['all', 'Sell at all locations', 'Also added automatically to any new location'], ['some', 'Only at some locations', 'Pick the locations below']].map(([k, l, x]) => `<label class="opt ${(k === 'some') === !!e.whereSome ? 'on' : ''}"><input type="radio" name="ew" data-a="editWhere" data-v="${k}" ${(k === 'some') === !!e.whereSome ? 'checked' : ''}><span class="grow"><b>${l}</b><span class="mut sm-t" style="display:block">${x}</span></span></label>`).join('')}
      <div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;min-width:${PHONE ? 300 : 460}px;font-size:14px"><thead><tr style="text-align:left"><th style="padding:6px">Location</th><th style="padding:6px">Price here</th><th style="padding:6px">Available</th></tr></thead><tbody>
      ${S.branches.map((b) => { const sold = !e.whereSome || e.whereSet[b.id]; const o = e.over[b.id] || (e.over[b.id] = { price: '', on: true }); return `<tr style="border-top:1px solid var(--line);${sold ? '' : 'opacity:.5'}"><td style="padding:8px 6px">${e.whereSome ? `<label class="row" style="gap:8px"><input type="checkbox" data-a="editWhereLoc" data-id="${b.id}" ${e.whereSet[b.id] ? 'checked' : ''} style="width:18px;height:18px">${esc(b.name)}</label>` : `<b>${esc(b.name)}</b>`}</td><td style="padding:6px"><input class="in" id="eo-${b.id}-p" data-m="edit.over.${b.id}.price" inputmode="decimal" value="${esc(o.price)}" placeholder="${esc(e.price || '0.00')} (main)" style="width:130px;height:40px" ${sold ? '' : 'disabled'} aria-label="Price at ${esc(b.name)}"></td><td style="padding:6px">${sw(`data-m="edit.over.${b.id}.on" ${sold ? '' : 'disabled'}`, o.on, 'Available at ' + b.name)}</td></tr>`; }).join('')}</tbody></table></div>
      <span class="mut sm-t">Leave a price empty to use the main price. Turning off “Available” marks the dish sold out at just that location.</span></div>`;
  }

  // ---------- menu model upgrades, modelled on Uber Eats Menu Maker and the DoorDash Merchant Portal ----------
  const DIET = [['veg', 'Vegetarian'], ['vegan', 'Vegan'], ['gf', 'Gluten-free'], ['halal', 'Halal'], ['spicy', 'Spicy'], ['nuts', 'Contains nuts'], ['dairy', 'Contains dairy']];
  const DAYS = [['1', 'Mon'], ['2', 'Tue'], ['3', 'Wed'], ['4', 'Thu'], ['5', 'Fri'], ['6', 'Sat'], ['0', 'Sun']];
  const SEED_DIET = { gcb: ['halal', 'dairy'], slm: ['gf'], hrv: ['veg', 'gf', 'dairy'], scb: ['spicy', 'halal'], igt: ['vegan', 'gf'], lmd: ['vegan', 'gf'] };
  const SEED_CAL = { gcb: '620', slm: '710', hrv: '380', scb: '540', igt: '0', lmd: '140' };
  function normItem(it) {
    if (it.diet) return it;
    it.diet = [...(SEED_DIET[it.id] || [])]; it.cal = SEED_CAL[it.id] || ''; it.pickupPrice = null; it.taxable = true; it.popular = it.id === 'gcb';
    it.soldUntil = it.on ? null : 'today'; it.avail = 'menu'; it.availDays = ['1', '2', '3', '4', '5']; it.availFrom = '11:00'; it.availTo = '15:00';
    it.groups.forEach((g) => { if (g.min == null) { g.min = g.required ? 1 : 0; g.free = 0; g.each = 1; g.choices = g.choices.map((c, i) => [c[0], c[1], g.required && i === 0, false]); } });
    return it;
  }
  function ensureMenus() {
    S.menu.forEach((s) => { if (!s.menus) s.menus = ['m1']; if (s.desc == null) s.desc = ''; s.items.forEach(normItem); });
    if (!S.menus) S.menus = [{ id: 'm1', name: 'All day', days: ['1', '2', '3', '4', '5', '6', '0'], from: '11:00', to: '22:00' }, { id: 'm2', name: 'Lunch specials', days: ['1', '2', '3', '4', '5'], from: '11:00', to: '15:00' }];
    if (!S.promos) S.promos = SEED_PROMOS();
  }
  const allItems = () => S.menu.flatMap((s) => s.items);
  const itemById = (id) => allItems().find((it) => it.id === id);
  const t12 = (t) => { const [h, m] = String(t).split(':').map(Number); return `${((h + 11) % 12) + 1}${m ? ':' + String(m).padStart(2, '0') : ''} ${h < 12 ? 'AM' : 'PM'}`; };
  const daysText = (ds) => (ds.length === 7 ? 'Every day' : ds.join() === '1,2,3,4,5' ? 'Mon–Fri' : DAYS.filter(([k]) => ds.includes(k)).map(([, l]) => l).join(', '));
  const timeOK = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t));
  const dayChips = (path, ds) => `<div class="chips" style="flex-wrap:wrap">${DAYS.map(([k, l]) => `<button class="chip ${ds.includes(k) ? 'on' : ''}" data-a="dayToggle" data-p="${path}" data-v="${k}" aria-pressed="${ds.includes(k)}">${l}</button>`).join('')}</div>`;
  const menuTabs = (cur) => menuTabs2(cur);
  const dietBadges = (it) => it.diet.filter((d) => !['nuts', 'dairy'].includes(d)).map((d) => `<span class="pill p-n" style="font-size:11px">${DIET.find((x) => x[0] === d)[1]}</span>`).join('');

  // ---------- promotions (restaurant-funded, Send Koro charges nothing to run them) ----------
  const PROMO_TYPES = {
    bogo: ['Buy 1, get 1 free', 'Customers buy a dish and get a second one of the same dish free.', 'Item'],
    item: ['Discount on items', 'A percentage or dollar amount off the dishes you pick.', 'Item'],
    freeitem: ['Free item with order', 'A dish of your choice is free when the order reaches a minimum.', 'Item'],
    spend: ['Spend $X, save $Y', 'Money off the whole order above a minimum spend.', 'Order'],
    storewide: ['Percent off the order', 'A percentage off the food, with an optional cap.', 'Order'],
    freedel: ['Free delivery', 'You pay the delivery fee when the order reaches a minimum.', 'Delivery'],
  };
  const AUD = [['all', 'All customers'], ['new', 'New customers'], ['returning', 'Returning customers'], ['lapsed', 'Haven’t ordered in 30 days']];
  function SEED_PROMOS() {
    return [
      { id: 'p1', type: 'bogo', name: 'Buy 1 Grilled Chicken Bowl, get 1 free', items: ['gcb'], limit: '1', pct: '', amt: '', mode: 'pct', freeItem: '', min: '0', save: '', maxOff: '', audience: 'all', locs: 'all', locSet: {}, start: '2026-11-02', endMode: 'end', end: '2026-11-30', sched: 'open', days: ['1', '2', '3', '4', '5', '6', '0'], from: '11:00', to: '22:00', budget: '150', once: true, status: 'live', stats: { orders: 38, sales: 124800, cost: 57000 } },
      { id: 'p2', type: 'spend', name: 'Spend $30, save $5', items: [], limit: '1', pct: '', amt: '', mode: 'pct', freeItem: '', min: '30', save: '5', maxOff: '', audience: 'new', locs: 'all', locSet: {}, start: '2026-10-15', endMode: 'ongoing', end: '', sched: 'open', days: ['1', '2', '3', '4', '5', '6', '0'], from: '11:00', to: '22:00', budget: '', once: true, status: 'live', stats: { orders: 21, sales: 79800, cost: 10500 } },
      { id: 'p3', type: 'item', name: 'Happy hour: 20% off salads and bowls', items: ['hrv', 'slm'], limit: '1', pct: '20', amt: '', mode: 'pct', freeItem: '', min: '0', save: '', maxOff: '', audience: 'all', locs: 'some', locSet: { b1: true }, start: '2026-11-09', endMode: 'ongoing', end: '', sched: 'custom', days: ['1', '2', '3', '4', '5'], from: '14:00', to: '17:00', budget: '75', once: false, status: 'scheduled', stats: { orders: 0, sales: 0, cost: 0 } },
      { id: 'p4', type: 'freeitem', name: 'Free Mint Lemonade over $25', items: [], limit: '1', pct: '', amt: '', mode: 'pct', freeItem: 'lmd', min: '25', save: '', maxOff: '', audience: 'lapsed', locs: 'all', locSet: {}, start: '2026-09-01', endMode: 'end', end: '2026-09-30', sched: 'open', days: ['1', '2', '3', '4', '5', '6', '0'], from: '11:00', to: '22:00', budget: '', once: true, status: 'ended', stats: { orders: 54, sales: 172200, cost: 24300 } },
    ];
  }
  const promoBlank = (type) => ({ id: '', isNew: true, type, name: '', items: [], limit: '1', pct: '20', amt: '2.00', mode: 'pct', freeItem: '', min: type === 'spend' ? '30' : type === 'freeitem' || type === 'freedel' ? '25' : '0', save: '5', maxOff: '', audience: 'all', locs: 'all', locSet: Object.fromEntries(S.branches.map((b) => [b.id, true])), start: '2026-11-08', endMode: 'ongoing', end: '', sched: 'open', days: ['1', '2', '3', '4', '5', '6', '0'], from: '11:00', to: '15:00', budget: '', once: type !== 'item', status: 'draft', stats: { orders: 0, sales: 0, cost: 0 } });
  const toC = (v) => Math.round((parseFloat(v) || 0) * 100);
  function promoSummary(p) {
    const n = (ids) => ids.map((id) => (itemById(id) || { name: '?' }).name).join(', ');
    return {
      bogo: `Buy 1, get 1 free · ${n(p.items) || 'pick dishes'}${+p.limit > 1 ? ` · up to ${p.limit} free per order` : ''}`,
      item: `${p.mode === 'pct' ? (p.pct || '?') + '% off' : money(toC(p.amt)) + ' off'} · ${n(p.items) || 'pick dishes'}`,
      freeitem: `Free ${(itemById(p.freeItem) || { name: 'dish' }).name} on orders over ${money(toC(p.min))}`,
      spend: `Save ${money(toC(p.save))} on orders over ${money(toC(p.min))}`,
      storewide: `${p.pct || '?'}% off the food${+p.min ? ` over ${money(toC(p.min))}` : ''}${p.maxOff ? ` · up to ${money(toC(p.maxOff))} off` : ''}`,
      freedel: `Free delivery on orders over ${money(toC(p.min))}`,
    }[p.type];
  }
  const badgeText = (p) => ({ bogo: 'Buy 1, get 1 free', item: p.mode === 'pct' ? `${p.pct}% off` : `${money(toC(p.amt))} off`, freeitem: `Free ${(itemById(p.freeItem) || { name: 'item' }).name}`, spend: `Save ${money(toC(p.save))}`, storewide: `${p.pct}% off`, freedel: 'Free delivery' }[p.type]);
  const promoFor = (it) => (S.promos || []).find((p) => p.status === 'live' && ['bogo', 'item'].includes(p.type) && p.items.includes(it.id));
  // Worked example in cents: what the customer pays for food + tax, and what the promotion costs the restaurant.
  function promoExample(p) {
    const rate = Math.round((parseFloat(B().taxRate) || 0) * 10000); // ppm, 8.875% = 88750
    const first = itemById(p.items[0]) || itemById('gcb');
    let lines; let off = 0; let delOff = 0;
    if (p.type === 'bogo') { lines = [[first.name, first.price], [first.name, first.price], ['Mint Lemonade', 450]]; off = first.price * Math.min(1, +p.limit || 1); }
    else if (p.type === 'item') { lines = [[first.name, first.price], ['Mint Lemonade', 450]]; off = p.mode === 'pct' ? Math.floor((first.price * (parseFloat(p.pct) || 0)) / 100) : Math.min(first.price, toC(p.amt)); }
    else { lines = [['Grilled Chicken Bowl', 1500], ['Salmon Bowl', 1300], ['Mint Lemonade', 450]]; const F = 3250; const min = toC(p.min);
      if (p.type === 'spend') off = F >= min ? toC(p.save) : 0;
      if (p.type === 'storewide') { off = F >= min ? Math.floor((F * (parseFloat(p.pct) || 0)) / 100) : 0; if (p.maxOff) off = Math.min(off, toC(p.maxOff)); }
      if (p.type === 'freeitem') { const fi = itemById(p.freeItem); if (fi && F >= min) { lines.push([fi.name + ' (free)', fi.price]); off = fi.price; } }
      if (p.type === 'freedel') delOff = F >= min ? 848 : 0; } // the restaurant pays the whole delivery fee as its delivery share
    const before = lines.reduce((a, l) => a + l[1], 0); const food = before - off; const taxC = Math.round((food * rate) / 1000000);
    return { lines, before, off, food, taxC, rate, delOff };
  }

  V.menus = () => {
    ensureMenus();
    return `${head('Menus and hours', 'When each menu shows to customers', '<button class="btn sm" data-a="addMenu">+ Menu</button>')}${body(`
      ${menuTabs('menus')}
      <div class="note n-g sm-t">A dish shows only while one of its menus is open <b>and</b> the location is open. Use a second menu for breakfast, lunch specials or late night.</div>
      ${S.menus.map((m, mi) => `<div class="card pad col"><div class="row wrap between"><label class="f grow" style="min-width:200px">Menu name<input class="in" id="mn-${mi}" data-m="menus.${mi}.name" value="${esc(m.name)}"></label>${S.menus.length > 1 ? `<button class="btn gh" data-a="delMenu" data-i="${mi}" style="color:var(--red)">Delete menu</button>` : ''}</div>
        <b class="sm-t">Days</b>${dayChips('menus.' + mi + '.days', m.days)}
        <div class="row wrap"><label class="f" style="width:150px">From<input class="in" type="time" id="mf-${mi}" data-m="menus.${mi}.from" value="${esc(m.from)}"></label><label class="f" style="width:150px">To<input class="in" type="time" id="mt-${mi}" data-m="menus.${mi}.to" value="${esc(m.to)}"></label></div>
        <b class="sm-t">Categories in this menu</b><div class="chips" style="flex-wrap:wrap">${S.menu.map((s, si) => `<button class="chip ${s.menus.includes(m.id) ? 'on' : ''}" data-a="secMenu" data-s="${si}" data-m="${m.id}" aria-pressed="${s.menus.includes(m.id)}">${esc(s.s)}</button>`).join('')}</div>
        <span class="mut sm-t">${daysText(m.days)} · ${timeOK(m.from) && timeOK(m.to) ? t12(m.from) + ' – ' + t12(m.to) : 'set times'}</span></div>`).join('')}
      <div class="note n-g sm-t">Rename, reorder or hide categories on the <button class="btn gh" data-a="menuSwitch" data-to="cats" style="min-height:0;padding:0;font-size:13px">Categories</button> tab.</div>
      <button class="btn" data-a="saveMenus" style="align-self:flex-start">Save menus</button>`)}`;
  };

  V.promos = () => {
    ensureMenus();
    const P = S.promos; const live = P.filter((p) => p.status === 'live'); const sched = P.filter((p) => p.status === 'scheduled' || p.status === 'paused');
    const sum = (k) => P.reduce((a, p) => a + p.stats[k], 0);
    const pill = (p) => ({ live: '<span class="pill p-g">Live</span>', scheduled: '<span class="pill p-n">Scheduled</span>', paused: '<span class="pill p-o">Paused</span>', ended: '<span class="pill p-n">Ended</span>' }[p.status]);
    const row = (p, i) => `<div class="card pad col" style="gap:6px"><div class="row between wrap"><b style="font-size:17px">${esc(p.name)}</b>${pill(p)}</div>
      <span class="sm-t">${esc(promoSummary(p))}</span>
      <span class="mut sm-t">${AUD.find((a) => a[0] === p.audience)[1]} · ${p.locs === 'all' ? 'All locations' : S.branches.filter((b) => p.locSet[b.id]).map((b) => esc(b.name)).join(', ')} · ${p.start}${p.endMode === 'end' ? ' to ' + p.end : ', ongoing'} · ${p.sched === 'open' ? 'Whenever you’re open' : daysText(p.days) + ' ' + t12(p.from) + '–' + t12(p.to)}${p.budget ? ` · ${money(toC(p.budget))}/week budget` : ''}</span>
      <div class="row wrap sm-t" style="gap:16px"><span><span class="mut">Orders</span> <b>${p.stats.orders}</b></span><span><span class="mut">Food sales</span> <b>${money(p.stats.sales)}</b></span><span><span class="mut">Discount you paid</span> <b>${money(p.stats.cost)}</b></span></div>
      <div class="row wrap">${p.status !== 'ended' ? `<button class="btn ln sm" data-a="promoEdit" data-i="${i}">Edit</button><button class="btn ln sm" data-a="promoPause" data-i="${i}">${p.status === 'paused' ? 'Resume' : 'Pause'}</button><button class="btn gh" data-a="promoEnd" data-i="${i}" style="color:var(--red)">End now</button>` : `<button class="btn ln sm" data-a="promoCopy" data-i="${i}">Run again</button>`}</div></div>`;
    return `${head('Promotions', 'Offers on your menu · you fund the discount, Send Koro charges nothing to run it', '<button class="btn sm" data-a="promoNew">+ Create promotion</button>')}${body(`
      ${menuTabs('promos')}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px">${[['Live now', live.length], ['Scheduled or paused', sched.length], ['Orders with a promotion', sum('orders')], ['Discount you paid', money(sum('cost'))]].map(([l, v]) => `<div class="card pad col" style="gap:2px"><span class="mut sm-t">${l}</span><b style="font-size:22px">${v}</b></div>`).join('')}</div>
      ${S.promoPick ? `<div class="card pad col"><div class="row between"><b style="font-size:18px">Choose a promotion type</b><button class="btn gh" data-a="promoPickClose">Cancel</button></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(${PHONE ? 260 : 240}px,1fr));gap:10px">${Object.entries(PROMO_TYPES).map(([k, [l, d, g]]) => `<button class="card pad col" data-a="promoStart" data-v="${k}" style="text-align:left;gap:4px;cursor:pointer"><span class="pill p-n" style="align-self:flex-start;font-size:11px">${g}</span><b>${l}</b><span class="mut sm-t">${d}</span></button>`).join('')}</div></div>` : ''}
      ${P.map(row).join('')}
      <div class="note n-g sm-t"><b>How promotions are paid.</b> The discount comes off your food price, so you pay it; there’s no marketing fee and no commission. Sales tax is charged on the price after your discount. One promotion per order: if several apply, the customer gets the one that saves them most.</div>`)}`;
  };

  V.editPromo = () => {
    ensureMenus();
    const p = S.pdraft; const [tl, td] = PROMO_TYPES[p.type]; const ex = promoExample(p);
    const itemPick = (multi) => `<div class="chips" style="flex-wrap:wrap">${allItems().map((it) => { const on = multi ? p.items.includes(it.id) : p.freeItem === it.id; return `<button class="chip ${on ? 'on' : ''}" data-a="${multi ? 'pItem' : 'pFree'}" data-v="${it.id}" aria-pressed="${on}">${esc(it.name)} · ${money(it.price)}</button>`; }).join('')}</div>`;
    const inp = (k, label, ph, w = 140, mode = 'decimal') => `<label class="f" style="width:${w}px">${label}<input class="in" id="pd-${k}" data-m="pdraft.${k}" data-live="1" inputmode="${mode}" value="${esc(p[k])}" placeholder="${ph}"></label>`;
    const offer = {
      bogo: `<b>Dishes</b>${itemPick(true)}<label class="f" style="width:220px">Free dishes per order (most)<select class="in" data-m="pdraft.limit" data-rr="1">${['1', '2', '3'].map((v) => `<option ${p.limit === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>`,
      item: `<b>Dishes</b>${itemPick(true)}<div class="row">${[['pct', 'Percent off'], ['amt', 'Dollar amount off']].map(([k, l]) => `<button class="chip ${p.mode === k ? 'on' : ''}" data-a="pMode" data-v="${k}">${l}</button>`).join('')}</div><div class="row wrap">${p.mode === 'pct' ? inp('pct', 'Percent off', '20', 140, 'numeric') : inp('amt', 'Amount off ($)', '2.00')}</div>`,
      freeitem: `<b>Free dish</b>${itemPick(false)}<div class="row wrap">${inp('min', 'Minimum food subtotal ($)', '25.00', 220)}</div>`,
      spend: `<div class="row wrap">${inp('min', 'Spend at least ($)', '30.00', 180)}${inp('save', 'Customer saves ($)', '5.00', 180)}</div>`,
      storewide: `<div class="row wrap">${inp('pct', 'Percent off food', '15', 160, 'numeric')}${inp('min', 'Minimum subtotal ($, optional)', '0', 220)}${inp('maxOff', 'Most off per order ($, optional)', 'No cap', 220)}</div>`,
      freedel: `<div class="row wrap">${inp('min', 'Minimum food subtotal ($)', '25.00', 220)}</div><span class="mut sm-t">The delivery fee is paid by you as your delivery share (same as the Delivery fee rule). Customers see “Free delivery” and pay $0.00 for delivery.</span>`,
    }[p.type];
    const exRows = [...ex.lines.map((l) => [esc(l[0]), money(l[1])]), ['<b>Food before promotion</b>', money(ex.before)], ...(ex.off ? [[`${esc(S.profile.name)} offer`, '−' + money(ex.off)]] : []), ['<b>Food the customer pays</b>', `<b>${money(ex.food)}</b>`], [`Sales tax (${B().taxRate || '0'}%, on the price after the offer)`, money(ex.taxC)], ...(p.type === 'freedel' ? [['Delivery fee', '$8.48'], ...(ex.delOff ? [['You pay (your delivery share, whole fee)', '−' + money(ex.delOff)], ['<b>Customer pays for delivery</b>', `<b>${money(848 - ex.delOff)}</b>`]] : [])] : [])];
    const prevItem = itemById(p.type === 'freeitem' ? p.freeItem : p.items[0]) || itemById('gcb');
    return `${head(p.isNew ? 'Create promotion' : 'Edit promotion', tl)}${body(`<div style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start">
      <div class="col" style="flex:3 1 460px;min-width:0">
      <div class="card pad col"><span class="pill p-n" style="align-self:flex-start">${tl}</span><span class="mut sm-t">${td}</span>
        ${offer}
        <label class="f">Promotion name (customers see it)<input class="in" id="pd-name" data-m="pdraft.name" value="${esc(p.name)}" placeholder="${esc(promoSummary(p))}"></label></div>
      <div class="card pad col"><b style="font-size:17px">Who and where</b>
        <b class="sm-t">Customers</b><div class="chips" style="flex-wrap:wrap">${AUD.map(([k, l]) => `<button class="chip ${p.audience === k ? 'on' : ''}" data-a="pAud" data-v="${k}">${l}</button>`).join('')}</div>
        <b class="sm-t">Locations</b><div class="row wrap">${[['all', 'All locations'], ['some', 'Only some']].map(([k, l]) => `<button class="chip ${p.locs === k ? 'on' : ''}" data-a="pLocs" data-v="${k}">${l}</button>`).join('')}</div>
        ${p.locs === 'some' ? `<div class="chips" style="flex-wrap:wrap">${S.branches.map((b) => `<button class="chip ${p.locSet[b.id] ? 'on' : ''}" data-a="pLoc" data-v="${b.id}" aria-pressed="${!!p.locSet[b.id]}">${esc(b.name)}</button>`).join('')}</div>` : ''}
        <label class="row">${sw('data-m="pdraft.once" data-rr="1"', p.once, 'Once per customer')}Once per customer</label></div>
      <div class="card pad col"><b style="font-size:17px">When</b>
        <div class="row wrap"><label class="f" style="width:180px">Start date<input class="in" type="date" id="pd-start" data-m="pdraft.start" value="${esc(p.start)}"></label>
        <div class="col" style="gap:6px"><b class="sm-t">Ends</b><div class="row">${[['ongoing', 'Keep it going'], ['end', 'On a date']].map(([k, l]) => `<button class="chip ${p.endMode === k ? 'on' : ''}" data-a="pEnd" data-v="${k}">${l}</button>`).join('')}</div></div>
        ${p.endMode === 'end' ? `<label class="f" style="width:180px">End date<input class="in" type="date" id="pd-end" data-m="pdraft.end" value="${esc(p.end)}"></label>` : ''}</div>
        <b class="sm-t">Hours</b><div class="row wrap">${[['open', 'Whenever you’re open'], ['custom', 'Certain days and times (happy hour, lunch special)']].map(([k, l]) => `<button class="chip ${p.sched === k ? 'on' : ''}" data-a="pSched" data-v="${k}">${l}</button>`).join('')}</div>
        ${p.sched === 'custom' ? `${dayChips('pdraft.days', p.days)}<div class="row wrap"><label class="f" style="width:150px">From<input class="in" type="time" id="pd-from" data-m="pdraft.from" value="${esc(p.from)}"></label><label class="f" style="width:150px">To<input class="in" type="time" id="pd-to" data-m="pdraft.to" value="${esc(p.to)}"></label></div>` : ''}
        <label class="f" style="width:260px">Weekly budget ($, optional)<input class="in" id="pd-budget" data-m="pdraft.budget" inputmode="decimal" value="${esc(p.budget)}" placeholder="No cap"></label><span class="mut sm-t">When the discounts you’ve paid this week reach the budget, the promotion pauses until Monday.</span></div>
      <div class="row wrap"><button class="btn grow" data-a="promoSave">${p.isNew ? 'Start promotion' : 'Save changes'}</button><button class="btn ln" data-a="back">Cancel</button></div></div>
      <div class="col" style="flex:2 1 300px;min-width:0">
        <div class="card pad col"><b>What customers see</b>
          <div class="card" style="display:flex;gap:10px;padding:10px;background:var(--bg)">${prevItem.img ? `<img src="${IMG(prevItem.img)}" alt="" style="width:64px;height:64px;border-radius:10px;object-fit:cover;flex:none">` : ''}<div class="col" style="gap:4px;min-width:0"><b>${esc(prevItem.name)}</b><span class="sm-t">${money(prevItem.price)}</span><span class="pill p-r" style="align-self:flex-start">${esc(badgeText(p))}</span></div></div>
          <span class="mut sm-t">${PROMO_TYPES[p.type][2] === 'Item' ? 'A badge on the dish, plus the offer at the top of your menu.' : 'A banner at the top of your menu and a badge on your listing.'} The cart shows a line “${esc(S.profile.name)} offer”.</span></div>
        <div class="card pad col" style="gap:2px"><b style="margin-bottom:6px">Example order</b>${exRows.map(([a, b]) => `<div class="rw"><span>${a}</span><span>${b}</span></div>`).join('')}
          <div class="rw" style="border-top:1px solid var(--line);padding-top:6px"><span class="mut">This promotion costs you</span><b>${money(ex.off + ex.delOff)}</b></div>
          <span class="mut sm-t">Delivery fee and tip are separate. Card processing is charged on the lower total, and the discount lowers your net food sales for the monthly plan.</span></div>
      </div></div>`)}`;
  };

  V.editItem = () => {
    ensureMenus();
    const e = S.edit; const rate = B().taxRate || '0';
    const chk = (path, on, label) => `<button class="chip ${on ? 'on' : ''}" data-a="flip" data-p="${path}" aria-pressed="${on}">${label}</button>`;
    return `${head(e.isNew ? 'Add item' : 'Edit item', S.menu[+e.sec].s)}${body(narrow(`<div class="card pad col">
      <div class="row" style="align-items:flex-start;gap:14px">${e.img ? `<img src="${IMG(e.img)}" alt="" style="width:110px;height:110px;border-radius:12px;object-fit:cover">` : '<span style="width:110px;height:110px;border-radius:12px;background:var(--gt);display:flex;align-items:center;justify-content:center;color:var(--gx);font-weight:700;font-size:13px">No photo</span>'}<div class="col grow"><b>Photo</b><span class="mut sm-t">Show the real dish as customers get it. JPG or PNG, at least 1400 × 800, wide (16:9) works on every screen.</span><label class="btn ln sm" style="align-self:flex-start;cursor:pointer">Upload photo<input type="file" accept="image/*" data-photo="edit" style="position:absolute;width:1px;height:1px;opacity:0"></label>${e.img ? '<button class="btn gh" data-a="removePhoto" style="align-self:flex-start;padding:0;min-height:30px;color:var(--red)">Remove photo</button>' : ''}</div></div>
      <label class="f">Name<input class="in" id="e-name" data-m="edit.name" value="${esc(e.name)}" maxlength="60"></label>
      <label class="f">Description<textarea class="in" id="e-desc" data-m="edit.desc" maxlength="300" placeholder="Main ingredients, how it’s cooked, portion size">${esc(e.desc)}</textarea></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label class="f">Price (USD)<input class="in" id="e-price" data-m="edit.price" inputmode="decimal" value="${esc(e.price)}"></label><label class="f">Section<select class="in" id="e-sec" data-m="edit.sec">${S.menu.map((s, i) => `<option value="${i}" ${i === +e.sec ? 'selected' : ''}>${esc(s.s)}</option>`).join('')}</select></label></div>
      <label class="f">Pickup price (optional)<input class="in" id="e-pprice" data-m="edit.pickupPrice" inputmode="decimal" value="${esc(e.pickupPrice)}" placeholder="Same as price" style="max-width:220px"></label>
      <label class="row">${sw('data-m="edit.popular"', e.popular, 'Popular')}Mark as popular (shown first with a “Popular” label)</label></div>
      <div class="card pad col"><b style="font-size:17px">Dietary and allergens</b><div class="chips" style="flex-wrap:wrap">${DIET.map(([k, l]) => chk('diet.' + k, e.diet.includes(k), l)).join('')}</div>
        <label class="f" style="max-width:220px">Calories (optional)<input class="in" id="e-cal" data-m="edit.cal" inputmode="numeric" value="${esc(e.cal)}" placeholder="e.g. 620 or 450-600"></label>
        <span class="mut sm-t">Labels help customers filter. NYC requires calories on menus for chains with 15 or more locations nationwide. Only tick a label you can stand behind.</span></div>
      <div class="card pad col"><b style="font-size:17px">Availability</b>
        ${[['on', 'Available'], ['today', 'Sold out today', 'Back on automatically when you open tomorrow'], ['off', 'Sold out until I turn it back on']].map(([k, l, x]) => `<label class="opt ${e.state === k ? 'on' : ''}"><input type="radio" name="est" data-a="editState" data-v="${k}" ${e.state === k ? 'checked' : ''}><span class="grow"><b>${l}</b>${x ? `<span class="mut sm-t" style="display:block">${x}</span>` : ''}</span></label>`).join('')}
        <b class="sm-t">When it can be ordered</b><div class="row wrap">${[['menu', 'Whenever its menu is open'], ['custom', 'Only certain days and times']].map(([k, l]) => `<button class="chip ${e.avail === k ? 'on' : ''}" data-a="editAvail" data-v="${k}">${l}</button>`).join('')}</div>
        ${e.avail === 'custom' ? `${dayChips('edit.availDays', e.availDays)}<div class="row wrap"><label class="f" style="width:150px">From<input class="in" type="time" id="e-af" data-m="edit.availFrom" value="${esc(e.availFrom)}"></label><label class="f" style="width:150px">To<input class="in" type="time" id="e-at" data-m="edit.availTo" value="${esc(e.availTo)}"></label></div>` : ''}</div>
      <div class="card pad col"><b style="font-size:17px">Sales tax</b>${[[true, `Taxable at each location’s rate (${rate}% here)`], [false, 'Not taxable']].map(([k, l]) => `<label class="opt ${e.taxable === k ? 'on' : ''}"><input type="radio" name="etx" data-a="editTax" data-v="${k}" ${e.taxable === k ? 'checked' : ''}><span class="grow"><b>${l}</b></span></label>`).join('')}<span class="mut sm-t">You decide and you file. Restaurant food and drinks in NY are normally taxable; ask your accountant before marking anything not taxable.</span></div>
      ${locCard(e)}
      <div class="card pad col"><div class="row between"><b style="font-size:17px">Options</b><div class="row"><button class="btn gh" data-a="copyGroups">Copy from a dish</button><button class="btn ln sm" data-a="addGroup">+ Option group</button></div></div><span class="mut sm-t">Sizes, extras or choices customers pick. Prices are added to the dish price.</span>
      ${S.copyFrom ? `<div class="chips" style="flex-wrap:wrap">${allItems().filter((it) => it.groups.length && it.name !== e.name).map((it) => `<button class="chip" data-a="copyGroupsFrom" data-v="${it.id}">${esc(it.name)} (${it.groups.length})</button>`).join('') || '<span class="mut sm-t">No other dish has options yet.</span>'}</div>` : ''}
      ${e.groups.map((g, gi) => `<div class="card pad col" style="background:var(--bg)"><label class="f">Group name (what customers are asked)<input class="in" id="g-${gi}-name" data-m="edit.groups.${gi}.name" value="${esc(g.name)}" placeholder="e.g. Choose a size"></label>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px"><label class="f">Pick at least<input class="in" id="g-${gi}-min" data-m="edit.groups.${gi}.min" data-live="1" inputmode="numeric" value="${esc(g.min)}"></label><label class="f">Pick up to<input class="in" id="g-${gi}-max" data-m="edit.groups.${gi}.max" inputmode="numeric" value="${esc(g.max)}"></label><label class="f">Free choices<input class="in" id="g-${gi}-free" data-m="edit.groups.${gi}.free" inputmode="numeric" value="${esc(g.free)}"></label><label class="f">Most of each choice<input class="in" id="g-${gi}-each" data-m="edit.groups.${gi}.each" inputmode="numeric" value="${esc(g.each)}"></label></div>
        <span class="mut sm-t">${+g.min > 0 ? 'Required' : 'Optional'}. ${+g.free > 0 ? `The ${g.free} cheapest picks are free.` : ''} “Most of each” above 1 lets customers add the same choice more than once (e.g. 2× extra chicken).</span>
        <div class="row sm-t mut" style="gap:8px"><span class="grow">Choice</span><span style="width:96px">Extra price</span><span style="width:62px">Default</span><span style="width:70px">In stock</span><span style="width:36px"></span></div>
        ${g.choices.map((c, ci) => `<div class="row"><input class="in" id="c-${gi}-${ci}-n" data-m="edit.groups.${gi}.choices.${ci}.0" value="${esc(c[0])}" placeholder="Choice" aria-label="Choice name" style="min-width:0"><input class="in" id="c-${gi}-${ci}-p" data-m="edit.groups.${gi}.choices.${ci}.1" value="${typeof c[1] === 'number' ? (c[1] / 100).toFixed(2) : esc(c[1])}" inputmode="decimal" style="width:96px;flex:none" aria-label="Extra price"><span style="width:62px;flex:none;display:flex;justify-content:center"><input type="checkbox" data-a="choiceDef" data-g="${gi}" data-c="${ci}" ${c[2] ? 'checked' : ''} aria-label="Selected by default" style="width:20px;height:20px;accent-color:var(--g)"></span><span style="width:70px;flex:none">${sw(`data-a="choiceStock" data-g="${gi}" data-c="${ci}"`, !c[3], 'In stock')}</span><button class="btn gh" data-a="delChoice" data-g="${gi}" data-c="${ci}" aria-label="Remove choice" style="color:var(--red);width:36px;flex:none">✕</button></div>`).join('')}
        <div class="row between"><button class="btn gh" data-a="addChoice" data-g="${gi}" style="padding:0">+ Add choice</button><button class="btn gh" data-a="delGroup" data-g="${gi}" style="padding:0;color:var(--red)">Delete group</button></div></div>`).join('') || '<div class="mut sm-t">No options. Customers order the dish as is.</div>'}</div>
      <div class="note n-g sm-t">You set your own prices; Send Koro takes $0 commission. Want to run a deal on this dish? Use <button class="btn gh" data-a="menuSwitch" data-to="promos" style="min-height:0;padding:0;font-size:13px">Promotions</button>.</div>
      <div class="row wrap"><button class="btn grow" data-a="saveItem">Save item</button>${e.isNew ? '' : '<button class="btn ln" data-a="delItem" style="color:var(--red);border-color:var(--red)">Delete</button>'}</div>`))}`;
  };

  V.earnings = () => {
    const L = ledgerCalc(LEDGER[S.month]);
    const recent = [...done, ...PAST].filter((o) => o.status === 'completed').sort((a, b) => b.placed - a.placed).slice(0, 8);
    return `${head('Earnings', 'Money goes straight to your Stripe account')}${body(`
      <div class="row" role="tablist" style="padding:4px;border-radius:12px;background:var(--card);border:1px solid var(--line);align-self:flex-start">${[['oct', 'October'], ['sep', 'September']].map(([k, l]) => `<button role="tab" aria-selected="${S.month === k}" data-a="month" data-v="${k}" style="height:38px;padding:0 16px;border:0;border-radius:9px;font-weight:700;background:${S.month === k ? 'var(--g)' : 'transparent'};color:${S.month === k ? '#fff' : 'inherit'}">${l}</button>`).join('')}</div>
      <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start">
      <div class="card pad col" style="flex:999 1 380px;gap:2px"><b style="font-size:18px;margin-bottom:6px">${L.label} · ${L.orders} orders</b>
        <div class="rw"><span>Food sales</span><span>${money(L.food)}</span></div>
        <div class="rw"><span>Sales tax collected <span class="mut sm-t">(you file and pay it)</span></span><span>${money(L.tax)}</span></div>
        <div class="rw"><span>Your delivery share</span><span>${money(-L.share)}</span></div>
        <div class="rw"><span>Card processing on food <span class="mut sm-t">(2.9% + 30¢)</span></span><span>${money(-L.proc)}</span></div>
        <div class="rw"><span>Refunds</span><span>${money(-L.refunds)}</span></div>
        <div class="rw"><span>Send Koro plan</span><span>${L.plan ? money(-L.plan) : '$0.00'}</span></div>
        <div class="rw"><span>Commission</span><span>$0.00</span></div>
        <div class="rw tot"><span>Net to you</span><span>${money(L.net)}</span></div>
        <span class="mut sm-t">${esc(L.planNote)}. Delivery fees and 100% of tips go to delivery and couriers, not to Send Koro.</span></div>
      <div class="card pad col" style="flex:1 1 280px"><b style="font-size:18px">Payouts</b>${PAYOUTS.slice(0, 3).map((p) => `<button data-a="go" data-to="payouts" class="row" style="border:0;border-top:1px solid var(--line);background:none;padding:8px 0;text-align:left;width:100%"><span class="grow">${p.date} · ${money(p.net)}</span><span class="pill p-g">Paid</span></button>`).join('')}<button class="btn ln sm" data-a="go" data-to="payouts">All payouts</button></div></div>
      <div class="card pad col"><b style="font-size:18px">Order money</b><span class="mut sm-t">Tap an order to see exactly where every cent goes.</span>${recent.map((o) => `<button data-a="money" data-id="${o.id}" class="row" style="border:0;border-top:1px solid var(--line);background:none;padding:10px 0;text-align:left;width:100%"><b style="width:70px">${o.id}</b><span class="grow">${esc(o.customer)} · food ${money(o.food)}</span><b>${money(o.net)}</b><span class="mut">›</span></button>`).join('')}</div>`)}`;
  };

  V.orderMoney = () => {
    const o = findAny(S.moneyId); if (!o) return V.earnings();
    const proc = processing(o.food); const declined = o.status === 'declined';
    return `${head('Order ' + o.id, 'Where the money goes')}${body(narrow(`
      ${declined ? '<div class="note n-r">Declined. The customer was never charged and nothing was paid out.</div>' : ''}
      <div class="card pad col" style="gap:2px"><b style="margin-bottom:6px">Customer paid ${declined ? '(hold released)' : ''}</b>
        <div class="rw"><span>Food</span><span>${money(o.food)}</span></div>
        ${o.fee ? `<div class="rw"><span>Delivery fee</span><span>${money(o.fee)}</span></div>${o.share ? `<div class="rw save"><span>${esc(S.profile.name)} pays part</span><span>${money(-o.share)}</span></div>` : ''}` : '<div class="rw"><span>Pickup, no delivery fee</span><span>$0.00</span></div>'}
        <div class="rw"><span>Tax (${esc(B().taxRate)}%)</span><span>${money(o.tax)}</span></div>
        ${o.fee ? `<div class="rw"><span>Courier tip</span><span>${money(o.tip)}</span></div>` : ''}
        ${o.credit ? `<div class="rw save"><span>Send Koro promo credit (paid by Send Koro)</span><span>${money(-o.credit)}</span></div>` : ''}
        <div class="rw tot"><span>${o.credit ? 'Customer’s card paid' : 'Total'}</span><span>${money(o.total)}</span></div></div>
      ${o.credit ? `<div class="note n-g sm-t">The customer used ${money(o.credit)} of Send Koro promo credit. Your card payout is ${money(o.credit)} lower today, and Send Koro pays it back as a credit on your next monthly invoice, so you still get the full food price.</div>` : ''}
      <div class="card pad col" style="gap:2px"><b style="margin-bottom:6px">You get</b>
        <div class="rw"><span>Food</span><span>${money(o.food)}</span></div>
        <div class="rw"><span>Tax you collected (you remit it)</span><span>${money(o.tax)}</span></div>
        ${o.share ? `<div class="rw"><span>Your delivery share</span><span>${money(-o.share)}</span></div>` : ''}
        <div class="rw"><span>Card processing on food (2.9% + 30¢)</span><span>${money(-proc)}</span></div>
        <div class="rw"><span>Send Koro commission</span><span>$0.00</span></div>
        <div class="rw tot"><span>Net to you</span><span>${declined ? '$0.00' : money(o.net)}</span></div></div>
      ${o.fee ? `<div class="card pad col" style="gap:2px"><b style="margin-bottom:6px">Delivery money</b><div class="rw"><span>Delivery fee (${money(o.fee - o.share)} customer + ${money(o.share)} you)</span><span>${money(o.fee)}</span></div><div class="rw"><span>Tip, 100% to the courier</span><span>${money(o.tip)}</span></div><span class="mut sm-t">This pays for the delivery. It is not a commission on your food.</span></div>` : ''}
      <div class="mut sm-t">Check: ${money(o.food)} + ${money(o.tax)}${o.share ? ` − ${money(o.share)}` : ''} − ${money(proc)} = ${money(o.net)}.</div>`))}`;
  };

  const MAIN_ACCT = 'acct_…4F2';
  const acctOf = (b) => (b.payout === 'own' ? (b.ownConnected ? b.ownAcct : null) : (S.stripe ? MAIN_ACCT : null));
  V.payouts = () => {
    const b = S.branches.find((x) => x.id === S.payBranch) || B(); const acct = acctOf(b);
    const sharers = S.branches.filter((x) => x.payout !== 'own' && x.id !== b.id).map((x) => x.name);
    const list = b.id === 'b1' ? PAYOUTS : [];
    return `${head('Payouts', 'Each location can be paid into its own Stripe account')}${body(`
      <div class="row wrap" style="gap:8px"><b class="sm-t">Location</b><div class="chips">${S.branches.map((x) => `<button class="chip ${x.id === b.id ? 'on' : ''}" data-a="payBranch" data-id="${x.id}">${esc(x.name)}</button>`).join('')}</div></div>
      <div class="card pad col" style="border:2px solid var(--g)"><div class="row between wrap"><span><span class="mut sm-t">Stripe account for ${esc(b.name)}</span><b style="display:block;font-size:20px;color:var(--ink)">${b.payout === 'own' ? 'Its own Stripe account' : 'Your main Stripe account'}</b></span>${acct ? `<span class="pill p-g">Connected · ${acct}</span>` : '<span class="pill p-r">Not connected</span>'}</div>
        <span class="sm-t">${b.payout === 'own' ? `Food money from ${esc(b.name)} orders goes straight to this location’s own account, and it gets its own payouts.` : `Food money from ${esc(b.name)} orders goes to your main account${sharers.length ? `, shared with ${sharers.map(esc).join(', ')}` : ''}.`} Each order is charged directly on the location’s account; Send Koro never holds your food money.</span>
        <div class="row wrap">${b.payout === 'own' ? `${b.ownConnected ? '' : '<button class="btn sm" data-a="payConnectOwn">Connect Stripe for this location</button>'}<button class="btn ln sm" data-a="payUseMain">Use the main account instead</button>` : `${S.stripe ? '' : '<button class="btn sm" data-a="connectStripe">Connect your main Stripe account</button>'}<button class="btn ln sm" data-a="payUseOwn">Use a separate account for ${esc(b.name)}</button>`}</div></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(${PHONE ? 150 : 220}px,1fr));gap:12px"><div class="card pad"><div class="mut sm-t">Next payout · Mon Nov 10</div><b style="font-size:24px;color:var(--ink)">${list.length ? '≈ ' + money(98420) : '$0.00'}</b></div><div class="card pad"><div class="mut sm-t">Bank account</div><b style="font-size:18px">${acct ? (b.payout === 'own' ? 'Chase •••• 1203' : 'Chase •••• 6789') : '—'}</b></div><div class="card pad"><div class="mut sm-t">Schedule</div><b style="font-size:18px">Every Monday</b></div></div>
      <div class="card col" style="gap:0;padding:4px 16px">${list.length ? list.map((p) => `<div style="border-bottom:1px solid var(--line)"><button data-a="payout" data-id="${p.id}" aria-expanded="${S.payoutOpen === p.id}" class="row" style="border:0;background:none;padding:12px 0;width:100%;text-align:left"><span class="grow"><b>${p.date}</b><span class="mut sm-t" style="display:block">${p.period} · ${p.orders} orders</span></span><span class="pill p-g">Paid</span><b style="width:100px;text-align:right">${money(p.net)}</b><span class="mut">${S.payoutOpen === p.id ? '▴' : '▾'}</span></button>${S.payoutOpen === p.id ? `<div class="col" style="gap:2px;padding:0 0 12px"><div class="rw"><span class="mut">Food sales</span><span>${money(p.food)}</span></div><div class="rw"><span class="mut">Sales tax collected</span><span>${money(p.tax)}</span></div><div class="rw"><span class="mut">Your delivery share</span><span>${money(-p.share)}</span></div><div class="rw"><span class="mut">Card processing</span><span>${money(-p.proc)}</span></div><div class="rw"><span class="mut">Refunds</span><span>${money(-p.refunds)}</span></div><div class="rw tot"><span>Paid to your bank</span><span>${money(p.net)}</span></div></div>` : ''}</div>`).join('') : `<div class="empty">No payouts for ${esc(b.name)} yet. They start the Monday after its first orders.</div>`}</div>
      ${list.length ? '<div class="row wrap"><button class="btn ln sm" data-a="copyPayouts">Copy as CSV</button><button class="btn ln sm" data-a="info" data-k="stripe">Update bank on Stripe</button></div>' : ''}`)}`;
  };


  // Stripe tab: the restaurant's own Stripe account inside the portal (real app: Stripe's embedded components).
  const STRIPE_TABS = [['overview', 'Overview'], ['payments', 'Payments'], ['payouts', 'Payouts'], ['documents', 'Statements & tax forms'], ['account', 'Account & bank']];
  V.stripe = () => {
    const b = B(); const acct = acctOf(b); const t = S.stripeTab || 'overview';
    const setup = acct ? (b.status === 'live' ? ['Active', 'p-g', 'Customers can pay you, and Stripe pays out to your bank.'] : ['Stripe is checking', 'p-o', 'Stripe is reviewing your details. This usually takes a few minutes.']) : ['Not set up', 'p-r', 'Connect a Stripe account so customers can pay you.'];
    const paid = [...S.orders.filter((o) => o.status !== 'new'), ...done.filter((o) => o.status !== 'declined')].slice(0, 12);
    const row = (l, v) => `<div class="row between" style="padding:6px 0;border-top:1px solid var(--line)"><span class="mut">${l}</span><b style="text-align:right">${v}</b></div>`;
    const tabs = `<div class="chips" role="tablist" style="flex-wrap:wrap">${STRIPE_TABS.map(([k, l]) => `<button class="chip ${t === k ? 'on' : ''}" role="tab" aria-selected="${t === k}" data-a="stripeTab" data-k="${k}" ${k !== 'overview' && !acct ? 'disabled' : ''}>${l}</button>`).join('')}</div>`;
    const banner = !acct ? `<div class="note n-w sm-t"><b>Stripe needs you:</b> connect a Stripe account for ${esc(b.name)} to take orders. <button class="btn gh" data-a="tabTo" data-to="payouts" style="min-height:0;padding:0">Set up payouts</button></div>` : '';
    let inner = '';
    if (t === 'overview') inner = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(${PHONE ? 240 : 260}px,1fr));gap:12px">
        <div class="card pad col" style="gap:6px"><span class="mut sm-t">Account setup</span><div class="row between"><b style="font-size:20px;color:var(--ink)">${setup[0]}</b><span class="pill ${setup[1]}">${acct ? acct : 'No account'}</span></div><span class="sm-t">${setup[2]}</span>${acct ? '' : '<button class="btn sm" data-a="tabTo" data-to="payouts" style="align-self:flex-start">Connect Stripe</button>'}</div>
        <div class="card pad col" style="gap:0"><span class="mut sm-t" style="padding-bottom:4px">Balance</span>${row('Available', acct ? money(41260) : '—')}${row('On the way (pending)', acct ? money(98420) : '—')}<span class="mut sm-t" style="padding-top:6px">After Stripe’s processing fee on food. Delivery money and tips are already passed on.</span></div>
        <div class="card pad col" style="gap:0"><span class="mut sm-t" style="padding-bottom:4px">Payouts</span>${row('Schedule', acct ? 'Every day (2 days to arrive)' : '—')}${row('Bank', acct ? 'Chase •••• 4410' : '—')}<span class="mut sm-t" style="padding-top:6px">Change the schedule or bank under “Account &amp; bank”. Stripe asks you to sign in.</span></div>
      </div>
      <div class="card col" style="gap:0;padding:4px 16px"><b style="padding:10px 0">Recent payouts</b>${(acct && b.id === 'b1' ? PAYOUTS : []).map((p) => `<div class="row between" style="border-top:1px solid var(--line);padding:10px 0"><span><b>${p.date}</b><span class="mut sm-t" style="display:block">${p.period} · ${p.orders} orders</span></span><span style="text-align:right"><b>${money(p.net)}</b><span class="pill p-g" style="display:block;margin-top:2px">Paid</span></span></div>`).join('') || '<span class="mut sm-t" style="padding:0 0 12px">No payouts yet.</span>'}</div>`;
    if (t === 'payments') inner = `<div class="note sm-t">Every customer payment on your Stripe account. To refund, open the order in <button class="btn gh" data-a="tabTo" data-to="history" style="min-height:0;padding:0">Order history</button> so the delivery part is refunded correctly.</div>
      <div class="card" style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;min-width:${PHONE ? 520 : 640}px;font-size:14px"><thead><tr style="text-align:left">${['Order', 'Customer', 'Customer paid', 'Delivery + tip passed on', 'Card fee on food', 'You get'].map((h, i) => `<th style="padding:10px 12px;${i > 1 ? 'text-align:right' : ''}">${h}</th>`).join('')}</tr></thead><tbody>${paid.map((o) => `<tr style="border-top:1px solid var(--line)"><td style="padding:10px 12px"><b>${o.id}</b><span class="mut sm-t" style="display:block">${fmtTime(o.placed)}</span></td><td style="padding:10px 12px">${esc(o.customer)}</td><td style="padding:10px 12px;text-align:right">${money(o.total)}</td><td style="padding:10px 12px;text-align:right">${money(o.fee - o.share + o.tip)}</td><td style="padding:10px 12px;text-align:right">${money(-processing(o.food))}</td><td style="padding:10px 12px;text-align:right"><b>${money(o.net)}</b></td></tr>`).join('') || `<tr><td colspan="6" class="mut" style="padding:14px 12px">No payments yet. Accept an order to see it here.</td></tr>`}</tbody></table></div>`;
    if (t === 'payouts') inner = `<div class="card pad col" style="gap:0">${row('Available now', money(41260))}${row('On the way', money(98420))}${row('Next payout', 'Tue Nov 11 · ≈ ' + money(98420))}${row('Schedule', 'Every day (2 days to arrive)')}</div>
      <div class="card col" style="gap:0;padding:4px 16px">${PAYOUTS.map((p) => `<div class="row between" style="border-top:1px solid var(--line);padding:10px 0"><span><b>${p.date}</b> · Chase •••• 4410<span class="mut sm-t" style="display:block">${p.id}</span></span><b>${money(p.net)}</b></div>`).join('')}</div>
      <span class="mut sm-t">Instant payouts are off for now.</span>`;
    if (t === 'documents') inner = `<div class="card col" style="gap:0;padding:4px 16px">${[['Monthly statement · October 2026', 'PDF'], ['Monthly statement · September 2026', 'PDF'], ['1099-K · 2025', 'Tax form'], ['Stripe services agreement', 'PDF']].map(([n, k]) => `<div class="row between" style="border-top:1px solid var(--line);padding:12px 0"><span><b>${n}</b><span class="mut sm-t" style="display:block">${k} · from Stripe</span></span><button class="btn ln sm" data-a="toastMsg" data-msg="Downloads from Stripe in the real portal (prototype)">Download</button></div>`).join('')}</div>
      <span class="mut sm-t">Stripe issues your 1099-K for card sales. You file and pay your own sales tax; Send Koro never collects it.</span>`;
    if (t === 'account') inner = `<div class="card pad col" style="gap:0">${row('Business', esc(S.profile.name))}${row('Account', acct || '—')}${row('Bank for payouts', 'Chase •••• 4410')}${row('Payout schedule', 'Every day (2 days to arrive)')}${row('Name on customers’ card statements', esc(S.profile.name).toUpperCase().slice(0, 22))}${row('Support phone', esc(b.phone))}</div>
      <div class="row wrap"><button class="btn ln sm" data-a="toastMsg" data-msg="Stripe asks you to sign in, then you can change the bank (prototype)">Change bank</button><button class="btn ln sm" data-a="toastMsg" data-msg="Stripe asks you to sign in, then you can change the schedule (prototype)">Change payout schedule</button></div>`;
    const dash = '<button class="btn ln sm" data-a="toastMsg" data-msg="Opens dashboard.stripe.com in a new tab (prototype)">Open Stripe Dashboard ↗</button>';
    return `${head('Stripe', PHONE ? 'Your own Stripe account' : 'Your own Stripe account · food money goes straight here', PHONE ? '' : dash)}${body(`${banner}${tabs}${inner}${PHONE ? `<div class="row" style="justify-content:center">${dash}</div>` : ''}`)}`;
  };

  function ruleExample(r) {
    const D = priceD((x) => shareFor(3000, r, x), 3000, tax(3000), 540); const sh = shareFor(3000, r, D);
    return `<div class="card pad col" style="gap:2px;background:var(--gt);border-color:#C9D3CD"><b>Example: $30.00 order, $5.40 tip</b><div class="rw"><span>Delivery fee</span><span>${money(D)}</span></div><div class="rw"><span>You pay</span><span>${money(sh)}</span></div><div class="rw tot"><span>Customer pays for delivery</span><span>${money(D - sh)}</span></div><span class="mut sm-t">The delivery fee is set by distance, so it changes from order to order.</span><span class="mut sm-t">Customers see “Delivery fee” and “${esc(S.profile.name)} pays part”. The courier company is never shown.</span></div>`;
  }
  V.delivery = () => {
    const r = S.ruleDraft || (S.ruleDraft = { ...S.rule });
    const opt = (k, l, d) => `<label class="opt ${r.type === k ? 'on' : ''}"><input type="radio" name="rt" data-a="ruleType" data-v="${k}" ${r.type === k ? 'checked' : ''}><span class="grow"><b>${l}</b><span class="mut sm-t" style="display:block">${d}</span></span></label>`;
    return `${head('Delivery fee', `Rule version ${S.rule.version} · applies to new orders`)}${body(`<div style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start"><div class="card pad col" style="flex:999 1 380px">
      <b style="font-size:18px">Who pays the delivery fee?</b>
      ${opt('customer', 'Customer pays all', 'You pay nothing toward delivery')}
      ${opt('split', 'Split it', 'You pay a fixed amount or a percentage')}
      ${r.type === 'split' ? `<div class="row wrap" style="padding-left:28px"><button class="chip ${r.mode === 'fixed' ? 'on' : ''}" data-a="ruleMode" data-v="fixed">Fixed $</button><button class="chip ${r.mode === 'pct' ? 'on' : ''}" data-a="ruleMode" data-v="pct">Percent</button>${r.mode === 'fixed' ? `<label class="f" style="width:140px">You pay ($)<input class="in" id="r-fixed" data-m="ruleDraft.fixed" data-live="1" inputmode="decimal" value="${esc(r.fixed)}"></label>` : `<label class="f" style="width:140px">You pay (%)<input class="in" id="r-pct" data-m="ruleDraft.pct" data-live="1" inputmode="numeric" value="${esc(r.pct)}"></label>`}</div>` : ''}
      ${opt('freeOver', 'Free delivery over an amount', 'You pay the whole fee on bigger orders')}
      ${r.type === 'freeOver' ? `<label class="f" style="width:180px;margin-left:28px">Orders over ($)<input class="in" id="r-over" data-m="ruleDraft.over" data-live="1" inputmode="decimal" value="${esc(r.over)}"></label>` : ''}
      ${opt('restaurant', 'You pay all', 'Customers see free delivery')}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label class="f">Max per order ($)<input class="in" id="r-cap" data-m="ruleDraft.cap" data-live="1" inputmode="decimal" value="${esc(r.cap)}"></label><label class="f">Monthly budget ($)<input class="in" id="r-budget" data-m="ruleDraft.budget" inputmode="decimal" value="${esc(r.budget)}"></label></div>
      <div><div class="row between sm-t"><span>Used this month</span><b>$412.00 of $${esc(S.rule.budget)}</b></div><div style="height:8px;border-radius:99px;background:var(--line);margin-top:6px"><div style="height:100%;width:${Math.min(100, (41200 / (parseFloat(S.rule.budget) * 100 || 1)) * 100)}%;background:var(--o);border-radius:99px"></div></div><span class="mut sm-t">When the budget runs out, customers pay the full fee until next month.</span></div>
      <button class="btn" data-a="saveRule">Save and agree to new rule</button><span class="mut sm-t">Saving records your consent as a new rule version.</span></div>
      <div style="flex:1 1 280px">${ruleExample(r)}</div></div>`)}`;
  };

  V.team = () => `${head('Team and roles', 'Everyone signs in with a text code')}${body(narrow(`
    <div class="card col" style="gap:0;padding:4px 16px">${S.team.map((m, i) => `<div class="row wrap" style="border-bottom:1px solid var(--line);padding:12px 0"><span style="width:40px;height:40px;border-radius:99px;background:var(--gt);color:var(--ink);display:flex;align-items:center;justify-content:center;font-weight:800;flex:none">${esc(m.name.split(' ').map((w) => w[0]).join('').slice(0, 2))}</span><span class="grow" style="min-width:140px"><b>${esc(m.name)}</b><span class="mut sm-t" style="display:block">${esc(m.phone)}${m.invited ? ' · invite sent' : ''}</span></span>${m.role === 'owner' ? '<span class="pill p-o">Owner</span>' : `<select class="in" data-roleof="${i}" style="width:130px;height:40px" aria-label="Role for ${esc(m.name)}"><option value="manager" ${m.role === 'manager' ? 'selected' : ''}>Manager</option><option value="staff" ${m.role === 'staff' ? 'selected' : ''}>Staff</option></select><button class="btn gh" data-a="removeMember" data-i="${i}" style="color:var(--red);min-height:36px">Remove</button>`}</div>`).join('')}<button class="btn ln sm" data-a="invite" style="align-self:flex-start;margin:12px 0">+ Invite someone</button></div>
    <div class="card pad col"><b style="font-size:17px">What each role can do</b><div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;min-width:420px;font-size:14px"><thead><tr><th style="text-align:left;padding:8px 6px">Area</th><th>Owner</th><th>Manager</th><th>Staff</th></tr></thead><tbody>${[['Live orders: accept, decline, ready', 1, 1, 1], ['Order history', 1, 1, 0], ['Menu and sold out', 1, 1, 0], ['Hours', 1, 1, 0], ['Earnings, payouts and plan', 1, 0, 0], ['Delivery fee rule and tax', 1, 0, 0], ['Team and store profile', 1, 0, 0]].map((r) => `<tr style="border-top:1px solid var(--line)"><td style="padding:8px 6px">${r[0]}</td>${r.slice(1).map((v) => `<td style="text-align:center;color:${v ? '#1E5442' : 'var(--mut)'};font-weight:800">${v ? '✓' : '—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <div class="note n-g sm-t">Try it: switch role with “View as” ${PHONE ? 'on the More screen' : 'at the bottom of the sidebar'}. Pages that role can’t use disappear.</div></div>`))}`;

  V.notifications = () => `${head('Notifications', 'So you never miss an order')}${body(narrow(`
    <div class="card pad col" style="gap:0">${[['sound', 'Ring for new orders', 'Two bell dings and a short tune on this device'], ['repeat', 'Keep ringing until answered', 'Repeats every 10 seconds'], ['sms', 'Text me if not answered in 2 minutes', 'Sent to the owner and managers'], ['email', 'Daily summary email', 'Orders and sales, every night at 11 PM'], ['payouts', 'Payout emails', 'When Stripe pays your bank']].map(([k, l, d]) => `<label class="row" style="border-top:1px solid var(--line);padding:12px 0"><span class="grow"><b>${l}</b><span class="mut sm-t" style="display:block">${d}</span></span>${sw(`data-a="notif" data-k="${k}"`, S.notif[k], l)}</label>`).join('')}<div class="row wrap" style="border-top:1px solid var(--line);padding:12px 0 0;gap:10px"><button class="btn ln sm" data-a="testRing">Play the order sound</button><span class="mut sm-t">Keep this device's volume up and the screen on. The tab title also flashes when the portal is in the background.</span></div></div>
    <button class="btn ln" data-a="testSound" style="align-self:flex-start">Play test sound</button>`))}`;

  V.settings = V.more = () => {
    const link = (to, l, d) => can(to) ? `<button class="row card pad" data-a="go" data-to="${to}" style="text-align:left;width:100%"><span class="grow"><b>${l}</b><span class="mut sm-t" style="display:block">${d}</span></span><span class="mut">›</span></button>` : '';
    const groups = [
      ['Orders', PHONE ? [['reviews', 'Ratings and reviews', 'What customers say, complaints and your replies'], ['history', 'Order history', 'Search past orders'], ['newOrder', 'New order screen', 'Full-screen alert for new orders']] : []],
      ['Money', PHONE ? [['earnings', 'Earnings', 'Net sales and order money'], ['payouts', 'Payouts', 'Weekly payouts to your bank'], ['stripe', 'Stripe', 'Balance, payments, payouts, statements, bank'], ['subscription', 'Subscription', 'A plan for each location, from its own sales']] : []],
      ['Store', [['setup', 'Store setup', S.branches.every((b) => b.status === 'live') ? 'All locations live ✓' : 'Finish setup for ' + S.branches.filter((b) => b.status !== 'live').map((b) => b.name).join(', ')], ['locations', 'Locations', S.branches.length + ' branches'], ['profile', 'Store profile', 'Name, photos, cuisines, extra charges'], ['hours', 'Hours', 'Weekly hours and closures'], ['team', 'Team and roles', `${S.team.length} people`], ['delivery', 'Delivery fee', 'Who pays the delivery fee'], ['tax', 'Sales tax', `${B().taxRate || '—'}% · you file and pay it`], ['legal', 'Licenses and legal', 'Permits, certificates, business details'], ['notifications', 'Notifications', 'Sounds, texts and emails']]],
      ['Support', [['learn', 'Learning center', 'Short videos and guides for every part of Send Koro'], ['legalList', 'Legal documents', 'Partner agreement, privacy, refunds, guidelines'], ['help', 'Help', 'Contact the Send Koro team']]],
    ];
    return `${head(PHONE ? 'More' : 'Settings', S.profile.name)}${body(`
      ${groups.map(([g, ls]) => { const inner = ls.map((x) => link(...x)).join(''); return inner ? `<b class="mut sm-t" style="letter-spacing:.08em;text-transform:uppercase">${g}</b><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(${PHONE ? 260 : 300}px,1fr));gap:10px">${inner}</div>` : ''; }).join('')}
      ${PHONE ? `<div class="card pad col"><b>View as (demo)</b><div class="row">${Object.keys(ROLE).map((r) => `<button class="chip ${S.role === r ? 'on' : ''}" data-a="role" data-v="${r}">${ROLE[r]}</button>`).join('')}</div><span class="mut sm-t">See what each role can open.</span></div><button class="btn ln" data-a="signOut" style="color:var(--red);border-color:var(--red)">Sign out</button>${miniFooter()}` : ''}`)}`;
  };

  V.help = () => {
    const h = S.help;
    return `${head('Help', 'Send Koro restaurant support')}${body(narrow(`
      <button class="card pad row" data-a="go" data-to="learn" style="text-align:left;width:100%"><span class="grow"><b>Learning center</b><span class="mut sm-t" style="display:block">Short videos and guides: setup, menu, orders, delivery fees, refunds, payouts and your plan.</span></span><span class="mut">›</span></button>
      ${h.sent.map((s) => `<div class="note n-g"><b>Request ${s.id} received.</b> ${esc(s.topic)}${s.order ? ' · ' + esc(s.order) : ''} · we reply by text within 1 hour, 11 AM–11 PM.</div>`).join('')}
      <div class="card pad col"><b style="font-size:17px">Contact us</b>
        <label class="f">Topic<select class="in" id="h-topic" data-m="help.topic">${[['order', 'A live order'], ['money', 'Payouts or earnings'], ['menu', 'Menu or photos'], ['delivery', 'Delivery or courier'], ['other', 'Something else']].map(([k, l]) => `<option value="${k}" ${h.topic === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="f">Order number (optional)<input class="in" id="h-order" data-m="help.order" placeholder="SK1048" value="${esc(h.order)}"></label>
        <label class="f">What do you need?<textarea class="in" id="h-msg" data-m="help.msg">${esc(h.msg)}</textarea></label>
        <button class="btn" data-a="sendHelp">Send request</button></div>
      <div class="card pad col"><b>Quick answers</b><details><summary><b>When do I get paid?</b></summary><p class="mut">Stripe pays your bank every Monday. Food money goes straight to your Stripe account on every order.</p></details><details><summary><b>What if I miss an order?</b></summary><p class="mut">After 5 minutes it auto-declines and the customer's hold is released. They are never charged.</p></details><details><summary><b>Who sets the tax?</b></summary><p class="mut">You do. You file and pay your own sales tax. Send Koro never collects it.</p></details><details><summary><b>Who handles refunds?</b></summary><p class="mut">Report the problem on the order. Our team reviews it with you and the customer.</p></details></div>
      <div class="card pad col"><b>Call or email</b><span>Restaurant line: <b style="user-select:all">(718) 555-0150</b></span><span>Email: <b style="user-select:all">info@sendkoro.com</b></span></div>`))}`;
  };

  // ---------- subscription: one plan per location, from that location's sales ----------
  const INVOICES = [
    { id: 'in_2026_10', month: 'October 2026', date: 'Oct 1, 2026', status: 'Paid', lines: [['Park Slope', 'First month free', 0]] },
    { id: 'in_2026_11', month: 'November 2026', date: 'Nov 1, 2026 · Visa •••• 4242', status: 'Paid', lines: [['Park Slope', 'October net food sales ' + money(624000), planFor(624000)], ['Send Koro promo credit', 'Paid back: credit your customers used in October · 3 orders', -1500]] },
  ];
  INVOICES.forEach((iv) => { iv.amount = iv.lines.reduce((a, l) => a + l[2], 0); });
  function planInfo(b) {
    if (b.status !== 'live') return { now: 0, nowLabel: 'Not billed', basis: 'Billing starts when this location goes live. Its first month is free.', next: null };
    if (b.freeMonth) return { now: 0, nowLabel: 'Free · first month', basis: 'New locations get their first month free.', next: planFor(b.novSoFar || 0), nextBasis: `${money(b.novSoFar || 0)} so far in November` };
    return { now: planFor(b.octNet), nowLabel: money(planFor(b.octNet)), basis: `October net food sales ${money(b.octNet)}`, next: planFor(b.novSoFar), nextBasis: `${money(b.novSoFar)} so far in November` };
  }
  V.subscription = V.plan = () => {
    const net = Math.round((parseFloat(String(S.planInput).replace(/[,$]/g, '')) || 0) * 100);
    const fee = planFor(net); const idx = net <= 0 ? 0 : TIERS.findIndex((t) => net <= t[0]);
    const infos = S.branches.map((b) => [b, planInfo(b)]); const total = infos.reduce((a, [, p]) => a + p.now, 0); const nextTotal = infos.reduce((a, [, p]) => a + (p.next || 0), 0);
    const credOrders = PAST.filter((o) => o.credit && o.status === 'completed'); const monthCredit = credOrders.reduce((a, o) => a + o.credit, 0);
    return `${head('Subscription', 'Each location has its own plan, based on its own sales · $0 commission')}${body(`
      ${S.sub.unpaid ? `<div class="note n-r row wrap" role="alert"><span class="grow"><b>Your locations are paused: the November plan ($150.00) is unpaid.</b> After the last automatic retry, your locations were deactivated: they don’t receive orders and are hidden from customers. Pay now and they go live again automatically. Our team has been notified and may contact you.</span><button class="btn sm" data-a="subPayNow">Pay $150.00 now</button><button class="btn ln sm" data-a="info" data-k="billingcard">Update card</button></div>` : ''}
      ${S.sub.cancel ? `<div class="note n-r row wrap"><span class="grow"><b>Subscription ends November 30, 2026.</b> After that your locations stop taking orders.</span><button class="btn sm" data-a="resumeSub" style="background:var(--g)">Keep my subscription</button></div>` : ''}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(${PHONE ? 160 : 230}px,1fr));gap:12px">
        <div class="card pad col" style="background:var(--g);color:#fff;border:0;gap:4px"><span style="color:#C9D3CD;font-size:13px">This month · November · all locations</span><b style="font-size:28px">${money(total)}</b><span style="font-size:13px">Paid Nov 1 on Visa •••• 4242</span></div>
        <div class="card pad col" style="gap:4px"><span class="mut sm-t">Next bill · Dec 1 at 12:00 PM ET</span><b style="font-size:24px;color:var(--ink)">≈ ${money(nextTotal)}</b><span class="sm-t">If November ended today, from each location’s sales so far</span></div>
        <div class="card pad col" style="gap:4px"><span class="mut sm-t">Locations billed</span><b style="font-size:24px;color:var(--ink)">${infos.filter(([b]) => b.status === 'live').length} of ${S.branches.length}</b><span class="sm-t">Locations that aren’t live yet aren’t billed</span></div>
      </div>
      <div class="card pad col" style="gap:0"><b style="font-size:18px;margin-bottom:8px">Plan by location</b><div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;min-width:620px;font-size:14px"><thead><tr style="text-align:left"><th style="padding:8px 6px">Location</th><th>This month</th><th>Based on</th><th>Next month (estimate)</th><th>Paid from</th></tr></thead><tbody>
        ${infos.map(([b, p]) => `<tr style="border-top:1px solid var(--line)"><td style="padding:10px 6px"><b>${esc(b.name)}</b><span class="mut sm-t" style="display:block">${b.status === 'live' ? 'Live' : 'Setting up'}</span></td><td><b>${p.nowLabel}</b></td><td class="sm-t">${esc(p.basis)}</td><td>${p.next == null ? '—' : `<b>${money(p.next)}</b><span class="mut sm-t" style="display:block">${esc(p.nextBasis)}</span>`}</td><td class="sm-t">Your billing card</td></tr>`).join('')}
        <tr style="border-top:2px solid var(--line)"><td style="padding:10px 6px"><b>Total</b></td><td><b>${money(total)}</b></td><td></td><td><b>≈ ${money(nextTotal)}</b></td><td></td></tr></tbody></table></div></div>
      <div class="card pad col" style="gap:0"><div class="row between wrap"><b style="font-size:18px">Send Koro promo credit this month</b><b style="font-size:20px;color:var(--ink)">${money(monthCredit)}</b></div><span class="mut sm-t" style="margin:4px 0 6px">Customers paid part of these orders with Send Koro referral or promo credit. Send Koro pays it back on your December 1 invoice. If it’s more than your plan fee, the rest is sent to your Stripe account.</span>${credOrders.map((o) => `<div class="row between" style="border-top:1px solid var(--line);padding:8px 0"><span><b>${o.id}</b> · ${esc(o.customer)}<span class="mut sm-t" style="display:block">${fmtDay(o.placed)}</span></span><b>${money(o.credit)}</b></div>`).join('') || '<span class="mut sm-t">None yet this month.</span>'}</div>
      <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start">
      <div class="card pad col" style="flex:2 1 360px;gap:0"><b style="font-size:18px;margin-bottom:6px">Invoices</b>
        <div class="row" style="border-top:1px solid var(--line);padding:10px 0"><span class="grow"><b>December 2026</b><span class="mut sm-t" style="display:block">Billed Dec 1 · one line per location${monthCredit ? ` · less ${money(monthCredit)} promo credit paid back` : ''}</span></span><span class="pill p-n">Upcoming</span><b style="width:80px;text-align:right">≈ ${money(Math.max(0, nextTotal - monthCredit))}</b></div>
        ${INVOICES.slice().reverse().map((iv) => `<div class="row" style="border-top:1px solid var(--line);padding:10px 0"><span class="grow"><b>${iv.month}</b><span class="mut sm-t" style="display:block">${iv.date} · ${iv.lines.length} location${iv.lines.length > 1 ? 's' : ''}</span></span><span class="pill p-g">${iv.status}</span><b style="width:80px;text-align:right">${money(iv.amount)}</b><button class="btn gh" data-a="invoice" data-id="${iv.id}" style="min-height:32px">View</button></div>`).join('')}</div>
      <div class="card pad col" style="flex:1 1 280px"><b style="font-size:18px">Billing</b><div class="row"><span class="pill" style="background:#1A1F71;color:#fff">VISA</span><span class="grow">${esc(S.sub.card)}</span></div><button class="btn ln sm" data-a="info" data-k="billingcard" style="align-self:flex-start">Update card</button><label class="f">Billing email<input class="in" id="bill-email" data-m="business.email" value="${esc(S.business.email)}"></label><button class="btn sm" data-a="saveBillingEmail" style="align-self:flex-start">Save email</button><span class="mut sm-t">One card pays the plans for all your locations. If a payment fails, it’s retried automatically and we email you each time.</span><div class="note n-w sm-t"><b>If a plan stays unpaid</b> after the last retry (about 2 weeks), your locations are deactivated automatically and stop taking orders. We tell you by email, text and here, and our team reviews the account. Paying the invoice turns them back on right away.</div><button class="btn gh sm" data-a="subUnpaidDemo" style="align-self:flex-start">${S.sub.unpaid ? 'End preview' : 'Preview an unpaid plan'}</button></div></div>
      <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start">
      <div class="card pad col" style="flex:1 1 320px"><b style="font-size:18px">Fee calculator (one location)</b><label class="f">That location’s net food sales for a month (USD)<input class="in" id="p-in" data-m="planInput" data-live="1" inputmode="decimal" value="${esc(S.planInput)}"></label><div class="note n-g" style="font-size:16px">Its plan next month: <b>${money(fee)}</b>${net <= 0 ? ' (live locations with no sales pay the lowest plan)' : ''}</div><div class="row wrap">${['0', '2400', '6240', '9800', '14000', '22000'].map((v) => `<button class="chip" data-a="planSet" data-v="${v}">$${Number(v).toLocaleString()}</button>`).join('')}</div></div>
      <div class="card pad col" style="flex:1 1 320px;gap:0"><b style="font-size:18px;margin-bottom:8px">Tiers (per location)</b>${TIERS.map((t, i) => `<div class="row" style="padding:9px 8px;border-radius:8px;${i === idx ? 'background:var(--ot);font-weight:800' : 'border-top:1px solid var(--line)'}"><span class="grow">${tierLabel(i)}</span><b>${money(t[1]).replace('.00', '')}/mo</b></div>`).join('')}</div></div>
      <div class="card pad col"><b style="font-size:18px">How plans work</b><ul style="margin:0;padding-left:18px;line-height:1.7"><li><b>Each location has its own plan.</b> Its fee comes from <b>that location’s</b> net food sales last calendar month: food after discounts, minus food refunds (New York time).</li><li>Tips, tax, delivery fees and service charges are <b>not</b> counted.</li><li>A new location’s <b>first month is free</b>. Locations that aren’t live aren’t billed.</li><li>A live location with zero sales pays the lowest plan ($50).</li><li>All locations are billed together on the <b>1st at 12:00 PM ET</b>, one line each. No proration.</li><li>Refunds made late count in the month they’re processed.</li></ul></div>
      ${S.sub.cancel ? '' : '<div class="card pad col"><b>Cancel subscription</b><span class="mut sm-t">All locations keep taking orders until the end of this billing month. To stop billing for just one location, delete it under Locations.</span><button class="btn ln sm" data-a="cancelSubAsk" style="align-self:flex-start;color:var(--red);border-color:var(--red)">Cancel subscription</button></div>'}`)}`;
  };

  // ---------- locations ----------
  const CUISINE_LIST = ['American', 'Bakery', 'Bangladeshi', 'BBQ', 'Bowls', 'Breakfast', 'Burgers', 'Caribbean', 'Chicken', 'Chinese', 'Coffee & tea', 'Desserts', 'Dominican', 'Dumplings', 'Ethiopian', 'Greek', 'Halal', 'Healthy', 'Indian', 'Italian', 'Jamaican', 'Japanese', 'Juice & smoothies', 'Korean', 'Kosher', 'Latin American', 'Mediterranean', 'Mexican', 'Middle Eastern', 'Nepali', 'Nigerian', 'Noodles', 'Pakistani', 'Peruvian', 'Pizza', 'Ramen', 'Salads', 'Sandwiches', 'Seafood', 'Soul food', 'Sushi', 'Thai', 'Turkish', 'Vegan', 'Vegetarian', 'Vietnamese', 'West African', 'Wings'];
  function cuisinePicker(target) {
    const arr = target === 'draft' ? S.bdraft.cuisines : target === 'signup' ? S.signup.cuisines : B().cuisines;
    const q = S.cuisineQ.trim().toLowerCase();
    const list = CUISINE_LIST.filter((c) => !q || c.toLowerCase().includes(q));
    return `<div class="col" style="gap:8px"><div class="row between"><b>Cuisines</b><span class="mut sm-t">${arr.length} of 3 chosen${arr.length ? ' · main: ' + esc(arr[0]) : ''}</span></div>
      <input class="in" id="cz-q-${target}" data-m="cuisineQ" data-live="1" placeholder="Search ${CUISINE_LIST.length} cuisines, e.g. Thai" value="${esc(S.cuisineQ)}" aria-label="Search cuisines">
      <div class="row wrap" style="gap:6px">${list.map((c) => { const i = arr.indexOf(c); return `<button class="chip ${i >= 0 ? 'on' : ''}" data-a="pickCuisine" data-t="${target}" data-c="${esc(c)}" aria-pressed="${i >= 0}">${i === 0 ? '★ ' : ''}${esc(c)}</button>`; }).join('') || '<span class="mut sm-t">No match. Try another word.</span>'}</div>
      <span class="mut sm-t">Pick up to 3. The first one is your main cuisine; customers find you under all of them.</span></div>`;
  }
  const suggestTax = (addr) => (detectJuris(addr) === 'nyc' ? '8.875' : '');
  function setupStatus(b) {
    const req = defsFor(b).filter((d) => d.req && d.scope === 'branch'); const J = jFor(b);
    const steps = [
      ['details', 'Location details', 'Address, phone and cuisines', !!(b.address && b.phone && b.cuisines.length), 'branchEdit'],
      ['menu', 'Menu', 'At least 5 dishes with prices', S.menu.reduce((a, s) => a + s.items.length, 0) >= 5, 'menu'],
      ['hours', 'Opening hours', 'When this location takes orders', b.hoursSet, 'hours'],
      ['market', 'Send Koro open here', J.label + ' · ' + J_STATUS[J.status][1], J.status === 'open', 'legal'],
      ['licenses', 'Minimum licenses for ' + J.label, req.map((d) => d.short).join(', '), req.every((d) => licOK(d, licRec(d, b.id))), 'legal'],
      ['tax', 'Sales tax', 'Accept responsibility and set the rate', S.taxAccepted && !!b.taxRate, 'tax'],
      ['delivery', 'Delivery fee rule', 'Who pays the delivery fee', b.deliverySet, 'delivery'],
      ['payouts', 'Payouts', b.payout === 'own' ? (b.ownConnected ? 'Own Stripe account connected' : 'Connect this location’s own Stripe account') : 'Paid into your main Stripe account', !!acctOf(b), 'payouts'],
    ];
    return steps;
  }
  const accountSteps = () => [
    ['business', 'Business details', 'Legal name, DBA, entity type, EIN, owner', !!(S.business.legal && S.business.owner && S.business.ein), 'legal'],
    ['stripe', 'Connect Stripe', 'Where your food money is paid', S.stripe, 'payouts'],
    ['billing', 'Subscription card', 'Card for your monthly plan', true, 'subscription'],
    ['agreement', 'Partner agreement and confirmations', 'Signed agreement plus your confirmations', Object.values(S.agree).every(Boolean), 'legal'],
  ];
  V.locations = () => `${head('Locations', 'Every branch of your restaurant · one subscription covers all', '<button class="btn sm" data-a="newBranch">+ Add location</button>')}${body(`
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(${PHONE ? 280 : 340}px,1fr));gap:12px">${S.branches.map((b) => { const st = setupStatus(b); const n = st.filter((s) => s[3]).length; return `<div class="card pad col" style="${b.id === S.branchId ? 'border:2px solid var(--g)' : ''}">
      <div class="row between"><b style="font-size:19px">${esc(b.name)}</b>${b.status === 'live' ? '<span class="pill" style="background:#1E5442;color:#fff">Live</span>' : `<span class="pill p-o">Setup · ${n} of ${st.length}</span>`}</div>
      <span class="mut sm-t">${esc(b.address)} · ${esc(b.phone)}</span><span class="sm-t">${b.cuisines.map(esc).join(' · ') || 'No cuisines yet'}</span>
      ${b.status === 'live' ? `<label class="row sm-t">${sw(`data-a="branchAccept" data-id="${b.id}"`, b.accepting, b.name + ' accepting orders')}${b.accepting ? 'Accepting orders' : 'Paused'}</label>` : `<div style="height:8px;border-radius:99px;background:var(--line)"><div style="height:100%;width:${(n / st.length) * 100}%;background:#1E5442;border-radius:99px"></div></div>`}
      <div class="row wrap">${b.id === S.branchId ? '<span class="pill p-g">You are managing this one</span>' : `<button class="btn dk sm" data-a="switchBranch" data-id="${b.id}" style="font-size:14px">Manage this location</button>`}<button class="btn ln sm" data-a="editBranch" data-id="${b.id}">Edit</button>${b.status === 'live' ? '' : `<button class="btn sm" data-a="setupBranch" data-id="${b.id}">Finish setup</button>`}</div></div>`; }).join('')}</div>
    <div class="note n-g">Each location has its own address, hours, prep time, sales tax rate and licenses. Send Koro sets the delivery area for every location. Your menu, team and subscription are shared.</div>`)}`;

  V.branchEdit = () => {
    const d = S.bdraft; const sug = suggestTax(d.address);
    return `${head(d.isNew ? 'Add a location' : 'Edit ' + d.name, d.isNew ? 'A new branch of ' + S.profile.name : 'Location details')}${body(narrow(`<div class="card pad col">
      <label class="f">Location name (shown to customers after your restaurant name)<input class="in" id="bd-name" data-m="bdraft.name" value="${esc(d.name)}" placeholder="e.g. Williamsburg"></label>
      <label class="f">Street address<input class="in" id="bd-addr" data-m="bdraft.address" data-live="1" value="${esc(d.address)}" placeholder="150 Bedford Ave, Brooklyn, NY 11249"></label>
      <label class="f">Location phone<input class="in" id="bd-phone" data-m="bdraft.phone" inputmode="tel" value="${esc(d.phone)}"></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label class="f">Prep time (min)<input class="in" id="bd-prep" data-m="bdraft.prep" inputmode="numeric" value="${esc(d.prep)}"></label><label class="f">Sales tax rate (%)<input class="in" id="bd-tax" data-m="bdraft.taxRate" data-live="1" inputmode="decimal" value="${esc(d.taxRate)}" placeholder="${sug || 'e.g. 8.875'}"></label></div>
      ${sug && d.taxRate !== sug ? `<div class="note n-g sm-t row wrap"><span class="grow">Suggested from the address: <b>${sug}%</b> (New York City). You set and pay your own tax.</span><button class="btn sm" data-a="useTax" data-v="${sug}" style="background:var(--g)">Use ${sug}%</button></div>` : ''}
      ${(() => { const j = JURIS[detectJuris(d.address)]; return d.address.length > 8 ? `<div class="note ${j.status === 'blocked' ? 'n-r' : j.status === 'open' ? 'n-g' : 'n-w'} sm-t"><b>Rules for this address: ${esc(j.label)}</b> · ${J_STATUS[j.status][1]}. Minimum licenses: ${j.reqs.map((r) => r.short).join(', ')}.</div>` : ''; })()}
      </div><div class="card pad">${cuisinePicker('draft')}</div>
      <div class="card pad col"><b>Payouts for this location</b>${[['same', 'Your main Stripe account', 'Shared with your other locations that use it'], ['own', 'Its own Stripe account', 'Food money and payouts for this location stay separate']].map(([k, l, x]) => `<label class="opt ${d.payout === k ? 'on' : ''}"><input type="radio" name="bpay" data-a="branchPayout" data-v="${k}" ${d.payout === k ? 'checked' : ''}><span class="grow"><b>${l}</b><span class="mut sm-t" style="display:block">${x}</span></span></label>`).join('')}</div>
      <div class="row wrap"><button class="btn grow" data-a="saveBranch">${d.isNew ? 'Add location' : 'Save location'}</button>${d.isNew || S.branches.length < 2 ? '' : '<button class="btn ln" data-a="delBranchAsk" style="color:var(--red);border-color:var(--red)">Delete location</button>'}</div>`))}`;
  };

  // ---------- licenses & legal: minimum required by state and city ----------
  const LINK_FSE = 'https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit';
  const LINK_NYCOPEN = 'https://www.nyc.gov/site/doh/business/food-operators/opening-a-restaurant.page';
  const LINK_FLMGR = 'https://www2.myfloridalicense.com/hotels-restaurants/food-lodging/food-manager/';
  const rq = {
    health: (name, issuer, why, link) => ({ key: 'health', short: 'Food permit', name, issuer, why, req: true, scope: 'branch', expires: true, link }),
    manager: (name, why, opts = {}) => ({ key: 'manager', short: 'Food manager certificate', name, issuer: opts.issuer || 'ANSI-accredited exam provider', why, req: true, scope: 'branch', expires: opts.expires !== false, holder: true, link: opts.link }),
    handler: (name, why) => ({ key: 'handler', short: 'Food handler cards', name, issuer: 'Each food employee', why, req: true, scope: 'branch', attest: true }),
    tax: (name, issuer) => ({ key: 'tax', short: 'Sales tax permit', name, issuer, why: 'Lets you collect sales tax on meals. You file and pay it yourself.', req: true, scope: 'branch', expires: false, numLabel: 'Sales tax ID (US version of a VAT number)' }),
    local: (name, issuer, why) => ({ key: 'local', short: 'Local business license', name, issuer, why, req: true, scope: 'branch', expires: true }),
  };
  const JURIS = {
    nyc: { label: 'New York City, NY', status: 'open', table: ['NYS Certificate of Authority', 'NYC Health Department', 'Yes · on site', 'No'], reqs: [
      rq.health('NYC Food Service Establishment Permit', 'NYC Department of Health and Mental Hygiene', 'Needed to serve food to the public in New York City. One per location.', LINK_FSE),
      rq.manager('Food Protection Certificate', 'A supervisor holding this certificate must be on site whenever food is prepared.', { issuer: 'NYC Department of Health and Mental Hygiene', expires: false, link: LINK_NYCOPEN }),
      rq.tax('NYS Certificate of Authority', 'NYS Department of Taxation and Finance')],
      extras: [{ key: 'grade', short: 'Letter grade', name: 'Health inspection letter grade', issuer: 'NYC Department of Health and Mental Hygiene', why: 'Optional. If added, customers see your grade on your page.', req: false, scope: 'branch', grade: true }] },
    ny: { label: 'New York State (outside NYC)', status: 'later', table: ['NYS Certificate of Authority', 'County health department', 'Some counties', 'No'], note: 'A certified food manager isn’t required statewide, but some counties require one. Check with your county health department.', reqs: [
      rq.health('Food Service Establishment Permit', 'Your county health department or NYS Department of Health district office', 'Needed to serve food to the public. One per location.'),
      rq.tax('NYS Certificate of Authority', 'NYS Department of Taxation and Finance')] },
    nj: { label: 'New Jersey', status: 'review', table: ['NJ Certificate of Authority', 'Local health department', 'Yes', 'No'], reqs: [
      rq.health('Retail Food Establishment License', 'Your municipal or county health department', 'Needed to serve food to the public. One per location.'),
      rq.manager('Certified Food Protection Manager (CFPM)', 'New Jersey’s food code (N.J.A.C. 8:24) requires a certified food protection manager. Ask your local health department about on-site rules.'),
      rq.tax('New Jersey Certificate of Authority (sales tax)', 'NJ Division of Taxation')] },
    ca: { label: 'California', status: 'later', table: ['CDTFA Seller’s Permit', 'County environmental health', 'Yes', 'Yes · within 30 days'], reqs: [
      rq.health('Health Permit (food facility)', 'Your county environmental health department', 'Needed to operate a food facility. One per location.'),
      rq.manager('Food Safety Manager Certificate', 'California requires at least one owner or employee with a food safety manager certificate.'),
      rq.handler('California Food Handler Cards', 'Food employees must get a California Food Handler Card within 30 days of hire.'),
      rq.tax('Seller’s Permit', 'California Department of Tax and Fee Administration (CDTFA)'),
      rq.local('City business license or business tax certificate', 'Your city or county', 'Most California cities require one to operate.')] },
    tx: { label: 'Texas', status: 'review', table: ['Sales and Use Tax Permit', 'City or county health department', 'Yes', 'Yes · within 60 days'], reqs: [
      rq.health('Food Establishment Permit', 'Your city or county health department (Texas DSHS where there is none)', 'Needed to serve food to the public. One per location.'),
      rq.manager('Certified Food Manager', 'Texas requires a certified food manager.'),
      rq.handler('Texas Food Handler Cards', 'Food employees must complete an accredited food handler course within 60 days of hire.'),
      rq.tax('Texas Sales and Use Tax Permit', 'Texas Comptroller of Public Accounts')] },
    fl: { label: 'Florida', status: 'review', table: ['DOR Certificate of Registration', 'State (DBPR)', 'Yes · within 30 days', 'Yes'], reqs: [
      rq.health('Public Food Service Establishment License', 'Florida DBPR, Division of Hotels and Restaurants', 'Florida licenses restaurants at the state level. One per location.'),
      rq.manager('Certified Food Protection Manager', 'Florida law requires food managers to pass a certification exam within 30 days of employment.', { link: LINK_FLMGR }),
      rq.handler('Florida food employee training', 'Food employees must complete state-approved food safety training.'),
      rq.tax('Sales and Use Tax Certificate of Registration', 'Florida Department of Revenue'),
      rq.local('Local Business Tax Receipt', 'Your county and city', 'Required to do business in Florida counties and cities.')] },
    il: { label: 'Illinois', status: 'review', table: ['IDOR Certificate of Registration', 'Local health department', 'Yes', 'Yes · within 30 days'], reqs: [
      rq.health('Food service license or permit', 'Your local health department (Chicago: Retail Food Establishment license, City of Chicago)', 'Needed to serve food to the public. One per location.'),
      rq.manager('Food Service Sanitation Manager Certificate', 'Illinois requires a certified food protection manager.'),
      rq.handler('Illinois food handler training', 'Food employees must complete accredited food handler training within 30 days of hire.'),
      rq.tax('Certificate of Registration (sales tax)', 'Illinois Department of Revenue')] },
    pa: { label: 'Pennsylvania', status: 'review', table: ['PA Sales Tax License', 'PA Agriculture or local health', 'Yes', 'No'], reqs: [
      rq.health('Retail Food Facility License', 'PA Department of Agriculture or your local health department (e.g. Philadelphia, Allegheny County)', 'Needed to serve food to the public. One per location.'),
      rq.manager('Certified food employee (food manager certificate)', 'Pennsylvania requires at least one certified supervisory employee.'),
      rq.tax('Sales Tax License', 'Pennsylvania Department of Revenue')] },
    ma: { label: 'Massachusetts', status: 'review', table: ['DOR sales and meals tax', 'Local Board of Health', 'Yes + allergen', 'No'], reqs: [
      rq.health('Food Establishment Permit', 'Your local Board of Health', 'Needed to serve food to the public. One per location.'),
      rq.manager('Certified Food Protection Manager', 'Massachusetts requires a certified food protection manager.'),
      { key: 'allergen', short: 'Allergen awareness', name: 'Allergen awareness certificate', issuer: 'State-approved training provider', why: 'Massachusetts also requires allergen awareness training for the certified food protection manager.', req: true, scope: 'branch', expires: true, holder: true },
      rq.tax('Sales and meals tax registration', 'Massachusetts Department of Revenue')] },
    wa: { label: 'Washington', status: 'review', table: ['WA Business License', 'Local health jurisdiction', 'Yes · one per business', 'Yes · before working'], reqs: [
      rq.health('Food establishment permit', 'Your local health jurisdiction', 'Needed to serve food to the public. One per location.'),
      rq.manager('Certified Food Protection Manager', 'Washington requires at least one certified food protection manager per business.'),
      rq.handler('Washington Food Worker Cards', 'Every food worker needs a state Food Worker Card before handling or serving food.'),
      rq.tax('Washington Business License (includes sales tax registration)', 'WA Department of Revenue, Business Licensing Service')] },
    ga: { label: 'Georgia', status: 'blocked', table: ['GA DOR registration', 'County board of health', '—', '—'], note: 'Send Koro can’t open in Georgia: its marketplace law would make the platform collect sales tax on meals, and Send Koro never collects sales tax.', reqs: [
      rq.health('Food Service Permit', 'Your county board of health', 'Needed to serve food to the public.'),
      rq.tax('Sales and use tax registration', 'Georgia Department of Revenue')] },
    other: { label: 'Another state', status: 'review', table: ['State sales tax permit', 'State or local health', 'Varies', 'Varies'], note: 'Every state needs at least a food permit and a sales tax permit. Food manager and food handler rules vary; check your state health department.', reqs: [
      rq.health('Food establishment permit', 'Your state or local health department', 'Needed to serve food to the public.'),
      rq.tax('State sales tax permit', 'Your state revenue department')] },
  };
  const J_STATUS = { open: ['p-g', 'Open · Send Koro is live here'], later: ['p-n', 'Opening after NYC · tax rules checked'], review: ['p-o', 'Not open yet · needs legal review'], blocked: ['p-r', 'Not available in this state'] };
  const NYC_ZIP = /^1(0[0-4]|1[0-6])\d{2}$/;
  function detectJuris(addr) {
    const m = String(addr).match(/,\s*([A-Za-z]{2})\.?\s+(\d{5})/);
    if (!m) return 'other';
    const st = m[1].toLowerCase();
    if (st === 'ny') return NYC_ZIP.test(m[2]) ? 'nyc' : 'ny';
    return JURIS[st] ? st : 'other';
  }
  const OPTIONAL_ALL = [{ key: 'liquor', short: 'Liquor license', name: 'Liquor license', issuer: 'Your state liquor authority', why: 'Only if you sell alcohol. Alcohol ordering is not available on Send Koro at launch.', req: false, scope: 'branch', expires: true }];
  const jFor = (b) => JURIS[b.juris] || JURIS.other;
  const minimize = (d) => (!d.req || d.key === 'health' ? d : d.key === 'tax' ? { ...d, noFile: true } : { ...d, attest: true });
  const defsFor = (b) => jFor(b).reqs.map(minimize);
  const TODAY = new Date('2026-11-05T12:00:00');
  function licRec(def, bid) { if (def.scope === 'account') return S.licAccount[def.key] || (S.licAccount[def.key] = { status: 'missing' }); const L = S.lic[bid] || (S.lic[bid] = {}); return L[def.key] || (L[def.key] = { status: 'missing' }); }
  function licPill(def, r) {
    if (def.attest) return r.status === 'verified' ? '<span class="pill p-g">Confirmed ✓</span>' : '<span class="pill p-r">Not confirmed · required</span>';
    if (r.status === 'verified' && def.expires && r.expires) { const days = Math.round((new Date(r.expires + 'T12:00:00') - TODAY) / DAYMS); if (days < 0) return '<span class="pill p-r">Expired</span>'; if (days <= 60) return `<span class="pill p-o">Expires in ${days} days</span>`; }
    return { verified: '<span class="pill p-g">Verified ✓</span>', review: '<span class="pill p-o">In review</span>', missing: def.req ? '<span class="pill p-r">Missing · required</span>' : '<span class="pill p-n">Not added</span>' }[r.status];
  }
  const licOK = (def, r) => r.status === 'verified' && !(def.expires && r.expires && new Date(r.expires + 'T12:00:00') < TODAY);
  V.legal = () => {
    const b = S.branches.find((x) => x.id === (S.licBranch || S.branchId)) || B();
    const bz = S.business; const J = jFor(b); const defs = defsFor(b);
    const reqDefs = defs.filter((d) => d.req); const optDefs = defs.filter((d) => !d.req);
    const doneN = reqDefs.filter((d) => licOK(d, licRec(d, b.id))).length;
    const licCard = (def) => { const r = licRec(def, b.id); const path = def.scope === 'account' ? `licAccount.${def.key}` : `lic.${b.id}.${def.key}`; const id = def.key + b.id; const open = S.licOpen === id;
      if (def.attest) return `<div class="card pad col" style="gap:8px"><div class="row between" style="align-items:flex-start"><div class="grow"><b>${def.name}</b><div class="mut sm-t">${def.key === 'handler' ? 'Each food employee' : esc(def.issuer)} · ${esc(b.name)} · you confirm, no upload</div></div>${licPill(def, r)}</div><span class="sm-t">${def.why}</span><label class="row sm-t" style="align-items:flex-start"><input type="checkbox" data-a="licAttest" data-path="${path}" ${r.status === 'verified' ? 'checked' : ''} style="width:20px;height:20px;margin-top:1px"><span>${def.key === 'handler' ? `I confirm every food employee at ${esc(b.name)} has a valid card or training certificate, and I’ll keep copies on site.` : `I confirm ${esc(b.name)} has a valid ${esc(def.name)} and will keep it current. We may ask to see it.`}</span></label></div>`;
      return `<div class="card pad col" style="gap:8px"><div class="row between" style="align-items:flex-start"><div class="grow"><b>${def.name}</b><div class="mut sm-t">${def.issuer}${def.scope === 'account' ? ' · whole business' : ' · ' + esc(b.name)}</div></div>${licPill(def, r)}</div>
        <span class="sm-t">${def.why}${def.link ? ` <a href="${def.link}" target="_blank" rel="noopener">How to get it ↗</a>` : ''}</span>
        ${r.status !== 'missing' && !open ? `<div class="sm-t row wrap" style="gap:14px">${r.number ? `<span><span class="mut">${def.grade ? 'Grade' : def.numLabel || 'Number'}:</span> <b>${esc(r.number)}</b></span>` : ''}${r.holder ? `<span><span class="mut">Holder:</span> ${esc(r.holder)}</span>` : ''}${r.expires ? `<span><span class="mut">Expires:</span> ${esc(r.expires)}</span>` : ''}${r.file ? `<span><span class="mut">File:</span> ${esc(r.file)}</span>` : ''}</div>` : ''}
        ${open ? `<div class="col" style="gap:8px;background:var(--bg);padding:12px;border-radius:12px">${def.grade ? `<label class="f">Grade<select class="in" id="lg-${def.key}" data-m="${path}.number">${['', 'A', 'B', 'C', 'Grade pending'].map((g) => `<option ${r.number === g ? 'selected' : ''}>${g}</option>`).join('')}</select></label>` : `<label class="f">${def.numLabel || 'Permit or certificate number'}<input class="in" id="ln-${def.key}" data-m="${path}.number" value="${esc(r.number || '')}"></label>`}
          ${def.holder ? `<label class="f">Certificate holder<input class="in" id="lh-${def.key}" data-m="${path}.holder" value="${esc(r.holder || '')}"></label>` : ''}
          ${def.expires ? `<label class="f">Expiry date<input class="in" type="date" id="le-${def.key}" data-m="${path}.expires" value="${esc(r.expires || '')}"></label>` : ''}
          ${def.grade || def.noFile ? '' : `<div class="row wrap"><label class="btn ln sm" style="cursor:pointer">Upload document<input type="file" accept="image/*,application/pdf" data-licfile="${path}" style="position:absolute;width:1px;height:1px;opacity:0"></label><span class="sm-t mut">${r.file ? esc(r.file) : 'PDF or photo'}</span></div>`}
          <div class="row wrap"><button class="btn sm" data-a="licSubmit" data-path="${path}" data-k="${def.key}">Submit for review</button><button class="btn gh" data-a="licToggle" data-k="${id}">Cancel</button></div></div>` : `<div class="row wrap"><button class="btn ${r.status === 'missing' ? '' : 'ln'} sm" data-a="licToggle" data-k="${id}">${r.status === 'missing' ? 'Add' : 'Update'}</button>${r.status === 'review' ? `<button class="btn gh" data-a="licVerify" data-path="${path}" style="min-height:36px">Mark verified (demo)</button>` : ''}</div>`}</div>`; };
    return `${head('Licenses and legal', 'Only the minimum we need to list you')}${body(narrow(`
      <div class="card pad col" style="background:var(--gt);border-color:#C9D3CD"><b style="font-size:17px">What Send Koro asks for</b><ol style="margin:0;padding-left:20px;line-height:1.7"><li><b>Business details:</b> legal name, DBA, entity type, <b>federal EIN</b>, owner.</li><li><b>Food permit for each location:</b> number, expiry date and a photo or PDF. This is the one document we check.</li><li><b>Sales tax ID for each location</b> (the US version of a VAT number): just the number. You file and pay the tax.</li><li><b>Your confirmations:</b> the other licenses your state requires, food safety, and the partner agreement.</li></ol><span class="mut sm-t">Stripe checks the owner’s ID and your bank details for payouts.</span></div>
      <div class="card pad col"><div class="row between"><b style="font-size:17px">Business details (all locations)</b><span class="pill ${bz.legal && bz.owner && bz.ein ? 'p-g' : 'p-r'}">${bz.legal && bz.owner && bz.ein ? 'Complete' : 'Missing'}</span></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px"><label class="f">Legal business name<input class="in" id="bz-legal" data-m="business.legal" value="${esc(bz.legal)}"></label><label class="f">Doing business as (DBA)<input class="in" id="bz-dba" data-m="business.dba" value="${esc(bz.dba)}"></label>
        <label class="f">Entity type<select class="in" id="bz-entity" data-m="business.entity">${['LLC', 'Corporation', 'Sole proprietor', 'Partnership'].map((e) => `<option ${bz.entity === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label><label class="f">Federal EIN (Employer Identification Number)<input class="in" id="bz-ein" data-m="business.ein" value="${esc(bz.ein)}" placeholder="12-3456789" inputmode="numeric"></label><label class="f">Owner or authorized person<input class="in" id="bz-owner" data-m="business.owner" value="${esc(bz.owner)}"></label></div>
        <button class="btn sm" data-a="saveBusiness" style="align-self:flex-start">Save business details</button><span class="mut sm-t">The US has no VAT. The closest thing is your <b>sales tax ID</b>, which we ask for on each location below. The owner’s identity and your bank account are checked by Stripe when you connect payouts.</span></div>
      <div class="row between wrap"><b style="font-size:18px">Location licenses</b><div class="chips">${S.branches.map((x) => `<button class="chip ${x.id === b.id ? 'on' : ''}" data-a="licBranch" data-id="${x.id}">${esc(x.name)}</button>`).join('')}</div></div>
      <div class="card pad col" style="border:2px solid var(--g)"><div class="row between wrap"><span><span class="mut sm-t">Rules for ${esc(b.name)}</span><b style="display:block;font-size:20px;color:var(--ink)">${esc(J.label)}</b></span><span class="pill ${J_STATUS[J.status][0]}">${J_STATUS[J.status][1]}</span></div>
        <span class="sm-t">${esc(b.address)} · <b>${doneN} of ${reqDefs.length}</b> required items done</span>${J.note ? `<div class="note ${J.status === 'blocked' ? 'n-r' : 'n-w'} sm-t">${J.note}</div>` : ''}</div>
      <b class="mut sm-t" style="letter-spacing:.08em;text-transform:uppercase">Minimum required · ${reqDefs.length}</b>
      ${reqDefs.map(licCard).join('')}
      <div class="card pad col"><b style="font-size:17px">Sales tax responsibility</b><label class="row" style="align-items:flex-start"><input type="checkbox" data-m="taxAccepted" data-rr="1" ${S.taxAccepted ? 'checked' : ''} style="width:20px;height:20px;margin-top:2px"><span><b>I’m responsible for charging, reporting and paying sales tax.</b><span class="mut sm-t" style="display:block">Send Koro never collects, files or pays sales tax. Required in every state before taking orders.</span></span></label></div>
      <div class="card pad col"><b style="font-size:17px">Minimum requirements by state</b><span class="mut sm-t">What a restaurant needs in each place before taking orders. Every state also needs your business registration and EIN.</span>
        <div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;min-width:720px;font-size:13px"><thead><tr style="text-align:left"><th style="padding:8px 6px">Where</th><th>Sales tax permit</th><th>Food permit from</th><th>Food manager cert.</th><th>Food handler cards</th><th>Send Koro</th></tr></thead><tbody>
        ${Object.entries(JURIS).filter(([k]) => k !== 'other').map(([k, j]) => `<tr style="border-top:1px solid var(--line);${k === b.juris ? 'background:var(--ot);font-weight:700' : ''}"><td style="padding:8px 6px">${esc(j.label)}</td>${j.table.map((c) => `<td style="padding:8px 6px">${esc(c)}</td>`).join('')}<td style="padding:8px 6px"><span class="pill ${J_STATUS[j.status][0]}">${{ open: 'Open', later: 'Later', review: 'Review', blocked: 'Blocked' }[j.status]}</span></td></tr>`).join('')}</tbody></table></div>
        <span class="mut sm-t">Rules for a location come from its address. Change the address on the location to see that state’s list.</span></div>
      <div class="card pad col"><b style="font-size:17px">Partner agreement</b><span class="mut sm-t">Required once for your whole business. This written agreement is what lets Send Koro list you; New York City requires one before a delivery app lists a restaurant.</span>
        ${[['signed', 'I accept the Send Koro partner agreement and marketplace terms on behalf of ' + esc(bz.legal) + '.'], ['licenses', 'We hold, and will keep current, every license and permit our locations need, including food manager certificates and food handler cards where required.'], ['food', 'We follow food safety rules and show allergen and ingredient information accurately on our menu.'], ['bathroom', 'Delivery workers picking up our orders may use our restroom (New York City rule).']].map(([k, t]) => `<label class="row" style="align-items:flex-start;border-top:1px solid var(--line);padding:10px 0"><input type="checkbox" data-a="agree" data-k="${k}" ${S.agree[k] ? 'checked' : ''} style="width:20px;height:20px;margin-top:1px"><span>${t}</span></label>`).join('')}
        <div class="row wrap">${[['agreement', 'Read the agreement'], ['privacy', 'Privacy and data use'], ['usage', 'Community guidelines'], ['refunds', 'Refund policy']].map(([k, l]) => `<button class="btn gh" data-a="info" data-k="${k}" style="min-height:32px;padding:0 6px">${l}</button>`).join('')}</div><span class="mut sm-t">Accepted Oct 1, 2026 by ${esc(bz.owner)}.</span></div>
      <p class="mut sm-t" style="margin:0">This is the usual minimum and a general guide, not legal advice. Cities and counties can add their own rules (for example a sidewalk café or signage permit). Check with the agencies or a lawyer before opening.</p>`))}`;
  };
  V.setup = () => {
    const b = B(); const st = setupStatus(b); const ac = accountSteps();
    const n = st.filter((s) => s[3]).length + ac.filter((s) => s[3]).length; const total = st.length + ac.length;
    const row = ([k, l, d, ok, to]) => `<div class="card pad row"><span style="width:28px;height:28px;border-radius:99px;flex:none;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;${ok ? 'background:#1E5442' : 'border:2px solid var(--line2)'}">${ok ? '✓' : ''}</span><span class="grow"><b>${l}</b><span class="mut sm-t" style="display:block">${d}</span></span>${k === 'stripe' && !ok ? '<button class="btn sm" data-a="connectStripe">Connect</button>' : `<button class="btn ${ok ? 'gh' : 'sm'}" data-a="setupGo" data-to="${to}" style="${ok ? 'min-height:32px' : ''}">${ok ? 'View' : 'Finish'}</button>`}</div>`;
    const ready = n === total;
    return `${head('Store setup', `${S.profile.name} · ${S.branches.length} locations`, '<button class="btn ln sm" data-a="newBranch">+ Add location</button>')}${body(narrow(`
      <div class="row wrap"><b>Location:</b><div class="chips">${S.branches.map((x) => `<button class="chip ${x.id === b.id ? 'on' : ''}" data-a="switchBranch" data-id="${x.id}">${esc(x.name)} ${x.status === 'live' ? '· Live' : ''}</button>`).join('')}</div></div>
      <div class="card pad col" style="gap:6px"><div class="row between"><b style="font-size:18px">${esc(b.name)}</b>${b.status === 'live' ? '<span class="pill" style="background:#1E5442;color:#fff">Live</span>' : `<span class="pill p-o">${n} of ${total} done</span>`}</div><div style="height:10px;border-radius:99px;background:var(--line)"><div style="height:100%;width:${(n / total) * 100}%;background:#1E5442;border-radius:99px;transition:width .2s"></div></div></div>
      <b class="mut sm-t" style="letter-spacing:.08em;text-transform:uppercase">Your business (all locations)</b>${ac.map(row).join('')}
      <b class="mut sm-t" style="letter-spacing:.08em;text-transform:uppercase">This location · ${esc(b.name)}</b>${st.map(row).join('')}
      ${b.status === 'live' ? '<div class="note n-g"><b>This location is live.</b> Customers can find it and order.</div>' : `<button class="btn" data-a="goLive" ${ready ? '' : 'disabled'}>${ready ? `Go live with ${esc(b.name)}` : `Go live (${total - n} step${total - n > 1 ? 's' : ''} left)`}</button>`}`))}`;
  };

  V.hours = () => { const b = B(); const bi = bIdx(); return `${head('Hours', esc(b.name) + ' · when customers can order')}${body(narrow(`
    ${S.branches.length > 1 ? `<div class="chips">${S.branches.map((x) => `<button class="chip ${x.id === b.id ? 'on' : ''}" data-a="switchBranch" data-id="${x.id}">${esc(x.name)}</button>`).join('')}</div>` : ''}
    <div class="card pad col" style="gap:0"><div class="row between" style="padding-bottom:8px"><b style="font-size:17px">Weekly hours</b><button class="btn gh" data-a="copyMonday" style="min-height:0">Copy Monday to all days</button></div>
    ${b.week.map((d, i) => `<div class="row wrap" style="border-top:1px solid var(--line);padding:10px 0"><b style="width:100px">${d[0]}</b>${sw(`data-a="dayToggle" data-i="${i}"`, d[1], d[0] + ' open')}${d[1] ? `<input class="in" type="time" id="wk-${i}-a" data-m="branches.${bi}.week.${i}.2" value="${d[2]}" style="width:130px" aria-label="${d[0]} opens"><span>to</span><input class="in" type="time" id="wk-${i}-b" data-m="branches.${bi}.week.${i}.3" value="${d[3]}" style="width:130px" aria-label="${d[0]} closes">` : '<span class="mut">Closed</span>'}</div>`).join('')}
    <button class="btn" data-a="saveHours" style="margin-top:10px">Save hours</button></div>
    <div class="card pad col"><b style="font-size:17px">Holiday and special closures</b>${b.closures.map((c, i) => `<div class="row" style="border-top:1px solid var(--line);padding:8px 0"><b style="width:120px">${esc(c[0])}</b><span class="grow">${esc(c[1])}</span><button class="btn gh" data-a="delClosure" data-i="${i}" style="color:var(--red);min-height:32px">Remove</button></div>`).join('') || '<span class="mut">No closures planned.</span>'}
      <div class="row wrap"><input class="in" type="date" id="cl-date" data-m="closeDraft.date" value="${esc(S.closeDraft.date)}" style="width:170px" aria-label="Closure date"><input class="in grow" id="cl-note" data-m="closeDraft.note" value="${esc(S.closeDraft.note)}" placeholder="Reason, e.g. staff party" style="min-width:160px" aria-label="Reason"><button class="btn sm" data-a="addClosure">Add</button></div></div>`))}`; };

  V.tax = () => { const b = B(); const bi = bIdx(); const sug = suggestTax(b.address); return `${head('Sales tax', esc(b.name) + ' · you set it, collect it and pay it')}${body(narrow(`
    <div class="note n-w"><b>Send Koro never collects, files or pays sales tax.</b> The tax on each order goes to you with your food money, and you send it to New York State.</div>
    ${S.branches.length > 1 ? `<div class="chips">${S.branches.map((x) => `<button class="chip ${x.id === b.id ? 'on' : ''}" data-a="switchBranch" data-id="${x.id}">${esc(x.name)}</button>`).join('')}</div>` : ''}
    <div class="card pad col"><label class="f">Sales tax rate for ${esc(b.name)} (%)<input class="in" id="tx-rate" data-m="branches.${bi}.taxRate" data-live="1" inputmode="decimal" value="${esc(b.taxRate)}" placeholder="${sug}" style="max-width:200px"></label>${sug ? `<span class="mut sm-t">Suggested from the address: <b>${sug}%</b> (New York City combined rate).${b.taxRate !== sug ? ` <button class="btn gh" data-a="useTaxBranch" data-v="${sug}" style="min-height:0;padding:0 4px;font-size:13px">Use it</button>` : ''}</span>` : ''}<span class="mut sm-t">Example: a $30.00 order has ${money(tax(3000))} tax at this rate.</span>
      <label class="row" style="align-items:flex-start;margin-top:6px"><input type="checkbox" data-m="taxAccepted" data-rr="1" ${S.taxAccepted ? 'checked' : ''} style="width:20px;height:20px;margin-top:2px"><span><b>I’m responsible for charging, reporting and paying sales tax.</b><span class="mut sm-t" style="display:block">Required before taking orders.</span></span></label>
      <button class="btn sm" data-a="saveTax" style="align-self:flex-start">Save</button></div>
    <div class="card pad col"><b style="font-size:17px">Tax collected by month</b><div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;min-width:380px;font-size:14px"><thead><tr><th style="text-align:left;padding:8px 6px">Month</th><th style="text-align:right">Taxable food sales</th><th style="text-align:right;padding-right:6px">Tax collected</th></tr></thead><tbody>${TAXMONTHS.map((m) => `<tr style="border-top:1px solid var(--line)"><td style="padding:8px 6px">${m[0]}</td><td style="text-align:right">${money(m[1])}</td><td style="text-align:right;padding-right:6px"><b>${money(m[2])}</b></td></tr>`).join('')}</tbody></table></div><button class="btn ln sm" data-a="copyTax" style="align-self:flex-start">Copy as CSV</button></div>`))}`; };

  V.profile = () => {
    const p = S.profile; const b = B(); const bi = bIdx();
    return `${head('Store profile', 'What customers see')}${body(`<div style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start"><div class="col" style="flex:999 1 380px">
      <div class="card pad col"><b style="font-size:17px">Restaurant (all locations)</b>
        <label class="f">Restaurant name<input class="in" id="pf-name" data-m="profile.name" data-live="1" value="${esc(p.name)}"></label>
        <label class="f">About<textarea class="in" id="pf-about" data-m="profile.about" data-live="1">${esc(p.about)}</textarea></label>
        <label class="row">${sw('data-m="profile.halal" data-rr="1"', p.halal, 'Halal')}Halal certified</label><label class="row">${sw('data-m="profile.veg" data-rr="1"', p.veg, 'Vegetarian friendly')}Vegetarian friendly</label><label class="row">${sw('data-m="profile.pickup"', p.pickup, 'Offer pickup')}Offer pickup</label>
        <label class="btn ln sm" style="align-self:flex-start;cursor:pointer">Upload cover photo<input type="file" accept="image/*" data-photo="cover" style="position:absolute;width:1px;height:1px;opacity:0"></label></div>
      <div class="card pad col"><div class="row between wrap"><b style="font-size:17px">This location</b><div class="chips">${S.branches.map((x) => `<button class="chip ${x.id === b.id ? 'on' : ''}" data-a="switchBranch" data-id="${x.id}">${esc(x.name)}</button>`).join('')}</div></div>
        <label class="f">Address<input class="in" id="pf-addr" data-m="branches.${bi}.address" data-live="1" value="${esc(b.address)}"></label><label class="f">Phone<input class="in" id="pf-phone" data-m="branches.${bi}.phone" inputmode="tel" value="${esc(b.phone)}"></label>
        ${cuisinePicker('branch')}</div>
      <div class="card pad col"><b style="font-size:17px">Extra charges (optional, your own)</b><label class="f">Packaging fee ($)<input class="in" id="st-pack" data-m="store.packaging" inputmode="decimal" value="${esc(S.store.packaging)}"></label><label class="row">${sw('data-m="store.serviceCharge"', S.store.serviceCharge, 'Service charge')}Add my own service charge</label><span class="mut sm-t">Send Koro never adds a service or card fee for customers. Any charge you add is shown on your menu and in the cart under your name. In New York a service charge is taxable.</span></div>
      <button class="btn" data-a="saveProfile">Save profile</button></div>
      <div class="col" style="flex:1 1 280px"><b>Customer preview</b><div class="card" style="overflow:hidden"><img src="${IMG(p.cover)}" alt="" style="width:100%;height:150px;object-fit:cover"><div class="col" style="padding:12px 14px;gap:4px"><b style="font-size:18px">${esc(p.name)} · ${esc(b.name)}</b><span class="mut sm-t">${b.cuisines.map(esc).join(' · ') || 'Pick a cuisine'}${p.halal && !b.cuisines.includes('Halal') ? ' · Halal' : ''}${p.veg ? ' · Vegetarian friendly' : ''}</span><span class="mut sm-t">${esc(b.address.split(',')[0])}</span><span class="sm-t">${esc(p.about)}</span><span class="sm-t" style="color:var(--gx);font-weight:700">${S.rule.type === 'customer' ? '$7.99 delivery' : S.rule.type === 'restaurant' ? 'Free delivery' : S.rule.type === 'freeOver' ? 'Free delivery over $' + esc(S.rule.over) : esc(p.name) + ' pays part of delivery'}</span></div></div></div></div>`)}`;
  };
  // ---------- open / close ----------
  const todayIdx = () => (new Date().getDay() + 6) % 7;
  const fmtHM = (hm) => { const [h, m] = hm.split(':').map(Number); const d = new Date(); d.setHours(h, m, 0, 0); return fmtTime(d); };
  function openCard() {
    const b = B(); const w = b.week[todayIdx()];
    const hours = w[1] ? `${fmtHM(w[2])} – ${fmtHM(w[3])}` : 'closed today';
    if (b.status !== 'live') return `<div class="card pad row wrap" style="gap:14px;background:var(--warn);border-color:#F3D9B5"><div class="grow"><span class="sm-t" style="font-weight:800;letter-spacing:.08em">${esc(b.name).toUpperCase()}</span><b style="display:block;font-size:24px">Not live yet</b><span class="sm-t">Customers can’t see this location until store setup is done.</span></div><button class="btn" data-a="setupBranch" data-id="${b.id}" style="min-height:56px">Finish setup</button></div>`;
    const open = b.accepting;
    const sub = open ? (S.busy ? 'Busy mode: customers see 15 extra minutes' : 'Customers can order now') : b.closedUntil === 'today' ? 'Closed for the rest of today · opens tomorrow' : b.closedUntil ? `Reopens automatically at ${fmtTime(new Date(b.closedUntil))}` : 'Closed until you open again';
    return `<div class="card col" style="padding:18px 20px;border:0;gap:14px;background:${open ? '#1E5442' : '#12352B'};color:#fff">
      <div class="row between wrap" style="gap:14px"><div style="min-width:0"><span style="font-size:12px;font-weight:800;letter-spacing:.1em;opacity:.85">${esc(b.name).toUpperCase()} · TODAY ${esc(hours).toUpperCase()}</span>
        <b style="display:flex;align-items:center;gap:10px;font-size:32px;line-height:1.1"><span style="width:14px;height:14px;border-radius:99px;background:${open ? '#4CC38A' : '#FF8A7A'};box-shadow:0 0 0 4px ${open ? 'rgba(124,240,180,.25)' : 'rgba(255,138,122,.25)'}"></span>${open ? 'Open' : 'Closed'}</b><span style="font-size:14px;opacity:.9">${sub}</span></div>
        <button class="btn" data-a="${open ? 'closeAsk' : 'openNow'}" style="min-height:64px;min-width:180px;font-size:20px;background:var(--card);color:${open ? '#E5645A' : '#4CC38A'}">${open ? 'Close store' : 'Open store'}</button></div>
      ${open ? `<div class="row wrap" style="gap:8px"><button class="btn sm" data-a="toggleBusy" style="background:${S.busy ? '#fff' : 'rgba(255,255,255,.16)'};color:${S.busy ? '#1E5442' : '#fff'}">${S.busy ? 'Busy +15 min ✓ (tap to end)' : 'Busy? Add 15 min'}</button><span style="font-size:13px;opacity:.85">${S.orders.length} live order${S.orders.length === 1 ? '' : 's'}</span></div>` : ''}</div>`;
  }

  // ---------- create account ----------
  V.signup = () => {
    const u = S.signup; const steps = ['You', 'Verify', 'Store', 'Agree'];
    const bar = `<div style="display:grid;grid-template-columns:repeat(${steps.length},minmax(0,1fr));gap:6px;align-items:start">${steps.map((t, i) => `<div class="col" style="gap:6px;min-width:0"><div style="height:6px;border-radius:99px;background:${i < u.step ? '#0B3B6E' : 'var(--line)'}"></div><span style="font-weight:700;font-size:${PHONE ? 12.5 : 13.5}px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:${i + 1 === u.step ? 'var(--ink)' : 'var(--mut)'}">${i + 1}. ${t}</span></div>`).join('')}</div>`;
    let inner = '';
    if (u.step === 1) inner = `<h1 style="font-size:26px;color:var(--ink)">List your restaurant on Send Koro</h1><p class="mut" style="margin:0">$0 commission, a flat monthly plan, and your first month free. Takes about 5 minutes.</p>
      <label class="f">Your full name<input class="in" id="su-owner" data-m="signup.owner" value="${esc(u.owner)}" placeholder="e.g. Shakib Haider"></label>
      <label class="f">Mobile number (you’ll sign in with a text code)<input class="in" id="su-phone" data-m="signup.phone" inputmode="tel" value="${esc(u.phone)}" placeholder="(718) 555-0100"></label>
      <label class="f">Email (for invoices and payouts)<input class="in" id="su-email" data-m="signup.email" inputmode="email" value="${esc(u.email)}" placeholder="you@restaurant.com"></label>
      <button class="btn" data-a="suNext">Continue</button>`;
    if (u.step === 2) inner = `<h1 style="font-size:26px;color:var(--ink)">Enter your code</h1><p class="mut" style="margin:0">We texted a 6-digit code to ${esc(u.phone)}. <b>Prototype: any 6 digits work.</b></p>
      <label class="f">6-digit code<input class="in" id="su-code" data-m="signup.code" inputmode="numeric" maxlength="6" value="${esc(u.code)}" style="font-size:22px;letter-spacing:.4em;text-align:center;font-weight:800"></label>
      <button class="btn" data-a="suNext">Verify</button><div class="row between"><button class="btn gh" data-a="suBack">Change number</button><button class="btn gh" data-a="toastMsg" data-msg="New code sent.">Resend code</button></div>`;
    if (u.step === 3) inner = `<h1 style="font-size:26px;color:var(--ink)">About your restaurant</h1>
      <label class="f">Restaurant name<input class="in" id="su-name" data-m="signup.name" value="${esc(u.name)}" placeholder="e.g. Brooklyn Bowl Co."></label>
      <label class="f">Address of your first location<input class="in" id="su-addr" data-m="signup.address" data-live="1" value="${esc(u.address)}" placeholder="412 7th Ave, Brooklyn, NY 11215"></label>
      ${u.address.length > 8 ? (() => { const j = JURIS[detectJuris(u.address)]; return `<div class="note ${j.status === 'open' ? 'n-g' : j.status === 'blocked' ? 'n-r' : 'n-w'} sm-t"><b>${esc(j.label)}</b> · ${J_STATUS[j.status][1]}${j.status === 'open' ? '' : '. You can still create an account; we’ll tell you when we open here.'}</div>`; })() : ''}
      <label class="f">How many locations do you have?<select class="in" id="su-locs" data-m="signup.locs">${['1', '2–3', '4–10', 'More than 10'].map((x) => `<option ${u.locs === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      ${cuisinePicker('signup')}
      <button class="btn" data-a="suNext">Continue</button><button class="btn gh" data-a="suBack">Back</button>`;
    if (u.step === 4) inner = `<h1 style="font-size:26px;color:var(--ink)">Almost done</h1>
      <div class="card pad col" style="gap:4px;background:var(--bg)"><b>${esc(u.name)}</b><span class="mut sm-t">${esc(u.address)}</span><span class="sm-t">${u.cuisines.map(esc).join(' · ')} · ${esc(u.locs)} location${u.locs === '1' ? '' : 's'}</span><span class="sm-t">${esc(u.owner)} · ${esc(u.phone)} · ${esc(u.email)}</span></div>
      <div class="card pad col" style="gap:4px"><b>Your plan</b><span class="sm-t">First month free. Then each location pays $50 to $500 a month based on its own net food sales last month. $0 commission.</span></div>
      <label class="row" style="align-items:flex-start"><input type="checkbox" data-m="signup.agree" data-rr="1" ${u.agree ? 'checked' : ''} style="width:20px;height:20px;margin-top:2px"><span class="consent" style="text-align:left;max-width:none;align-self:auto">I accept the Send Koro <span class="nw"><button class="lg-link" data-a="legalOpen" data-id="restaurantTerms">Restaurant Partner Agreement</button>,</span> <span class="nw"><button class="lg-link" data-a="legalOpen" data-id="usage">Community Guidelines</button>,</span> <button class="lg-link" data-a="legalOpen" data-id="privacy">Privacy Policy</button> and <span class="nw"><button class="lg-link" data-a="legalOpen" data-id="sms">Text Message Terms</button>,</span> including text codes and order alerts.</span></label>
      <label class="row" style="align-items:flex-start"><input type="checkbox" data-m="signup.tax" data-rr="1" ${u.tax ? 'checked' : ''} style="width:20px;height:20px;margin-top:2px"><span>I’m responsible for charging, reporting and paying sales tax.</span></label>
      <button class="btn" data-a="suCreate">Create account</button><button class="btn gh" data-a="suBack">Back</button>
      <span class="mut sm-t">Next you’ll finish store setup: menu, hours, food permit, sales tax ID, Stripe payouts. You can save and come back any time.</span>`;
    return `<div class="col" style="min-height:${PHONE ? '100%' : '100vh'};align-items:center;padding:24px 16px;background:${PHONE ? 'var(--bg)' : 'var(--g)'}"><div class="card pad col" style="width:100%;max-width:560px;gap:14px;padding:24px">
      <span class="logo" style="font-size:22px;color:var(--ink)">${LOGO('', 49)}${WORD} <span class="pill p-g">for restaurants</span></span>${bar}${inner}
      <span class="mut sm-t" style="text-align:center">Already on Send Koro? <button class="btn gh" data-a="toSignin" style="min-height:0;padding:0;font-size:13px">Sign in</button></span></div></div>`;
  };
  V.noAccess = () => `${head('No access')}${body(narrow(`<div class="card pad col" style="align-items:flex-start"><b style="font-size:20px">Your role (${ROLE[S.role]}) can’t open this page</b><span class="mut">Ask the owner if you need it. In this demo, switch back with “View as”.</span><button class="btn sm" data-a="role" data-v="owner">View as Owner</button></div>`))}`;

  // ---------- modals ----------
  const INFO = {
    agreement: ['Partner agreement', '<p>$0 commission. A flat monthly plan from $50 based on last month’s net food sales; first month free. You set prices, tax and hours; food money goes straight to your Stripe account.</p><p class="mut">Prototype summary. The full agreement is signed during onboarding.</p>'],
    privacy: ['Privacy', '<p>Customer phone numbers and addresses are shown only as needed to fulfil an order. Card details are stored by Stripe, never by Send Koro or your restaurant.</p>'],
    terms: ['Terms', '<p>You sell the food and set its price and tax. Send Koro runs the marketplace and arranges delivery.</p><p class="mut">Prototype text.</p>'],
    status: ['System status', '<p><b style="color:#4CC38A">● All systems normal.</b> Orders, payments and delivery are running.</p>'],
    billingcard: ['Update billing card', '<p>Your subscription card is stored by Stripe. In the real app this button opens Stripe’s secure billing page.</p>'],
    stripe: ['Update bank on Stripe', '<p>Bank details live in your Stripe account, not in Send Koro. In the real app this button opens Stripe’s secure page.</p>'],
  };
  function modal() {
    const md = S.modal; if (!md) return '';
    const wrap = (inner) => `<div class="overlay"><div class="sheet" role="dialog" aria-modal="true">${inner}</div></div>`;
    if (M2MODAL[md.type]) return wrap(M2MODAL[md.type](md));
    if (md.type === 'decline') return wrap(`<h2 style="font-size:22px">Decline ${md.id}?</h2><p class="mut" style="margin:0">The customer's hold is released and they pay nothing.</p>${['Too busy right now', 'Item sold out', 'Closing soon', 'Other'].map((r) => `<label class="opt ${md.reason === r ? 'on' : ''}"><input type="radio" name="dr" data-a="declineReason" data-v="${r}" ${md.reason === r ? 'checked' : ''}>${r}</label>`).join('')}<button class="btn" data-a="declineDo" style="background:var(--red)">Decline order</button><button class="btn gh" data-a="closeModal">Keep order</button>`);
    if (md.type === 'invite') return wrap(`<h2 style="font-size:22px">Invite a team member</h2><label class="f">Name<input class="in" id="iv-name" data-m="modal.name" value="${esc(md.name)}"></label><label class="f">Mobile number<input class="in" id="iv-phone" data-m="modal.phone" inputmode="tel" value="${esc(md.phone)}" placeholder="(718) 555-0100"></label><div class="row">${['manager', 'staff'].map((r) => `<button class="chip ${md.role === r ? 'on' : ''}" data-a="inviteRole" data-v="${r}">${ROLE[r]}</button>`).join('')}</div><button class="btn" data-a="inviteDo">Send invite by text</button><button class="btn gh" data-a="closeModal">Cancel</button>`);
    if (md.type === 'soldOut') { const it = md.id ? itemById(md.id) : S.menu[S.menuTab].items[md.i]; return wrap(`<h2 style="font-size:22px">Mark ${esc(it.name)} sold out?</h2>${[['today', 'For today', 'Back on automatically when you open tomorrow'], ['off', 'Until I turn it back on', 'For dishes you’ve stopped making for a while']].map(([k, l, x]) => `<label class="opt ${md.v === k ? 'on' : ''}"><input type="radio" name="so" data-a="soldOutPick" data-v="${k}" ${md.v === k ? 'checked' : ''}><span class="grow"><b>${l}</b><span class="mut sm-t" style="display:block">${x}</span></span></label>`).join('')}<span class="mut sm-t">All locations. To mark it sold out at one location only, pick that location on the Menu page.</span><button class="btn" data-a="soldOutDo">Mark sold out</button><button class="btn gh" data-a="closeModal">Cancel</button>`); }
    if (md.type === 'section') return wrap(`<h2 style="font-size:22px">New category</h2><label class="f">Category name<input class="in" id="sec-name" data-m="modal.name" value="${esc(md.name)}" placeholder="e.g. Desserts"></label><button class="btn" data-a="sectionDo">Add category</button><button class="btn gh" data-a="closeModal">Cancel</button>`);
    if (md.type === 'info') { const [t, h] = INFO[md.k]; return wrap(`<div class="row between"><h2 style="font-size:22px">${t}</h2><button class="btn gh" data-a="closeModal" aria-label="Close">✕</button></div><div class="col info">${h}</div><button class="btn" data-a="closeModal">Done</button>`); }
    if (md.type === 'invoice') { const iv = INVOICES.find((x) => x.id === md.id); return wrap(`<div class="row between"><h2 style="font-size:22px">Invoice · ${iv.month}</h2><button class="btn gh" data-a="closeModal" aria-label="Close">✕</button></div><div class="mut">${esc(S.business.legal || S.profile.name)}</div><div class="card pad col" style="gap:2px">${iv.lines.map((l) => `<div class="rw"><span><b>${esc(l[0])}</b><span class="mut sm-t" style="display:block">${esc(l[1])}</span></span><span>${money(l[2])}</span></div>`).join('')}<div class="rw"><span class="mut">Commission</span><span>$0.00</span></div><div class="rw tot"><span>Total</span><span>${money(iv.amount)}</span></div></div><div class="sm-t">${iv.status} · ${iv.date}</div><button class="btn" data-a="closeModal">Done</button>`); }
    if (md.type === 'cancelSub') return wrap(`<h2 style="font-size:22px">Cancel your subscription?</h2><p style="margin:0">All ${S.branches.length} locations stop taking orders after <b>November 30, 2026</b>. You won’t be billed on December 1. There’s no partial refund for November.</p><button class="btn" data-a="cancelSubDo" style="background:var(--red)">Cancel at end of month</button><button class="btn gh" data-a="closeModal">Keep my subscription</button>`);
    if (md.type === 'delBranch') return wrap(`<h2 style="font-size:22px">Delete ${esc(S.bdraft.name)}?</h2><p class="mut" style="margin:0">Its hours, licenses and settings are removed. Past orders and payouts stay in your history. Your subscription doesn’t change.</p><button class="btn" data-a="delBranchDo" style="background:var(--red)">Delete location</button><button class="btn gh" data-a="closeModal">Keep it</button>`);
    if (md.type === 'close') return wrap(`<h2 style="font-size:22px">Close ${esc(B().name)}?</h2><p class="mut" style="margin:0">Customers can’t place new orders while you’re closed. ${S.orders.length ? `You still need to finish the ${S.orders.length} live order${S.orders.length === 1 ? '' : 's'}.` : ''}</p>${[['30', 'Pause for 30 minutes', 'Reopens on its own'], ['60', 'Pause for 1 hour', 'Reopens on its own'], ['today', 'Close for the rest of today', 'Opens again tomorrow at your normal time'], ['manual', 'Close until I open again', 'Stays closed until you tap Open store']].map(([k, l, x]) => `<label class="opt ${S.modal.v === k ? 'on' : ''}"><input type="radio" name="cl" data-a="closePick" data-v="${k}" ${S.modal.v === k ? 'checked' : ''}><span class="grow"><b>${l}</b><span class="mut sm-t" style="display:block">${x}</span></span></label>`).join('')}<button class="btn" data-a="closeDo" style="background:var(--red)">Close store</button><button class="btn gh" data-a="closeModal">Stay open</button>`);
    if (md.type === 'copy') return wrap(`<h2 style="font-size:22px">Copy this text</h2><p class="mut" style="margin:0">Select all and copy it into a spreadsheet.</p><textarea class="in" readonly style="min-height:160px;font-family:monospace;font-size:12px">${esc(md.text)}</textarea><button class="btn" data-a="closeModal">Done</button>`);
    return '';
  }

  // ---------- frame ----------
  const NAV = [['Run', [['overview', 'Overview'], ['orders', 'Live orders'], ['history', 'Order history'], ['reviews', 'Ratings and reviews'], ['menu', 'Menu'], ['promos', 'Promotions']]], ['Money', [['earnings', 'Earnings'], ['payouts', 'Payouts'], ['stripe', 'Stripe'], ['subscription', 'Subscription']]], ['Store', [['setup', 'Store setup'], ['locations', 'Locations'], ['profile', 'Store profile'], ['hours', 'Hours'], ['team', 'Team'], ['delivery', 'Delivery fee'], ['tax', 'Sales tax'], ['legal', 'Licenses and legal'], ['settings', 'All settings']]], ['Learn', [['learn', 'Learning center'], ['legalList', 'Legal documents']]]];
  const PARENT = { lesson: 'learn', legalDoc: 'legal', legalList: 'legal', branchEdit: 'locations', editItem: 'menu', cats: 'menu', mods: 'menu', editGroup: 'menu', menus: 'menu', editPromo: 'promos', orderMoney: 'earnings', orderDetail: 'orders', newOrder: 'orders', notifications: 'settings', help: 'settings' };
  function sidebar() {
    const cur = PARENT[S.screen] || S.screen;
    const nNew = S.orders.filter((o) => o.status === 'new').length;
    return `<aside style="background:var(--g);color:#fff;padding:18px 12px;display:flex;flex-direction:column;gap:2px;width:236px;flex:none;position:sticky;top:0;height:100vh;overflow-y:auto">
      <span class="logo" style="font-size:20px;padding:4px 8px 10px">${LOGO('', 40)}${WORD}</span>
      <span style="font-size:12px;color:#C9D3CD;padding:0 8px 8px">${esc(S.profile.name)}<br>${ROLE[S.role]} · ${S.role === 'owner' ? 'Shakib' : S.role === 'manager' ? 'Maya' : 'Jordan'}</span>
      <label style="padding:0 8px 6px;display:flex;flex-direction:column;gap:4px;font-size:11px;font-weight:800;letter-spacing:.08em;color:#9FB2A6">LOCATION<select data-branch="1" style="height:36px;border-radius:8px;border:0;padding:0 8px;font-weight:700;color:var(--ink)">${S.branches.map((b) => `<option value="${b.id}" ${b.id === S.branchId ? 'selected' : ''}>${esc(b.name)}${b.status === 'live' ? '' : ' (setup)'}</option>`).join('')}</select></label>
      ${NAV.map(([g, items]) => { const vis = items.filter(([k]) => can(k)); return vis.length ? `<span style="font-size:11px;font-weight:800;letter-spacing:.1em;color:#9FB2A6;padding:10px 12px 4px">${g.toUpperCase()}</span>` + vis.map(([k, l]) => `<button data-a="tabTo" data-to="${k}" aria-current="${cur === k ? 'page' : 'false'}" style="display:flex;align-items:center;gap:8px;height:40px;padding:0 12px;border:0;border-radius:10px;text-align:left;font-weight:700;background:${cur === k ? 'rgba(255,255,255,.14)' : 'transparent'};color:${cur === k ? '#fff' : '#C9D3CD'};${cur === k ? 'box-shadow:inset 3px 0 0 #FF7A2E' : ''}"><span class="grow">${l}</span>${k === 'orders' && nNew ? `<span class="pill" style="background:#FF7A2E;color:var(--ink)">${nNew}</span>` : ''}</button>`).join('') : ''; }).join('')}
      <span class="grow" style="min-height:12px"></span>
      <div class="sbx" style="padding:10px;border-radius:12px;background:rgba(255,255,255,.08);font-size:13px;display:flex;flex-direction:column;gap:6px"><b>${B().status !== 'live' ? '○ Not live yet' : B().accepting ? '● Open' : '○ Closed'}</b>${B().status === 'live' ? `<button data-a="${B().accepting ? 'closeAsk' : 'openNow'}" style="height:32px;border:0;border-radius:8px;font-weight:800;background:var(--card);color:${B().accepting ? '#B42318' : '#1E5442'}">${B().accepting ? 'Close store' : 'Open store'}</button>` : ''}<span style="color:#C9D3CD">${S.busy ? 'Busy: +15 min' : 'Normal prep times'}</span>
        <label style="display:flex;flex-direction:column;gap:4px;color:#C9D3CD">View as (demo)<select data-viewas="1" style="height:34px;border-radius:8px;border:0;padding:0 6px;color:var(--ink)">${Object.keys(ROLE).map((r) => `<option value="${r}" ${S.role === r ? 'selected' : ''}>${ROLE[r]}</option>`).join('')}</select></label>
        <button data-a="signOut" style="border:0;background:none;color:#FFB689;text-align:left;padding:0;font-weight:700">Sign out</button></div></aside>`;
  }
  function webFooter() {
    const L = (k, l) => `<button class="flink" data-a="info" data-k="${k}" style="color:var(--gx)">${l}</button>`;
    return `<footer style="margin-top:auto;border-top:1px solid var(--line);padding-block:20px 28px;display:flex;flex-direction:column;gap:14px;font-size:14px">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:18px">
        <div class="col" style="gap:6px"><span class="logo" style="color:var(--ink)">${LOGO('', 34)}${WORD} for restaurants</span><span class="mut sm-t">$0 commission. Flat monthly plan. Your food money goes straight to your Stripe account.</span></div>
        <div class="col" style="gap:6px"><b>Run your store</b>${[['orders', 'Live orders'], ['menu', 'Menu'], ['hours', 'Hours']].filter(([k]) => can(k)).map(([k, l]) => `<button class="flink" data-a="tabTo" data-to="${k}" style="color:var(--gx)">${l}</button>`).join('')}</div>
        <div class="col" style="gap:6px"><b>Support</b><button class="flink" data-a="tabTo" data-to="help" style="color:var(--gx)">Help center</button><span class="sm-t">Restaurant line <b style="user-select:all">(718) 555-0150</b></span>${L('status', 'System status')}</div>
        <div class="col" style="gap:6px"><b>Legal</b>${L('agreement', 'Partner agreement')}${L('privacy', 'Privacy')}${L('refunds', 'Refund policy')}${L('usage', 'Community guidelines')}${L('sms', 'Text messages')}</div>
      </div><span class="mut sm-t">© 2026 Send Koro · New York, NY · Payments by Stripe</span></footer>`;
  }
  function miniFooter() { return `<div class="col" style="gap:6px;padding:14px 4px;border-top:1px solid var(--line);font-size:13px"><span class="mut">Send Koro for restaurants · $0 commission</span><div class="row wrap" style="gap:14px">${[['agreement', 'Partner agreement'], ['privacy', 'Privacy'], ['refunds', 'Refunds'], ['usage', 'Guidelines'], ['status', 'System status']].map(([k, l]) => `<button class="flink" data-a="info" data-k="${k}" style="color:var(--gx);font-size:13px">${l}</button>`).join('')}</div><span class="mut">© 2026 Send Koro · New York, NY</span></div>`; }
  function tabBar() {
    const T = [['home', 'Home'], ['orders', 'Orders'], ['menu', 'Menu'], ['more', 'More']].filter(([k]) => can(k));
    const map = { editItem: 'menu', cats: 'menu', mods: 'menu', editGroup: 'menu', menus: 'menu', promos: 'menu', editPromo: 'menu', newOrder: 'orders', orderDetail: 'orders', history: 'orders' };
    const cur = T.some((t) => t[0] === S.screen) ? S.screen : map[S.screen] || 'more';
    const nNew = S.orders.filter((o) => o.status === 'new').length;
    return `<nav aria-label="Main" style="flex:none;height:72px;padding:6px 6px 12px;background:var(--g);display:grid;grid-template-columns:repeat(${T.length},1fr)">${T.map(([k, l]) => `<button data-a="tab" data-to="${k}" aria-current="${cur === k ? 'page' : 'false'}" style="position:relative;border:0;background:transparent;font-size:13px;font-weight:800;color:${cur === k ? '#FCE910' : '#C9D3CD'}">${l}${k === 'orders' && nNew ? `<span style="position:absolute;top:6px;right:22%;min-width:18px;height:18px;border-radius:99px;background:#FF7A2E;color:var(--ink);font-size:11px;display:flex;align-items:center;justify-content:center">${nNew}</span>` : ''}</button>`).join('')}</nav>`;
  }
  const PAGES = PHONE
    ? [['signin', 'Sign in'], ['signup', 'Create account'], ['learn', 'Learning center'], ['lesson', 'Lesson video'], ['legalList', 'Legal documents'], ['legalDoc', 'Partner agreement'], ['setup', 'Store setup'], ['home', 'Home'], ['newOrder', 'New order'], ['orders', 'Live orders'], ['orderDetail', 'Order details'], ['history', 'Order history'], ['reviews', 'Ratings and reviews'], ['menu', 'Menu'], ['editItem', 'Edit item'], ['cats', 'Categories'], ['mods', 'Option groups'], ['editGroup', 'Edit option group'], ['menus', 'Menus and hours'], ['promos', 'Promotions'], ['editPromo', 'Create promotion'], ['earnings', 'Earnings'], ['orderMoney', 'Order money'], ['payouts', 'Payouts'], ['stripe', 'Stripe'], ['subscription', 'Subscription'], ['locations', 'Locations'], ['branchEdit', 'Edit location'], ['profile', 'Store profile'], ['hours', 'Hours'], ['team', 'Team'], ['delivery', 'Delivery fee'], ['tax', 'Sales tax'], ['legal', 'Licenses and legal'], ['notifications', 'Notifications'], ['more', 'More'], ['help', 'Help']]
    : [['signin', 'Sign in'], ['signup', 'Create account'], ['learn', 'Learning center'], ['lesson', 'Lesson video'], ['legalList', 'Legal documents'], ['legalDoc', 'Partner agreement'], ['overview', 'Overview'], ['orders', 'Live orders'], ['newOrder', 'New order'], ['orderDetail', 'Order details'], ['history', 'Order history'], ['reviews', 'Ratings and reviews'], ['menu', 'Menu'], ['editItem', 'Edit item'], ['cats', 'Categories'], ['mods', 'Option groups'], ['editGroup', 'Edit option group'], ['menus', 'Menus and hours'], ['promos', 'Promotions'], ['editPromo', 'Create promotion'], ['earnings', 'Earnings'], ['orderMoney', 'Order money'], ['payouts', 'Payouts'], ['stripe', 'Stripe'], ['subscription', 'Subscription'], ['setup', 'Store setup'], ['locations', 'Locations'], ['branchEdit', 'Edit location'], ['profile', 'Store profile'], ['hours', 'Hours'], ['team', 'Team'], ['delivery', 'Delivery fee'], ['tax', 'Sales tax'], ['legal', 'Licenses and legal'], ['notifications', 'Notifications'], ['settings', 'All settings'], ['help', 'Help']];
  function pagesBar() {
    return `<nav class="pages" aria-label="Open a page"><span class="pages-l">Open a page</span>${PAGES.map(([k, l], i) => `<button data-a="page" data-k="${k}" class="${S.screen === k ? 'on' : ''}" aria-current="${S.screen === k ? 'page' : 'false'}">${i + 1}. ${l}</button>`).join('')}</nav>`;
  }

  let lastScreen;
  function render(top) {
    const content = (!S.signedIn && ['signin', 'signup', 'learn', 'lesson', 'legalDoc', 'legalList'].includes(S.screen) ? pubHead(S.screen) : '') + (V[S.screen] || V.home)();
    const scr = root.querySelector('.scr');
    const keep = !top && lastScreen === S.screen && scr ? scr.scrollTop : 0;
    const winKeep = !top && lastScreen === S.screen ? window.scrollY : 0;
    const act = document.activeElement && document.activeElement.id; let caret = null; try { caret = act ? document.activeElement.selectionStart : null; } catch (e) { caret = null; }
    const ov = modal() + (S.toast ? `<div class="toast" role="status">${esc(S.toast)}</div>` : '');
    const pub = !S.signedIn && ['signin', 'signup', 'learn', 'lesson', 'legalDoc', 'legalList'].includes(S.screen);
    const signin = S.screen === 'signin' || S.screen === 'signup' || pub;
    if (PHONE) root.innerHTML = `<div class="stage">${pagesBar()}<div class="device"><div class="scr">${content}</div>${signin ? '' : tabBar()}${ov}</div><p class="stage-note">${esc(M.note || '')}</p></div>`;
    else if (signin) root.innerHTML = `<div class="web">${pagesBar()}${content}${ov}</div>`;
    else root.innerHTML = `<div class="web rw-shell" style="display:flex;min-height:100vh;background:var(--bg)">${sidebar()}<div class="col grow" style="min-width:0;gap:0"><div class="demo"><b>Prototype.</b> Pretend data, no real orders or payments. Try “Simulate new order”.</div>${pagesBar()}<main class="scr col" style="padding:24px max(16px,env(safe-area-inset-right,0px)) 0 24px;gap:18px;overflow:visible;flex:1">${content}${webFooter()}</main></div>${ov}</div>`;
    lastScreen = S.screen;
    const s2 = root.querySelector('.scr'); if (s2 && PHONE) s2.scrollTop = keep;
    if (!PHONE) window.scrollTo(0, winKeep);
    tickCountdowns();
    if (act) { const el = document.getElementById(act); if (el) { el.focus(); try { if (caret != null) el.setSelectionRange(caret, caret); } catch (e) { /* not text */ } } }
  }

  function setPath(path, val) { const p = path.split('.'); let o = S; while (p.length > 1) o = o[p.shift()]; o[p[0]] = val; }
  root.addEventListener('input', (e) => { const t = e.target; if (!t.dataset.m || t.type === 'file') return; setPath(t.dataset.m, t.type === 'checkbox' ? t.checked : t.value); if (t.dataset.live || (t.type === 'checkbox' && t.dataset.rr)) render(); });
  root.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.prep) { const o = S.orders.find((x) => x.id === t.dataset.prep); if (o) o.prep = +t.value; return; }
    if (t.dataset.viewas) { A.role({ v: t.value }); return; }
    if (t.dataset.branch) { A.switchBranch({ id: t.value }); return; }
    if (t.dataset.licfile) { const fl = t.files && t.files[0]; if (fl) { getPath(t.dataset.licfile).file = fl.name; toast('Document attached: ' + fl.name); render(); } return; }
    if (t.dataset.roleof) { const m = S.team[+t.dataset.roleof]; m.role = t.value; toast(`${m.name} is now ${ROLE[m.role]}.`); return; }
    if (t.dataset.photo) { const f = t.files && t.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { if (t.dataset.photo === 'import') { S.modal = null; toast('Menu received. Our team builds it within 48 hours; you approve it before it goes live.'); return; } if (t.dataset.photo === 'edit') S.edit.img = rd.result; else S.profile.cover = rd.result; toast('Photo added.'); render(); }; rd.readAsDataURL(f); return; }
    if (t.dataset.m && t.tagName === 'SELECT') { setPath(t.dataset.m, t.value); if (t.dataset.rr) render(); }
  });

  const find = (id) => S.orders.find((o) => o.id === id);
  const toCents = (v) => (typeof v === 'number' ? v : Math.round((parseFloat(v) || 0) * 100));
  const A = {
    rvLoc: (d) => { S.rv.loc = d.v; render(); },
    rvF: (d) => { S.rv.f = d.v; render(); },
    rvReplyOpen: (d) => { const r = S.reviews.find((x) => x.id === d.id); S.rv.replyId = d.id; S.rv.draft = r.reply ? r.reply.text : ''; render(); },
    rvReplyCancel: () => { S.rv.replyId = null; render(); },
    rvReplySave: (d) => { const t = S.rv.draft.trim(); if (t.length < 5) return toast('Write a short reply first.'); const r = S.reviews.find((x) => x.id === d.id); r.reply = { text: t, date: 'Today' }; S.rv.replyId = null; toast('Reply posted. Customers can see it under the review.'); render(); },
    rvReport: (d) => { const r = S.reviews.find((x) => x.id === d.id); r.reported = true; toast('Sent to Send Koro. We remove reviews that break the Community Guidelines (abuse, personal details, not about the order).'); render(); },
    back, go: (d) => go(d.to), tab: (d) => tabTo(d.to), tabTo: (d) => tabTo(d.to), toastMsg: (d) => toast(d.msg),
    info: (d) => { S.modal = { type: 'info', k: d.k }; render(); },
    sendCode: () => { if (S.phone.replace(/\D/g, '').length !== 10) return toast('Enter a 10-digit mobile number.'); S.codeSent = true; toast('Code sent (prototype: any 6 digits work).'); render(); },
    changePhone: () => { S.codeSent = false; render(); },
    verify: () => { if (!/^\d{6}$/.test(S.code)) return toast('Enter the 6-digit code.'); S.signedIn = true; S.codeSent = false; S.code = ''; toast(`Signed in to ${S.profile.name}.`); tabTo(homeFor()); },
    signOut: () => { S.signedIn = false; S.stack = []; S.screen = 'signin'; render(true); },
    role: (d) => { S.role = d.v; toast(`Viewing as ${ROLE[d.v]}.`); if (!can(S.screen)) tabTo(homeFor()); else render(); },
    simNew: () => { if (!B().accepting) return toast('The store is closed. Tap Open store first.'); const t = FIRST[firstIdx % FIRST.length]; firstIdx++; S.orders.unshift(mkOrder(t, 0)); ringNow(); if (PHONE) { go('newOrder'); toast('New order! 5 minutes to answer.'); } else toast('New order! You have 5 minutes to answer.'); },
    toggleAccept: () => { B().accepting = !B().accepting; toast(B().accepting ? 'Accepting orders again.' : 'Orders paused. Customers see “Closed for now”.'); },
    toggleBusy: () => { S.busy = !S.busy; toast(S.busy ? 'Busy mode: customers see 15 extra minutes.' : 'Back to normal prep times.'); render(); },
    accept: (d) => { const o = find(d.id); if (!o || o.status !== 'new') return; o.status = 'preparing'; const extra = S.busy ? 15 : 0; o.readyAt = Date.now() + (o.prep + extra) * 60000; o.timeline.push([`Accepted, card charged ${money(o.total)}`, new Date()]); toast(`Accepted ${o.id}. Customer charged ${money(o.total)}. Ready in ${o.prep + extra} min.`); if (S.screen === 'newOrder' && !S.orders.some((x) => x.status === 'new')) tabTo('orders'); else render(); },
    declineAsk: (d) => { S.modal = { type: 'decline', id: d.id, reason: 'Too busy right now' }; render(); },
    declineReason: (d) => { S.modal.reason = d.v; render(); },
    declineDo: () => { const o = find(S.modal.id); if (o) { o.status = 'declined'; o.reason = S.modal.reason + ' · hold released'; o.timeline.push(['Declined · hold released', new Date()]); done.unshift(o); S.orders = S.orders.filter((x) => x !== o); } S.modal = null; toast('Declined. The customer was not charged.'); if (S.screen === 'newOrder' && !S.orders.some((x) => x.status === 'new')) tabTo('orders'); else render(); },
    ready: (d) => { const o = find(d.id); o.status = 'ready'; o.timeline.push(['Marked ready', new Date()]); toast(o.fulfil === 'delivery' ? `${o.id} ready. The courier has been told.` : `${o.id} ready. We texted the customer.`); render(); },
    addTime: (d) => { const o = find(d.id); o.readyAt += 5 * 60000; o.timeline.push(['Added 5 minutes', new Date()]); toast('Added 5 minutes. The customer sees the new time.'); render(); },
    complete: (d) => { const o = find(d.id); o.status = 'completed'; o.timeline.push([o.fulfil === 'delivery' ? 'Handed to courier' : 'Picked up', new Date()]); done.unshift(o); S.orders = S.orders.filter((x) => x !== o); toast(`${o.id} complete. ${money(o.net)} to you.`); render(); },
    detail: (d) => go('orderDetail', { detailId: d.id }),
    money: (d) => go('orderMoney', { moneyId: d.id }),
    helpFor: (d) => { S.help.topic = 'order'; S.help.order = d.id; go('help'); },
    histRange: (d) => { S.hist.range = d.v; render(); },
    histStatus: (d) => { S.hist.status = d.v; render(); },
    closeModal: () => { S.modal = null; render(); },
    menuTab: (d) => { S.menuTab = +d.i; render(); },
    addSection: () => { S.modal = { type: 'section', name: '' }; render(); },
    sectionDo: () => { const n = S.modal.name.trim(); if (n.length < 2) return toast('Name the section.'); S.menu.push({ s: n, desc: '', menus: [(S.menus || [{ id: 'm1' }])[0].id], items: [] }); S.menuTab = S.menu.length - 1; S.modal = null; toast(`Added section “${n}”.`); render(); },
    delSection: () => { if (S.menu.length === 1) return toast('Keep at least one section.'); const s = S.menu.splice(S.menuTab, 1)[0]; S.menuTab = 0; toast(`Deleted “${s.s}”.`); render(); },
    menuLoc: (d) => { S.menuLoc = d.v; render(); },
    toggleItemLoc: (d) => { const it = S.menu[S.menuTab].items[+d.i]; const L = S.menuLoc; const b = S.branches.find((x) => x.id === L); if (!it.on) { toast(`${it.name} is off at all locations. Turn it on in “All locations” first.`); render(); return; } it.over = it.over || {}; const o = it.over[L] = { ...(it.over[L] || {}) }; o.on = o.on === false; toast(`${it.name} is now ${o.on ? 'available' : 'sold out'} at ${b.name} only.`); render(); },
    sellHere: (d) => { const it = S.menu[S.menuTab].items[+d.i]; const L = S.menuLoc; if (Array.isArray(it.where) && !it.where.includes(L)) it.where.push(L); toast(`${it.name} is now sold at ${S.branches.find((x) => x.id === L).name}.`); render(); },
    editWhere: (d) => { S.edit.whereSome = d.v === 'some'; render(); },
    editWhereLoc: (d) => { S.edit.whereSet[d.id] = !S.edit.whereSet[d.id]; render(); },
    toggleItem: (d) => { const it = S.menu[S.menuTab].items[+d.i]; if (!it.on) { it.on = true; it.soldUntil = null; toast(`${it.name} is available again at all locations.`); render(); return; } S.modal = { type: 'soldOut', i: +d.i, v: 'today' }; render(); },
    soldOutPick: (d) => { S.modal.v = d.v; render(); },
    soldOutDo: () => { const it = S.menu[S.menuTab].items[S.modal.i]; it.on = false; it.soldUntil = S.modal.v; S.modal = null; toast(it.soldUntil === 'today' ? `${it.name} is sold out today. It comes back when you open tomorrow.` : `${it.name} is sold out until you turn it back on.`); render(); },
    noop: () => {},
    menuSwitch: (d) => { S.promoPick = false; if (d.to === 'menu') { tabTo('menu'); return; } if (PHONE) { S.stack = ['menu']; S.screen = d.to; S.modal = null; render(true); } else tabTo(d.to); },
    dayToggle: (d) => { const parts = d.p.split('.'); const key = parts.pop(); const obj = parts.length ? getPath(parts.join('.')) : S; const arr = obj[key]; const i = arr.indexOf(d.v); if (i >= 0) arr.splice(i, 1); else arr.push(d.v); render(); },
    flip: (d) => { const [k, v] = d.p.split('.'); const arr = S.edit[k]; const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); render(); },
    editState: (d) => { S.edit.state = d.v; S.edit.on = d.v === 'on'; render(); },
    editAvail: (d) => { S.edit.avail = d.v; render(); },
    editTax: (d) => { S.edit.taxable = d.v === 'true'; render(); },
    copyGroups: () => { S.copyFrom = !S.copyFrom; render(); },
    copyGroupsFrom: (d) => { const it = itemById(d.v); S.edit.groups.push(...JSON.parse(JSON.stringify(it.groups)).map((g) => ({ ...g, choices: g.choices.map((c) => [c[0], (c[1] / 100).toFixed(2), !!c[2], !!c[3]]) }))); S.copyFrom = false; toast(`Copied ${it.groups.length} option group${it.groups.length > 1 ? 's' : ''} from ${it.name}.`); render(); },
    choiceDef: (d) => { const c = S.edit.groups[+d.g].choices[+d.c]; c[2] = !c[2]; render(); },
    choiceStock: (d) => { const c = S.edit.groups[+d.g].choices[+d.c]; c[3] = !c[3]; toast(`${c[0] || 'Choice'} is ${c[3] ? 'out of stock' : 'back in stock'}.`); render(); },
    secMenu: (d) => { const s = S.menu[+d.s]; const i = s.menus.indexOf(d.m); if (i >= 0) s.menus.splice(i, 1); else s.menus.push(d.m); render(); },
    secMove: (d) => { const i = +d.i; const j = i + +d.d; if (j < 0 || j >= S.menu.length) return; [S.menu[i], S.menu[j]] = [S.menu[j], S.menu[i]]; S.menuTab = 0; render(); },
    addMenu: () => { S.menus.push({ id: 'm' + Date.now(), name: 'New menu', days: ['1', '2', '3', '4', '5'], from: '07:00', to: '11:00' }); render(); },
    delMenu: (d) => { const m = S.menus.splice(+d.i, 1)[0]; S.menu.forEach((s) => { s.menus = s.menus.filter((x) => x !== m.id); if (!s.menus.length) s.menus = [S.menus[0].id]; }); toast(`Deleted “${m.name}”. Its sections moved to “${S.menus[0].name}”.`); render(); },
    saveMenus: () => { for (const m of S.menus) { if (String(m.name).trim().length < 2) return toast('Every menu needs a name.'); if (!m.days.length) return toast(`“${m.name}”: pick at least one day.`); if (!timeOK(m.from) || !timeOK(m.to) || m.from >= m.to) return toast(`“${m.name}”: check the from and to times.`); } for (const s of S.menu) { if (String(s.s).trim().length < 2) return toast('Every section needs a name.'); if (!s.menus.length) return toast(`“${s.s}” isn’t in any menu, so customers can’t see it.`); } toast('Menus saved. Customers see the new hours right away.'); render(); },
    promoNew: () => { S.promoPick = true; render(); },
    promoPickClose: () => { S.promoPick = false; render(); },
    promoStart: (d) => { S.promoPick = false; go('editPromo', { pdraft: promoBlank(d.v) }); },
    promoEdit: (d) => go('editPromo', { pdraft: { ...JSON.parse(JSON.stringify(S.promos[+d.i])), idx: +d.i } }),
    promoCopy: (d) => { const p = JSON.parse(JSON.stringify(S.promos[+d.i])); go('editPromo', { pdraft: { ...p, id: '', isNew: true, start: '2026-11-08', endMode: 'ongoing', end: '', status: 'draft', stats: { orders: 0, sales: 0, cost: 0 } } }); },
    promoPause: (d) => { const p = S.promos[+d.i]; p.status = p.status === 'paused' ? (p.start > '2026-11-08' ? 'scheduled' : 'live') : 'paused'; toast(`“${p.name}” ${p.status === 'paused' ? 'paused. Customers no longer see it.' : 'is back on.'}`); render(); },
    promoEnd: (d) => { const p = S.promos[+d.i]; p.status = 'ended'; p.endMode = 'end'; p.end = '2026-11-08'; toast(`“${p.name}” ended. Orders already placed keep their discount.`); render(); },
    pItem: (d) => { const a = S.pdraft.items; const i = a.indexOf(d.v); if (i >= 0) a.splice(i, 1); else a.push(d.v); render(); },
    pFree: (d) => { S.pdraft.freeItem = d.v; render(); },
    pMode: (d) => { S.pdraft.mode = d.v; render(); },
    pAud: (d) => { S.pdraft.audience = d.v; render(); },
    pLocs: (d) => { S.pdraft.locs = d.v; render(); },
    pLoc: (d) => { S.pdraft.locSet[d.v] = !S.pdraft.locSet[d.v]; render(); },
    pEnd: (d) => { S.pdraft.endMode = d.v; if (d.v === 'end' && !S.pdraft.end) S.pdraft.end = '2026-11-30'; render(); },
    pSched: (d) => { S.pdraft.sched = d.v; render(); },
    promoSave: () => {
      const p = S.pdraft; const t = p.type; const num = (v) => parseFloat(v);
      if ((t === 'bogo' || t === 'item') && !p.items.length) return toast('Pick at least one dish.');
      if (t === 'item' && p.mode === 'pct' && !(num(p.pct) >= 5 && num(p.pct) <= 75)) return toast('Percent off: between 5 and 75.');
      if (t === 'item' && p.mode === 'amt') { const low = Math.min(...p.items.map((id) => itemById(id).price)); if (!(toC(p.amt) > 0) || toC(p.amt) >= low) return toast(`Amount off must be more than $0 and less than the cheapest dish picked (${money(low)}).`); }
      if (t === 'freeitem' && !p.freeItem) return toast('Pick the free dish.');
      if (t === 'freeitem' && !(toC(p.min) > (itemById(p.freeItem).price))) return toast('The minimum must be more than the free dish’s price.');
      if (t === 'spend' && !(toC(p.save) > 0 && toC(p.min) > toC(p.save))) return toast('The minimum spend must be more than the amount saved.');
      if (t === 'storewide' && !(num(p.pct) >= 5 && num(p.pct) <= 50)) return toast('Percent off the order: between 5 and 50.');
      if ((t === 'freedel' || t === 'freeitem' || t === 'spend') && !(toC(p.min) > 0)) return toast('Set a minimum food subtotal.');
      if (String(p.min).trim() && !(num(p.min) >= 0)) return toast('Check the minimum subtotal.');
      if (String(p.maxOff).trim() && !(toC(p.maxOff) > 0)) return toast('Check the most off per order, or leave it empty.');
      if (p.locs === 'some' && !S.branches.some((b) => p.locSet[b.id])) return toast('Pick at least one location.');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(p.start)) return toast('Pick a start date.');
      if (p.endMode === 'end' && !(p.end >= p.start)) return toast('The end date must be on or after the start date.');
      if (p.sched === 'custom' && (!p.days.length || !timeOK(p.from) || !timeOK(p.to) || p.from >= p.to)) return toast('Check the promotion’s days and times.');
      if (String(p.budget).trim() && !(toC(p.budget) >= 1000)) return toast('A weekly budget must be at least $10, or leave it empty.');
      const clean = { ...p, name: String(p.name).trim() || promoSummary(p), status: p.start > '2026-11-08' ? 'scheduled' : 'live' }; delete clean.isNew; delete clean.idx;
      if (p.isNew) { clean.id = 'p' + Date.now(); S.promos.unshift(clean); } else { clean.status = S.promos[p.idx].status === 'paused' ? 'paused' : clean.status; S.promos[p.idx] = clean; }
      toast(`${p.isNew ? 'Promotion created' : 'Saved'}: “${clean.name}”. ${clean.status === 'live' ? 'Customers see it now.' : clean.status === 'scheduled' ? 'It starts ' + clean.start + '.' : ''}`); back();
    },
    editItem: (d) => { const it = S.menu[S.menuTab].items[+d.i]; go('editItem', { edit: editFrom(it, +d.i, S.menuTab) }); },
    newItem: () => go('editItem', { edit: newEdit() }),
    removePhoto: () => { S.edit.img = ''; render(); },
    addGroup: () => { S.edit.groups.push({ name: '', required: false, min: '0', max: '1', free: '0', each: '1', choices: [['', '0.00', false, false]] }); render(); },
    delGroup: (d) => { S.edit.groups.splice(+d.g, 1); render(); },
    addChoice: (d) => { S.edit.groups[+d.g].choices.push(['', '0.00', false, false]); render(); },
    delChoice: (d) => { S.edit.groups[+d.g].choices.splice(+d.c, 1); render(); },
    saveItem: () => {
      const e = S.edit; const cents = Math.round(parseFloat(e.price) * 100);
      if (e.name.trim().length < 2) return toast('Give the item a name.');
      if (!(cents > 0)) return toast('Enter a price, like 12.50.');
      const pp = String(e.pickupPrice || '').trim(); const ppc = pp ? Math.round(parseFloat(pp) * 100) : null;
      if (pp && !(ppc > 0)) return toast('Check the pickup price, or leave it empty.');
      if (String(e.cal).trim() && !/^\d{1,4}(\s*-\s*\d{1,4})?$/.test(String(e.cal).trim())) return toast('Calories: a number like 620, or a range like 450-600.');
      if (e.avail === 'custom') { if (!e.availDays.length) return toast('Pick at least one day the dish is offered.'); if (!timeOK(e.availFrom) || !timeOK(e.availTo) || e.availFrom >= e.availTo) return toast('Check the dish’s from and to times.'); }
      const where = e.whereSome ? S.branches.filter((b) => e.whereSet[b.id]).map((b) => b.id) : 'all';
      if (e.whereSome && !where.length) return toast('Pick at least one location, or choose “Sell at all locations”.');
      const over = {};
      for (const b of S.branches) { const o = e.over[b.id] || {}; const p = String(o.price || '').trim(); const pc = p ? Math.round(parseFloat(p) * 100) : null; if (p && !(pc > 0)) return toast(`Check the price for ${b.name}.`); over[b.id] = { price: pc != null && pc !== cents ? pc : null, on: o.on !== false }; }
      const groups = [];
      for (const g of e.groups) {
        const choices = g.choices.filter((c) => String(c[0]).trim()).map((c) => [String(c[0]).trim(), toCents(c[1]), !!c[2], !!c[3]]);
        if (!choices.length) continue;
        const name = String(g.name).trim() || 'Options'; const min = parseInt(g.min, 10) || 0; const max = parseInt(g.max, 10) || 0; const free = parseInt(g.free, 10) || 0; const each = parseInt(g.each, 10) || 1;
        if (choices.some((c) => c[1] < 0)) return toast(`“${name}”: extra prices can’t be negative.`);
        if (max < 1) return toast(`“${name}”: “Pick up to” must be at least 1.`);
        if (min > max) return toast(`“${name}”: “Pick at least” can’t be more than “Pick up to”.`);
        if (min > choices.filter((c) => !c[3]).length * each) return toast(`“${name}”: not enough choices in stock to pick ${min}.`);
        if (free > max) return toast(`“${name}”: free choices can’t be more than “Pick up to”.`);
        if (choices.filter((c) => c[2]).length > max) return toast(`“${name}”: too many default choices for “Pick up to ${max}”.`);
        groups.push({ name, required: min > 0, min, max, free, each, choices });
      }
      const on = e.state === 'on';
      const item = { id: 'i' + Date.now(), name: e.name.trim(), desc: e.desc.trim(), price: cents, pickupPrice: ppc != null && ppc !== cents ? ppc : null, popular: !!e.popular, diet: [...e.diet], cal: String(e.cal).trim(), taxable: e.taxable !== false, on, soldUntil: on ? null : e.state, avail: e.avail, availDays: [...e.availDays], availFrom: e.availFrom, availTo: e.availTo, img: e.img, groups, where, over };
      if (e.isNew) S.menu[+e.sec].items.push(item);
      else { const old = S.menu[e.orig].items.splice(e.idx, 1)[0]; item.id = old.id; S.menu[+e.sec].items.splice(+e.sec === e.orig ? e.idx : S.menu[+e.sec].items.length, 0, item); }
      S.menuTab = +e.sec; toast(`Saved “${item.name}” at ${money(cents)}${groups.length ? ` with ${groups.length} option group${groups.length > 1 ? 's' : ''}` : ''}.`); back();
    },
    delItem: () => { const e = S.edit; const it = S.menu[e.orig].items.splice(e.idx, 1)[0]; toast(`Deleted “${it.name}”.`); back(); },
    month: (d) => { S.month = d.v; render(); },
    payout: (d) => { S.payoutOpen = S.payoutOpen === d.id ? null : d.id; render(); },
    copyPayouts: () => copyText(['Payout date,Period,Orders,Food sales,Tax collected,Delivery share,Card processing,Refunds,Paid to bank', ...PAYOUTS.map((p) => [p.date + ' 2026', p.period, p.orders, p.food / 100, p.tax / 100, p.share / 100, p.proc / 100, p.refunds / 100, p.net / 100].join(','))].join('\n')),
    copyTax: () => copyText(['Month,Taxable food sales,Tax collected', ...TAXMONTHS.map((m) => [m[0], (m[1] / 100).toFixed(2), (m[2] / 100).toFixed(2)].join(','))].join('\n')),
    planSet: (d) => { S.planInput = d.v; render(); },
    ruleType: (d) => { S.ruleDraft.type = d.v; render(); },
    ruleMode: (d) => { S.ruleDraft.mode = d.v; render(); },
    saveRule: () => { const r = S.ruleDraft; S.rule = { ...r, version: S.rule.version + 1 }; S.ruleDraft = null; S.branches.forEach((b) => { b.deliverySet = true; }); toast(`Saved as rule version ${S.rule.version}. New orders use it.`); render(); },
    saveProfile: () => { if (S.profile.name.trim().length < 2) return toast('Enter your restaurant name.'); if (!B().cuisines.length) return toast('Pick at least one cuisine.'); toast('Profile saved. Customers see the changes now.'); render(); },
    payBranch: (d) => { S.payBranch = d.id; S.payoutOpen = null; render(); },
    payUseOwn: () => { const b = S.branches.find((x) => x.id === S.payBranch) || B(); b.payout = 'own'; toast(`${b.name} will use its own Stripe account. Connect it to get paid.`); render(); },
    payUseMain: () => { const b = S.branches.find((x) => x.id === S.payBranch) || B(); b.payout = 'same'; toast(`${b.name} now uses your main Stripe account.`); render(); },
    payConnectOwn: () => { const b = S.branches.find((x) => x.id === S.payBranch) || B(); b.ownConnected = true; toast(`Stripe connected for ${b.name} (prototype: sandbox only).`); render(); },
    pausePick: (d) => { S.modal.v = d.v; render(); },
    switchBranch: (d) => { S.branchId = d.id; S.licBranch = null; S.licOpen = null; toast(`Managing ${B().name}.`); render(); },
    newBranch: () => { S.cuisineQ = ''; go('branchEdit', { bdraft: { isNew: true, name: '', address: '', phone: '', radius: '3', prep: '20', taxRate: '', cuisines: [...B().cuisines], payout: 'same' } }); },
    editBranch: (d) => { const b = S.branches.find((x) => x.id === d.id); S.cuisineQ = ''; go('branchEdit', { bdraft: { ...b, cuisines: [...b.cuisines] } }); },
    setupBranch: (d) => { S.branchId = d.id; go('setup'); },
    setupGo: (d) => { if (d.to === 'payouts') S.payBranch = S.branchId; if (d.to === 'branchEdit') return A.editBranch({ id: S.branchId }); if (d.to === 'legal') { S.licBranch = S.branchId; S.licOpen = null; } go(d.to); },
    useTax: (d) => { S.bdraft.taxRate = d.v; render(); },
    useTaxBranch: (d) => { B().taxRate = d.v; render(); },
    branchPayout: (d) => { S.bdraft.payout = d.v; render(); },
    pickCuisine: (d) => { const arr = d.t === 'draft' ? S.bdraft.cuisines : d.t === 'signup' ? S.signup.cuisines : B().cuisines; const i = arr.indexOf(d.c); if (i >= 0) arr.splice(i, 1); else { if (arr.length >= 3) return toast('Pick up to 3 cuisines. Tap one to remove it.'); arr.push(d.c); } render(); },
    saveBranch: () => {
      const d = S.bdraft;
      if (d.name.trim().length < 2) return toast('Name this location.');
      if (d.address.trim().length < 8) return toast('Enter the street address.');
      if (String(d.phone).replace(/\D/g, '').length !== 10) return toast('Enter a 10-digit phone number.');
      if (!d.cuisines.length) return toast('Pick at least one cuisine.');
      const clean = { name: d.name.trim(), address: d.address.trim(), phone: d.phone, radius: d.radius, prep: d.prep, taxRate: d.taxRate || suggestTax(d.address), cuisines: [...d.cuisines], payout: d.payout, juris: detectJuris(d.address) };
      if (d.isNew) Object.assign(clean, { octNet: 0, novSoFar: 0, ownAcct: 'acct_…' + Math.random().toString(16).slice(2, 5).toUpperCase(), ownConnected: false });
      if (d.isNew) { const nb = { id: 'b' + Date.now(), status: 'setup', accepting: false, hoursSet: false, deliverySet: false, week: S.week.map((x) => [...x]), closures: [], ...clean }; S.branches.push(nb); S.lic[nb.id] = {}; S.branchId = nb.id; S.stack = []; S.screen = 'setup'; toast(`Added ${nb.name}. Finish its setup to go live.`); render(true); }
      else { Object.assign(S.branches.find((x) => x.id === d.id), clean); toast('Location saved.'); back(); }
    },
    delBranchAsk: () => { S.modal = { type: 'delBranch' }; render(); },
    delBranchDo: () => { const id = S.bdraft.id; S.branches = S.branches.filter((b) => b.id !== id); delete S.lic[id]; if (S.branchId === id) S.branchId = S.branches[0].id; S.modal = null; toast('Location deleted.'); tabTo('locations'); },
    branchAccept: (d) => { const b = S.branches.find((x) => x.id === d.id); b.accepting = !b.accepting; toast(`${b.name}: ${b.accepting ? 'accepting orders' : 'paused'}.`); render(); },
    licBranch: (d) => { S.licBranch = d.id; S.licOpen = null; render(); },
    licToggle: (d) => { S.licOpen = S.licOpen === d.k ? null : d.k; render(); },
    licSubmit: (d) => {
      const r = getPath(d.path); const pb = d.path.split('.'); const br = S.branches.find((x) => x.id === pb[1]) || B(); const def = defsFor(br).find((x) => x.key === d.k);
      if (!r.number || !String(r.number).trim()) return toast(def.grade ? 'Choose your grade.' : 'Enter the number.');
      if (def.expires && !r.expires) return toast('Enter the expiry date.');
      if (def.holder && !String(r.holder || '').trim()) return toast('Enter the certificate holder.');
      if (!def.grade && !def.noFile && !r.file) return toast('Upload the document.');
      r.status = def.grade ? 'verified' : 'review'; S.licOpen = null; toast(def.grade ? 'Grade saved.' : 'Submitted. We’ll verify it with the agency.'); render();
    },
    licAttest: (d) => { const r = getPath(d.path); r.status = r.status === 'verified' ? 'missing' : 'verified'; toast(r.status === 'verified' ? 'Confirmed.' : 'Confirmation removed.'); render(); },
    agree: (d) => { S.agree[d.k] = !S.agree[d.k]; render(); },
    licVerify: (d) => { getPath(d.path).status = 'verified'; toast('Marked verified (demo).'); render(); },
    saveBusiness: () => { const z = S.business; if (z.legal.trim().length < 2) return toast('Enter the legal business name.'); if (!/^\d{2}-?\d{7}$/.test(String(z.ein).trim())) return toast('EIN should be 9 digits, like 12-3456789.'); if (String(z.owner).trim().length < 2) return toast('Enter the owner or authorized person.'); toast('Business details saved.'); render(); },
    connectStripe: () => { S.stripe = true; toast('Stripe connected (prototype: sandbox only).'); render(); },
    invoice: (d) => { S.modal = { type: 'invoice', id: d.id }; render(); },
    cancelSubAsk: () => { S.modal = { type: 'cancelSub' }; render(); },
    cancelSubDo: () => { S.sub.cancel = true; S.modal = null; toast('Your subscription will end on November 30.'); render(); },
    subUnpaidDemo: () => { S.sub.unpaid = !S.sub.unpaid; toast(S.sub.unpaid ? 'Preview: November invoice unpaid after the last retry. Your locations are paused.' : 'Preview ended.'); render(); },
    subPayNow: () => { S.sub.unpaid = false; toast('Paid $150.00. Your locations are live again.'); render(); },
    resumeSub: () => { S.sub.cancel = false; toast('Subscription kept.'); render(); },
    saveBillingEmail: () => { if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(S.business.email)) return toast('Enter a valid email.'); toast('Billing email saved.'); },
    dayToggle: (d) => { const w = B().week[+d.i]; w[1] = !w[1]; render(); },
    copyMonday: () => { const b = B(); const m = b.week[0]; b.week = b.week.map((x) => [x[0], m[1], m[2], m[3]]); toast('Copied Monday’s hours to every day.'); render(); },
    saveHours: () => { B().hoursSet = true; toast(`Hours saved for ${B().name}.`); render(); },
    addClosure: () => { const c = S.closeDraft; if (!c.date) return toast('Pick a date.'); B().closures.push([c.date, c.note.trim() || 'Closed']); B().closures.sort(); S.closeDraft = { date: '', note: '' }; toast('Closure added. Customers can’t order that day.'); render(); },
    delClosure: (d) => { B().closures.splice(+d.i, 1); render(); },
    saveTax: () => { if (!(parseFloat(B().taxRate) >= 0)) return toast('Enter your tax rate.'); if (!S.taxAccepted) return toast('Tick the box to accept responsibility for sales tax.'); toast(`Saved ${B().taxRate}% for ${B().name}. You file and pay it.`); render(); },
    goLive: () => { B().freeMonth = true; B().status = 'live'; B().accepting = true; toast(`${B().name} is live! Customers can find it now.`); render(); },
    closeAsk: () => { S.modal = { type: 'close', v: '30' }; render(); },
    closePick: (d) => { S.modal.v = d.v; render(); },
    closeDo: () => { const b = B(); const v = S.modal.v; b.accepting = false; S.busy = false; if (v === 'today') b.closedUntil = 'today'; else if (v === 'manual') b.closedUntil = null; else b.closedUntil = Date.now() + +v * 60000; S.modal = null; toast(v === 'manual' ? `${b.name} is closed. Tap Open store when you’re ready.` : v === 'today' ? `${b.name} is closed for the rest of today.` : `${b.name} is paused for ${v === '30' ? '30 minutes' : '1 hour'}.`); render(); },
    openNow: () => { const b = B(); b.accepting = true; b.closedUntil = null; toast(`${b.name} is open. Customers can order now.`); render(); },
    toSignin: () => { S.screen = 'signin'; S.codeSent = false; S.stack = []; render(true); },
    toSignup: () => { S.signup = { step: 1, owner: '', phone: '', email: '', code: '', name: '', address: '', cuisines: [], locs: '1', agree: false, tax: false }; S.cuisineQ = ''; S.screen = 'signup'; S.stack = []; render(true); },
    suBack: () => { S.signup.step = Math.max(1, S.signup.step - 1); render(true); },
    suNext: () => {
      const u = S.signup;
      if (u.step === 1) { if (u.owner.trim().length < 2) return toast('Enter your full name.'); if (u.phone.replace(/\D/g, '').length !== 10) return toast('Enter a 10-digit mobile number.'); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(u.email)) return toast('Enter a valid email.'); u.step = 2; toast('Code sent (prototype: any 6 digits work).'); }
      else if (u.step === 2) { if (!/^\d{6}$/.test(u.code)) return toast('Enter the 6-digit code.'); u.step = 3; S.cuisineQ = ''; }
      else if (u.step === 3) { if (u.name.trim().length < 2) return toast('Enter your restaurant name.'); if (u.address.trim().length < 8) return toast('Enter the address with city, state and ZIP.'); if (!u.cuisines.length) return toast('Pick at least one cuisine.'); u.step = 4; }
      render(true);
    },
    suCreate: () => {
      const u = S.signup; if (!u.agree) return toast('Accept the partner agreement to continue.'); if (!u.tax) return toast('Tick the sales tax box to continue.');
      const id = 'b' + Date.now(); const area = (u.address.split(',')[1] || 'Main').trim();
      S.profile.name = u.name.trim(); S.business = { legal: '', dba: u.name.trim(), entity: 'LLC', ein: '', dos: '', email: u.email, owner: u.owner.trim() };
      S.team = [{ name: u.owner.trim(), phone: u.phone, role: 'owner' }]; S.role = 'owner';
      S.branches = [{ id, name: area, address: u.address.trim(), phone: u.phone, cuisines: [...u.cuisines], juris: detectJuris(u.address), status: 'setup', octNet: 0, novSoFar: 0, ownAcct: 'acct_…3D8', ownConnected: false, accepting: false, prep: '20', radius: '3', taxRate: suggestTax(u.address), hoursSet: false, deliverySet: false, payout: 'same', week: S.week.map((x) => [...x]), closures: [] }];
      S.lic = { [id]: {} }; S.branchId = id; S.stripe = false; S.taxAccepted = true; S.agree = { signed: true, licenses: false, food: false, bathroom: false };
      S.signedIn = true; S.stack = []; S.screen = 'setup'; toast(`Welcome, ${u.owner.split(' ')[0]}! ${u.name} is created. Let’s finish setup.`); render(true);
    },
    stripeTab: (d) => { S.stripeTab = d.k; render(); },
    testRing: () => { ringNow(); toast('This is how a new order sounds.'); },
    notif: (d) => { S.notif[d.k] = !S.notif[d.k]; toast(S.notif[d.k] ? 'Turned on.' : 'Turned off.'); },
    testSound: () => { beep(); toast('Played the new-order sound.'); },
    invite: () => { S.modal = { type: 'invite', name: '', phone: '', role: 'staff' }; render(); },
    inviteRole: (d) => { S.modal.role = d.v; render(); },
    inviteDo: () => { const m = S.modal; if (m.name.trim().length < 2) return toast('Enter their name.'); if (m.phone.replace(/\D/g, '').length !== 10) return toast('Enter a 10-digit mobile number.'); S.team.push({ name: m.name.trim(), phone: m.phone, role: m.role, invited: true }); S.modal = null; toast(`Invite texted to ${m.name.trim()}.`); render(); },
    removeMember: (d) => { const m = S.team.splice(+d.i, 1)[0]; toast(`${m.name} removed.`); render(); },
    sendHelp: () => { if (S.help.msg.trim().length < 5) return toast('Tell us what you need.'); const topics = { order: 'A live order', money: 'Payouts or earnings', menu: 'Menu or photos', delivery: 'Delivery or courier', other: 'Something else' }; S.help.sent.unshift({ id: 'H' + (200 + S.help.sent.length), topic: topics[S.help.topic], order: S.help.order }); S.help.msg = ''; S.help.order = ''; toast('Request sent.'); render(true); },
  };
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-a]'); if (!t || !root.contains(t)) return;
    const fn = A[t.dataset.a]; if (!fn) return;
    if (!(t.tagName === 'INPUT' && (t.type === 'checkbox' || t.type === 'radio'))) e.preventDefault();
    fn(t.dataset, t, e);
  });

  // ---------- open any page directly ----------
  const hashOf = (k) => (k === 'settings' ? 'store-settings' : k); // "settings" is reserved in artifact links
  function setHash(k) { try { history.replaceState(null, '', '#' + hashOf(k)); } catch (e) { try { location.hash = hashOf(k); } catch (e2) { /* ignore */ } } }
  function openPage(k) {
    S.modal = null; S.stack = [];
    if (k !== 'signin' && k !== 'signup' && k !== 'learn' && k !== 'lesson') S.signedIn = true;
    if (k === 'legalDoc') S.legalId = 'restaurantTerms';
    if (k === 'legalDoc' || k === 'legalList') S.stack = PHONE && S.signedIn ? ['more'] : [];
    if (k === 'learn' || k === 'lesson') { S.signedIn = false; S.learnQ = ''; S.learnTrack = 'all'; if (k === 'lesson') S.lessonId = 'delivery'; }
    if (['overview', 'home'].includes(k)) S.branchId = (S.branches.find((b) => b.status === 'live') || S.branches[0]).id;
    if (!can(k)) S.role = 'owner';
    if ((k === 'orders' || k === 'newOrder') && !S.orders.some((o) => o.status === 'new')) S.orders.unshift(mkOrder(FIRST[firstIdx++ % FIRST.length], 0));
    if (k === 'newOrder' || k === 'orderDetail') S.stack = ['orders'];
    if (k === 'orderDetail') S.detailId = (S.orders.find((o) => o.status === 'preparing') || S.orders[0] || PAST[0]).id;
    if (k === 'editItem') { ensure2(); S.attachPick = false; S.edit = editFrom2(S.menu[0].items[0]); S.stack = ['menu']; }
    if (k === 'cats' || k === 'mods') { ensure2(); S.stack = PHONE ? ['menu'] : []; }
    if (k === 'editGroup') { ensure2(); S.gdraft = groupDraft(S.mods[0]); S.stack = PHONE ? ['menu', 'mods'] : ['mods']; }
    if (k === 'menu') ensure2();
    if (k === 'menus' || k === 'promos') { ensureMenus(); S.promoPick = false; S.stack = PHONE ? ['menu'] : []; }
    if (k === 'editPromo') { ensureMenus(); S.pdraft = promoBlank('bogo'); S.pdraft.items = ['gcb']; S.stack = PHONE ? ['menu', 'promos'] : ['promos']; }
    if (k === 'orderMoney') { S.moneyId = 'SK1049'; S.stack = PHONE ? ['more', 'earnings'] : ['earnings']; }
    if (k === 'signin') { S.signedIn = false; S.codeSent = false; }
    if (k === 'signup') { S.signedIn = false; S.cuisineQ = ''; S.signup = { step: 1, owner: '', phone: '', email: '', code: '', name: '', address: '', cuisines: [], locs: '1', agree: false, tax: false }; }
    const sub = ['history', 'earnings', 'payouts', 'stripe', 'subscription', 'locations', 'legal', 'delivery', 'profile', 'hours', 'team', 'tax', 'notifications', 'setup', 'help'];
    if (PHONE && sub.includes(k)) S.stack = ['more'];
    if (!PHONE && ['delivery', 'profile', 'hours', 'team', 'tax', 'notifications', 'setup', 'help'].includes(k)) S.stack = [];
    if (k === 'delivery') S.ruleDraft = null;
    if (k === 'setup' && S.branches.some((b) => b.id === 'b2')) S.branchId = 'b2';
    if (k === 'branchEdit') { const b = B(); S.cuisineQ = ''; S.bdraft = { ...b, cuisines: [...b.cuisines] }; S.stack = ['locations']; }
    if (k === 'payouts') { S.payBranch = S.branchId; S.payoutOpen = null; }
    if (k === 'stripe') S.stripeTab = 'overview';
    if (k === 'legal') { S.licBranch = null; S.licOpen = null; }
    if (k === 'profile') S.cuisineQ = '';
    S.screen = k; setHash(k); render(true);
  }
  // ================= Menu editor v2 =================
  // Modelled on Uber Eats Menu Maker, DoorDash Merchant Portal and Grubhub for Restaurants:
  // categories, items with sizes, a shared library of option groups (modifiers) with nested choices,
  // labels, allergens, templates for coffee shops / juice bars / bakeries / pizza / burgers, bulk edits and a customer preview.
  const ALLERGENS = [['milk', 'Milk'], ['egg', 'Eggs'], ['fish', 'Fish'], ['shellfish', 'Shellfish'], ['treenuts', 'Tree nuts'], ['peanuts', 'Peanuts'], ['wheat', 'Wheat'], ['soy', 'Soy'], ['sesame', 'Sesame']];
  const DIET2 = [['veg', 'Vegetarian'], ['vegan', 'Vegan'], ['gf', 'Gluten-free'], ['df', 'Dairy-free'], ['halal', 'Halal'], ['kosher', 'Kosher'], ['keto', 'Keto'], ['organic', 'Organic']];
  const SPICE = [['', 'Not spicy'], ['mild', 'Mild'], ['medium', 'Medium'], ['hot', 'Hot']];
  const LABELS = [['popular', 'Popular'], ['new', 'New'], ['chef', 'Chef’s pick'], ['seasonal', 'Seasonal']];
  // [name, min, max, free, each, [[choice, cents, default, nextGroupName]]]
  const TPL_GROUPS = {
    coffee: ['Coffee shop', [
      ['Hot or iced', 1, 1, 0, 1, [['Hot', 0, 1], ['Iced', 0]]],
      ['Milk', 1, 1, 0, 1, [['Whole milk', 0, 1], ['2% milk', 0], ['Skim milk', 0], ['Oat milk', 75], ['Almond milk', 75], ['Soy milk', 75], ['No milk', 0]]],
      ['Espresso shots', 0, 4, 0, 4, [['Extra shot', 100], ['Decaf shot', 100]]],
      ['Flavor syrups', 0, 3, 0, 2, [['Vanilla', 75], ['Caramel', 75], ['Hazelnut', 75], ['Sugar-free vanilla', 75]]],
      ['Sweetener', 0, 2, 0, 2, [['Sugar', 0], ['Raw sugar', 0], ['Honey', 0], ['Stevia', 0]]],
      ['Ice', 0, 1, 0, 1, [['Light ice', 0], ['Regular ice', 0, 1], ['Extra ice', 0], ['No ice', 0]]],
      ['Toppings', 0, 3, 0, 1, [['Whipped cream', 50], ['Cold foam', 125], ['Caramel drizzle', 50], ['Cinnamon', 0]]],
    ]],
    juice: ['Juice and smoothie bar', [
      ['Base', 1, 1, 0, 1, [['Apple juice', 0, 1], ['Almond milk', 0], ['Oat milk', 50], ['Coconut water', 100]]],
      ['Boosts', 0, 3, 0, 1, [['Protein', 150], ['Chia seeds', 100], ['Spirulina', 150], ['Collagen', 200], ['Flax seeds', 100]]],
      ['Add fruit', 0, 3, 0, 2, [['Banana', 75], ['Strawberry', 75], ['Mango', 75], ['Pineapple', 75]]],
      ['Sweetness', 1, 1, 0, 1, [['No added sugar', 0], ['Light', 0], ['Regular', 0, 1], ['Extra honey', 50]]],
      ['Wellness shot', 0, 2, 0, 1, [['Ginger shot', 300], ['Turmeric shot', 300], ['Wheatgrass shot', 350]]],
    ]],
    bakery: ['Bakery and café', [
      ['Warm it up', 0, 1, 0, 1, [['Warmed', 0]]],
      ['Spread', 0, 2, 0, 1, [['Butter', 0], ['Cream cheese', 100], ['Jam', 50]]],
    ]],
    pizza: ['Pizza', [
      ['Crust', 1, 1, 0, 1, [['Hand-tossed', 0, 1], ['Thin crust', 0], ['Gluten-free crust', 300]]],
      ['Pizza toppings', 0, 10, 0, 2, [['Pepperoni', 200], ['Sausage', 200], ['Mushrooms', 150], ['Onions', 100], ['Peppers', 150], ['Extra cheese', 200]]],
    ]],
    burger: ['Burgers', [
      ['Cook it', 1, 1, 0, 1, [['Medium', 0, 1], ['Medium well', 0], ['Well done', 0]]],
      ['Cheese', 0, 1, 0, 1, [['American', 100], ['Cheddar', 100], ['Swiss', 100]]],
      ['Burger add-ons', 0, 5, 0, 2, [['Bacon', 250], ['Avocado', 200], ['Fried egg', 150]]],
      ['Choose a drink', 1, 1, 0, 1, [['Coke', 0, 1], ['Diet Coke', 0], ['Sprite', 0], ['Water', 0]]],
      ['Make it a meal', 0, 1, 0, 1, [['Add fries and a drink', 499, 0, 'Choose a drink']]],
    ]],
    bowls: ['Bowls and salads', [
      ['Base', 1, 1, 0, 1, [['White rice', 0, 1], ['Brown rice', 0], ['Quinoa', 100], ['Greens', 0]]],
      ['Protein', 1, 2, 0, 1, [['Chicken', 0, 1], ['Tofu', 0], ['Steak', 300], ['Salmon', 400]]],
      ['Bowl toppings', 0, 6, 3, 1, [['Corn', 50], ['Cucumber', 50], ['Pickled onions', 50], ['Edamame', 75], ['Avocado', 200]]],
      ['Sauce', 0, 2, 1, 1, [['House sauce', 0], ['Spicy mayo', 50], ['Tahini', 50]]],
    ]],
  };
  // Starter menus: [category, [[name, description, price cents or [[size, cents]], [group names]]]]
  const SHOPS = {
    coffee: ['Coffee shop', 'Espresso drinks, cold brew, tea and pastries, with sizes, milk, shots and syrups', [
      ['Espresso drinks', [['Latte', 'Espresso and steamed milk', [['Small (12 oz)', 475], ['Medium (16 oz)', 525], ['Large (20 oz)', 575]], ['Hot or iced', 'Milk', 'Espresso shots', 'Flavor syrups', 'Toppings']], ['Cappuccino', 'Espresso with steamed milk and thick foam', [['Small (12 oz)', 450], ['Medium (16 oz)', 500]], ['Milk', 'Espresso shots', 'Flavor syrups']], ['Americano', 'Espresso and hot water', [['Small (12 oz)', 375], ['Medium (16 oz)', 425], ['Large (20 oz)', 475]], ['Hot or iced', 'Espresso shots', 'Sweetener']]]],
      ['Cold brew and iced', [['Cold brew', 'Steeped for 18 hours, smooth and strong', [['Medium (16 oz)', 475], ['Large (24 oz)', 550]], ['Milk', 'Flavor syrups', 'Sweetener', 'Ice', 'Toppings']]]],
      ['Tea', [['Matcha latte', 'Stone-ground matcha and milk', [['Medium (16 oz)', 550], ['Large (20 oz)', 600]], ['Hot or iced', 'Milk', 'Sweetener']]]],
      ['Bakery', [['Butter croissant', 'Baked fresh every morning', 395, ['Warm it up', 'Spread']]]],
    ]],
    juice: ['Juice and smoothie bar', 'Cold-pressed juices, smoothies, acai bowls and shots, with boosts and add-ins', [
      ['Fresh juices', [['Green juice', 'Kale, cucumber, celery, apple, lemon', [['16 oz', 899], ['24 oz', 1149]], ['Wellness shot']], ['Fresh orange juice', 'Squeezed to order', [['12 oz', 599], ['16 oz', 749]], []]]],
      ['Smoothies', [['Berry blast', 'Strawberry, blueberry, banana', [['16 oz', 899], ['24 oz', 1149]], ['Base', 'Boosts', 'Add fruit', 'Sweetness']]]],
      ['Acai bowls', [['Classic acai bowl', 'Acai, granola, banana, berries, honey', 1350, ['Boosts', 'Add fruit']]]],
      ['Wellness shots', [['Ginger shot', 'Ginger, lemon and a pinch of cayenne', 400, []]]],
    ]],
    bakery: ['Bakery and café', 'Pastries, breads and bagels, with warming and spreads', [
      ['Pastries', [['Almond croissant', 'Filled with almond cream', 475, ['Warm it up']], ['Blueberry muffin', 'Fresh blueberries, crumb top', 375, ['Warm it up']]]],
      ['Bagels', [['Everything bagel', 'Hand-rolled, boiled and baked', 250, ['Warm it up', 'Spread']]]],
    ]],
    pizza: ['Pizza', 'Pies by size, crusts and toppings', [
      ['Pizza', [['Margherita', 'Tomato, mozzarella, basil', [['12 inch', 1600], ['16 inch', 2100], ['18 inch', 2400]], ['Crust', 'Pizza toppings']], ['Cheese slice', 'Classic New York slice', 350, ['Pizza toppings']]]],
    ]],
    burger: ['Burgers', 'Burgers with cooking level, cheese, add-ons and a meal option', [
      ['Burgers', [['Classic burger', 'Beef patty, lettuce, tomato, pickles, house sauce', 1200, ['Cook it', 'Cheese', 'Burger add-ons', 'Make it a meal']]]],
      ['Sides', [['Fries', 'Crispy, sea salt', [['Regular', 450], ['Large', 600]], []]]],
    ]],
  };
  // ---- Cuisine packs: every cuisine uses the same building blocks (category → item → sizes → option groups → choices → follow-up groups),
  // exactly like Uber Eats and DoorDash. Packs only pre-fill typical choices. Group keys are unique; the 7th field is the name customers see.
  const TPL_ORDER = [['Cafés and drinks', ['coffee', 'donut', 'juice', 'bakery']], ['Fast food', ['ffburger', 'chicken', 'pizza', 'burger']], ['Cuisines', ['indian', 'bangla', 'mexican', 'chinese', 'thai', 'japanese', 'halal', 'italian', 'american', 'steak', 'bowls']], ['For any restaurant', ['common']]];
  Object.assign(TPL_GROUPS, {
    common: ['Any restaurant', [
      ['Remove ingredients', 0, 6, 0, 1, [['No onions', 0], ['No tomatoes', 0], ['No lettuce', 0], ['No pickles', 0], ['No cheese', 0], ['No sauce', 0]]],
      ['Spice level', 1, 1, 0, 1, [['Mild', 0, 1], ['Medium', 0], ['Hot', 0], ['Extra hot', 0]]],
      ['Choose a side', 1, 1, 0, 1, [['Fries', 0, 1], ['Side salad', 0], ['Onion rings', 150], ['Sweet potato fries', 150]]],
      ['Choose 2 sides', 2, 2, 2, 1, [['Fries', 0], ['Mashed potatoes', 0], ['Mac and cheese', 0], ['Coleslaw', 0], ['Side salad', 0], ['Seasonal vegetables', 0]], 'Choose 2 sides'],
      ['Choose a drink', 1, 1, 0, 1, [['Coke', 0, 1], ['Diet Coke', 0], ['Sprite', 0], ['Water', 0]]],
      ['Add a drink', 0, 2, 0, 2, [['Coke', 250], ['Diet Coke', 250], ['Sprite', 250], ['Bottled water', 200]]],
      ['Add a dessert', 0, 2, 0, 2, [['Cookie', 250], ['Brownie', 350], ['Cheesecake slice', 550]]],
      ['Utensils and extras', 0, 3, 0, 1, [['Extra napkins', 0], ['Extra sauce', 50], ['Plastic utensils', 0]]],
    ]],
    donut: ['Coffee and donuts', [
      ['Pick 6 donuts', 6, 6, 0, 6, [['Glazed', 0], ['Chocolate frosted', 0], ['Boston kreme', 50], ['Jelly', 50], ['Strawberry sprinkle', 0], ['Old fashioned', 0]], 'Pick your 6 donuts'],
      ['Pick 12 donuts', 12, 12, 0, 12, [['Glazed', 0], ['Chocolate frosted', 0], ['Boston kreme', 50], ['Jelly', 50], ['Strawberry sprinkle', 0], ['Old fashioned', 0]], 'Pick your 12 donuts'],
      ['Sandwich bread', 1, 1, 0, 1, [['Croissant', 0, 1], ['English muffin', 0], ['Bagel', 0], ['Sourdough', 0]], 'Choose your bread'],
      ['Breakfast meat', 1, 1, 0, 1, [['Bacon', 0, 1], ['Sausage', 0], ['Turkey sausage', 0], ['No meat', -0]], 'Choose your meat'],
    ]],
    ffburger: ['Fast-food burgers', [
      ['Meal size', 1, 1, 0, 1, [['Sandwich only', 0, 1], ['Medium meal (fries + drink)', 350, 0, 'Meal side'], ['Large meal (fries + drink)', 450, 0, 'Meal side']], 'Make it a meal?'],
      ['Meal side', 1, 1, 0, 1, [['Fries', 0, 1, 'Meal drink'], ['Onion rings', 50, 0, 'Meal drink'], ['Apple slices', 0, 0, 'Meal drink']], 'Choose your side'],
      ['Meal drink', 1, 1, 0, 1, [['Coke', 0, 1], ['Diet Coke', 0], ['Sprite', 0], ['Iced tea', 0], ['Shake', 150]], 'Choose your drink'],
      ['Burger extras', 0, 6, 0, 2, [['Extra patty', 200], ['Bacon', 150], ['Cheese slice', 50], ['Extra pickles', 0], ['Extra sauce', 0]], 'Add extras'],
      ['Nugget sauces', 1, 2, 2, 1, [['BBQ', 0, 1], ['Honey mustard', 0], ['Sweet and sour', 0], ['Ranch', 0], ['Buffalo', 0]], 'Choose dipping sauces'],
    ]],
    chicken: ['Fried chicken', [
      ['Chicken recipe', 1, 1, 0, 1, [['Original', 0, 1], ['Spicy', 0], ['Half original, half spicy', 0]], 'Choose your recipe'],
      ['Chicken pieces', 1, 1, 0, 1, [['Mixed (white and dark)', 0, 1], ['All white meat', 200], ['All dark meat', 0]], 'White or dark meat'],
      ['Bucket sides', 2, 2, 2, 1, [['Mashed potatoes and gravy', 0], ['Coleslaw', 0], ['Mac and cheese', 0], ['Corn', 0], ['Fries', 0], ['Biscuits (4)', 0]], 'Choose 2 large sides'],
      ['Dipping sauce', 0, 3, 1, 1, [['Honey mustard', 50], ['BBQ', 50], ['Ranch', 50], ['Hot sauce', 50]], 'Dipping sauces'],
    ]],
    indian: ['Indian', [
      ['Indian spice', 1, 1, 0, 1, [['Mild', 0], ['Medium', 0, 1], ['Hot', 0], ['Indian hot', 0]], 'Spice level'],
      ['Curry protein', 1, 1, 0, 1, [['Chicken', 0, 1], ['Lamb', 300], ['Goat', 300], ['Shrimp', 400], ['Paneer', 0], ['Mixed vegetables', 0]], 'Choose your protein'],
      ['Naan', 0, 3, 0, 2, [['Plain naan', 300], ['Butter naan', 350], ['Garlic naan', 400], ['Cheese naan', 450], ['Tandoori roti', 300]], 'Add bread'],
      ['Rice choice', 1, 1, 0, 1, [['Basmati rice', 0, 1], ['Jeera rice', 100], ['Biryani rice', 300], ['No rice', 0]], 'Choose your rice'],
      ['Indian sides', 0, 3, 0, 1, [['Raita', 250], ['Mango chutney', 150], ['Papadum', 200], ['Onion salad', 100]], 'Add sides'],
    ]],
    bangla: ['Bangladeshi', [
      ['Plate size', 1, 1, 0, 1, [['Half plate', 0, 1], ['Full plate', 600]], 'Choose plate size'],
      ['Bangla spice', 1, 1, 0, 1, [['Less spicy', 0], ['Regular', 0, 1], ['Extra jhal', 0]], 'Spice (jhal) level'],
      ['Bangla add-ons', 0, 4, 0, 2, [['Boiled egg', 150], ['Extra meat piece', 400], ['Aloo (potato)', 100], ['Salad', 100], ['Borhani', 300]], 'Add-ons'],
      ['Bangla bread', 0, 3, 0, 3, [['Paratha', 200], ['Naan', 250], ['Luchi (2 pcs)', 250]], 'Add bread'],
      ['Fish choice', 1, 1, 0, 1, [['Rui', 0, 1], ['Pabda', 200], ['Hilsa (ilish)', 600]], 'Choose your fish'],
    ]],
    mexican: ['Mexican', [
      ['Mex protein', 1, 1, 0, 1, [['Chicken', 0, 1], ['Steak', 250], ['Carnitas', 100], ['Barbacoa', 250], ['Al pastor', 100], ['Veggie', 0]], 'Choose your protein'],
      ['Mex rice', 0, 1, 0, 1, [['White rice', 0, 1], ['Brown rice', 0], ['No rice', 0]], 'Rice'],
      ['Mex beans', 0, 1, 0, 1, [['Black beans', 0, 1], ['Pinto beans', 0], ['No beans', 0]], 'Beans'],
      ['Salsa', 0, 3, 3, 1, [['Pico de gallo (mild)', 0], ['Salsa verde (medium)', 0], ['Salsa roja (hot)', 0], ['Corn salsa', 0]], 'Choose salsas'],
      ['Mex toppings', 0, 6, 0, 1, [['Cheese', 0], ['Sour cream', 0], ['Lettuce', 0], ['Guacamole', 275], ['Queso', 175], ['Jalapeños', 0]], 'Toppings'],
      ['Tortilla', 1, 1, 0, 1, [['Corn tortilla', 0, 1], ['Flour tortilla', 0]], 'Tortilla'],
    ]],
    chinese: ['Chinese', [
      ['Chinese rice', 1, 1, 0, 1, [['White rice', 0, 1], ['Brown rice', 0], ['Fried rice', 200], ['Lo mein', 250]], 'Choose rice or noodles'],
      ['Lunch combo', 1, 1, 0, 1, [['Egg roll', 0, 1], ['Spring roll', 0], ['Egg drop soup', 0], ['Wonton soup', 50], ['Hot and sour soup', 50]], 'Choose 1 side'],
      ['Chinese protein', 1, 1, 0, 1, [['Chicken', 0, 1], ['Beef', 200], ['Shrimp', 300], ['Tofu', 0], ['Vegetables', 0]], 'Choose your protein'],
    ]],
    thai: ['Thai', [
      ['Thai spice', 1, 1, 0, 1, [['Not spicy', 0], ['Mild', 0, 1], ['Medium', 0], ['Hot', 0], ['Thai hot', 0]], 'Spice level'],
      ['Thai protein', 1, 1, 0, 1, [['Chicken', 0, 1], ['Tofu', 0], ['Beef', 200], ['Shrimp', 300], ['Duck', 500]], 'Choose your protein'],
    ]],
    japanese: ['Japanese and sushi', [
      ['Roll extras', 0, 4, 0, 1, [['Add avocado', 150], ['Soy paper', 100], ['Brown rice', 100], ['Spicy mayo', 50], ['Eel sauce', 50]], 'Roll extras'],
      ['Sushi sides', 0, 4, 0, 2, [['Miso soup', 300], ['Seaweed salad', 500], ['Edamame', 450], ['Extra ginger', 0], ['Extra wasabi', 0]], 'Add sides'],
      ['Ramen add-ons', 0, 5, 0, 2, [['Soft-boiled egg', 200], ['Extra chashu', 400], ['Corn', 100], ['Extra noodles', 300], ['Nori', 100]], 'Add toppings'],
    ]],
    halal: ['Halal cart and Mediterranean', [
      ['Platter protein', 1, 1, 0, 1, [['Chicken', 0, 1], ['Lamb gyro', 100], ['Combo (chicken + lamb)', 150], ['Falafel', 0]], 'Choose your protein'],
      ['Platter base', 1, 1, 0, 1, [['Over rice', 0, 1], ['Over salad', 0], ['Half rice, half salad', 0], ['In a pita', 0]], 'Choose your base'],
      ['Sauces', 0, 3, 3, 1, [['White sauce', 0, 1], ['Hot sauce (spicy)', 0], ['Tahini', 0], ['BBQ', 0]], 'Choose sauces'],
    ]],
    italian: ['Italian and European', [
      ['Pasta shape', 1, 1, 0, 1, [['Spaghetti', 0, 1], ['Penne', 0], ['Rigatoni', 0], ['Fettuccine', 0], ['Gluten-free penne', 300]], 'Choose your pasta'],
      ['Pasta protein', 0, 2, 0, 1, [['Grilled chicken', 450], ['Shrimp', 650], ['Meatballs', 500], ['Italian sausage', 450]], 'Add protein'],
      ['Salad dressing', 1, 1, 0, 1, [['Caesar', 0, 1], ['Balsamic vinaigrette', 0], ['Lemon and olive oil', 0], ['Ranch', 0]], 'Choose dressing'],
    ]],
    american: ['American diner', [
      ['Eggs style', 1, 1, 0, 1, [['Scrambled', 0, 1], ['Over easy', 0], ['Sunny side up', 0], ['Over hard', 0], ['Egg whites', 100]], 'How do you want your eggs?'],
      ['Toast', 1, 1, 0, 1, [['White', 0, 1], ['Wheat', 0], ['Rye', 0], ['Sourdough', 0], ['English muffin', 0]], 'Choose your toast'],
      ['Wing sauce', 1, 2, 2, 1, [['Buffalo (hot)', 0, 1], ['BBQ', 0], ['Honey garlic', 0], ['Lemon pepper (dry rub)', 0]], 'Choose up to 2 sauces'],
      ['Wing dip', 1, 1, 0, 1, [['Ranch', 0, 1], ['Blue cheese', 0], ['No dip', 0]], 'Dipping sauce'],
    ]],
    steak: ['Steakhouse', [
      ['Steak temperature', 1, 1, 0, 1, [['Rare', 0], ['Medium rare', 0, 1], ['Medium', 0], ['Medium well', 0], ['Well done', 0]], 'How would you like it cooked?'],
      ['Steak sauce', 0, 2, 1, 1, [['Peppercorn', 300], ['Béarnaise', 300], ['Chimichurri', 300], ['Red wine jus', 300]], 'Sauces'],
      ['Steak add-ons', 0, 3, 0, 1, [['Grilled shrimp', 900], ['Lobster tail', 2400], ['Sautéed mushrooms', 500], ['Blue cheese crust', 400]], 'Add to your steak'],
    ]],
  });
  // Items keyed by group keys. Prices are examples only; sample items are flagged “check price”.
  Object.assign(SHOPS, {
    donut: ['Coffee and donuts', 'Hot and iced coffee, donuts by the half dozen or dozen, breakfast sandwiches', [
      ['Donuts', [['Donut', 'Pick any flavor', 179, []], ['Half dozen donuts', 'Mix and match 6 donuts', 1099, ['Pick 6 donuts']], ['Dozen donuts', 'Mix and match 12 donuts', 1899, ['Pick 12 donuts']]]],
      ['Hot coffee', [['Hot coffee', 'Freshly brewed', [['Small', 249], ['Medium', 299], ['Large', 349]], ['Milk', 'Flavor syrups', 'Sweetener']]]],
      ['Iced drinks', [['Iced coffee', 'Brewed hot, poured over ice', [['Small', 299], ['Medium', 349], ['Large', 399]], ['Milk', 'Flavor syrups', 'Sweetener', 'Ice']]]],
      ['Breakfast sandwiches', [['Egg and cheese sandwich', 'Egg and American cheese', 499, ['Sandwich bread', 'Breakfast meat', 'Hot or iced']]]],
    ]],
    ffburger: ['Fast-food burgers', 'Burgers, chicken sandwiches and nuggets with meal upgrades (side + drink)', [
      ['Burgers', [['Flame-grilled burger', 'Beef patty, lettuce, tomato, onion, pickles, mayo', 599, ['Meal size', 'Burger extras', 'Remove ingredients']], ['Double cheeseburger', 'Two patties, two cheese slices', 449, ['Meal size', 'Burger extras', 'Remove ingredients']]]],
      ['Chicken', [['Chicken nuggets', 'Crispy white-meat nuggets', [['6 pieces', 399], ['10 pieces', 599], ['20 pieces', 999]], ['Nugget sauces', 'Meal size']]]],
      ['Sides', [['Fries', 'Salted, golden and crispy', [['Small', 259], ['Medium', 359], ['Large', 429]], []]]],
      ['Drinks', [['Fountain drink', 'Your choice of soda', [['Small', 199], ['Medium', 229], ['Large', 259]], ['Choose a drink']]]],
    ]],
    chicken: ['Fried chicken', 'Buckets by piece count, recipes, white or dark meat, sides and sauces', [
      ['Buckets and meals', [['Chicken bucket', 'Bone-in fried chicken with sides and biscuits', [['8 pieces', 2699], ['12 pieces', 3599], ['16 pieces', 4499]], ['Chicken recipe', 'Chicken pieces', 'Bucket sides']], ['Chicken tenders', 'Hand-breaded tenders', [['3 pieces', 699], ['5 pieces', 999]], ['Chicken recipe', 'Dipping sauce', 'Add a drink']]]],
      ['Sandwiches', [['Fried chicken sandwich', 'Crispy fillet, pickles, mayo on a brioche bun', 649, ['Chicken recipe', 'Remove ingredients', 'Add a drink']]]],
    ]],
    indian: ['Indian', 'Curries with protein and spice level, biryani, tandoor, naan and lassi', [
      ['Curries', [['Tikka masala', 'Creamy tomato and fenugreek sauce, served with basmati rice', 1599, ['Curry protein', 'Indian spice', 'Rice choice', 'Naan']], ['Saag', 'Spinach cooked with ginger and garlic', 1499, ['Curry protein', 'Indian spice', 'Naan']]]],
      ['Biryani', [['Biryani', 'Basmati rice layered with spices, served with raita', 1699, ['Curry protein', 'Indian spice', 'Indian sides']]]],
      ['Appetizers', [['Samosa', 'Crisp pastry, spiced potatoes and peas', [['2 pieces', 599], ['4 pieces', 999]], ['Indian sides']]]],
      ['Breads', [['Garlic naan', 'Baked in the tandoor', 400, []]]],
      ['Drinks', [['Mango lassi', 'Yogurt, mango, cardamom', [['12 oz', 499], ['16 oz', 599]], []]]],
    ]],
    bangla: ['Bangladeshi', 'Kacchi biryani by half or full plate, bhuna, fish curries, paratha and borhani', [
      ['Biryani and polao', [['Kacchi biryani', 'Mutton and aromatic rice slow-cooked together, with aloo', 1399, ['Plate size', 'Bangla spice', 'Bangla add-ons']], ['Morog polao', 'Chicken with fragrant polao rice', 1299, ['Plate size', 'Bangla add-ons']]]],
      ['Curries and bhuna', [['Beef bhuna', 'Slow-cooked beef in thick spiced gravy', 1499, ['Bangla spice', 'Bangla bread', 'Bangla add-ons']], ['Fish curry (macher jhol)', 'Light curry with potato and tomato', 1599, ['Fish choice', 'Bangla spice', 'Bangla bread']]]],
      ['Breakfast', [['Paratha and egg', 'Two parathas with an omelette and dal', 899, ['Bangla spice']]]],
      ['Drinks and sweets', [['Borhani', 'Spiced yogurt drink', 399, []], ['Mishti doi', 'Sweet set yogurt', 499, []]]],
    ]],
    mexican: ['Mexican', 'Build-your-own burritos, bowls and tacos with protein, rice, beans, salsas and toppings', [
      ['Burritos and bowls', [['Burrito', 'Flour tortilla, your choice of fillings', 1199, ['Mex protein', 'Mex rice', 'Mex beans', 'Salsa', 'Mex toppings']], ['Burrito bowl', 'All the burrito fillings in a bowl', 1199, ['Mex protein', 'Mex rice', 'Mex beans', 'Salsa', 'Mex toppings']]]],
      ['Tacos', [['Tacos', 'Topped with onion and cilantro', [['3 tacos', 1099], ['5 tacos', 1699]], ['Mex protein', 'Tortilla', 'Salsa']]]],
      ['Sides', [['Chips and guacamole', 'Fresh tortilla chips, made-to-order guac', 699, []]]],
    ]],
    chinese: ['Chinese', 'Entrées with rice or noodles, protein choice, lunch specials with a side', [
      ['Entrées', [['General Tso’s', 'Crispy, sweet and spicy sauce', 1495, ['Chinese protein', 'Chinese rice', 'Spice level']], ['Lo mein', 'Stir-fried egg noodles and vegetables', 1295, ['Chinese protein']]]],
      ['Lunch specials', [['Lunch special', 'Any entrée with rice and a side, 11 AM to 3 PM', 1095, ['Chinese protein', 'Chinese rice', 'Lunch combo']]]],
      ['Appetizers', [['Dumplings', 'Pork and chive', [['6 pieces', 799], ['12 pieces', 1399]], []]]],
    ]],
    thai: ['Thai', 'Noodles and curries with spice level and protein', [
      ['Noodles', [['Pad thai', 'Rice noodles, egg, bean sprouts, peanuts', 1495, ['Thai protein', 'Thai spice']]]],
      ['Curries', [['Green curry', 'Coconut milk, Thai basil, bamboo shoots, with jasmine rice', 1595, ['Thai protein', 'Thai spice']]]],
    ]],
    japanese: ['Japanese and sushi', 'Rolls, sushi combos and ramen with extras and sides', [
      ['Rolls', [['Spicy tuna roll', 'Tuna, spicy mayo, cucumber (8 pieces)', 899, ['Roll extras', 'Sushi sides']], ['California roll', 'Crab, avocado, cucumber (8 pieces)', 799, ['Roll extras', 'Sushi sides']]]],
      ['Ramen', [['Tonkotsu ramen', 'Pork broth, chashu, scallions, egg noodles', 1695, ['Ramen add-ons', 'Spice level']]]],
    ]],
    halal: ['Halal cart and Mediterranean', 'Platters over rice or salad, gyros and falafel with white and hot sauce', [
      ['Platters', [['Chicken and rice platter', 'Spiced chicken over yellow rice with salad', [['Regular', 1099], ['Large', 1399]], ['Platter protein', 'Platter base', 'Sauces']]]],
      ['Sandwiches', [['Gyro', 'In a warm pita with lettuce and tomato', 899, ['Platter protein', 'Sauces']]]],
      ['Sides', [['Falafel (6)', 'Crispy chickpea fritters with tahini', 599, []]]],
    ]],
    italian: ['Italian and European', 'Pastas, salads and mains with shape, protein and dressing choices', [
      ['Pasta', [['Pasta pomodoro', 'San Marzano tomatoes, basil, parmesan', 1695, ['Pasta shape', 'Pasta protein']], ['Fettuccine Alfredo', 'Butter, cream and parmesan', 1795, ['Pasta protein']]]],
      ['Salads', [['Caesar salad', 'Romaine, croutons, parmesan', 1295, ['Salad dressing', 'Pasta protein']]]],
      ['Mains', [['Chicken parmesan', 'Breaded cutlet, marinara, mozzarella, with spaghetti', 2195, []]]],
    ]],
    american: ['American diner', 'Breakfast all day, burgers, wings by count, sandwiches and shakes', [
      ['Breakfast', [['Two-egg breakfast', 'Two eggs, home fries, toast, bacon or sausage', 1195, ['Eggs style', 'Toast', 'Breakfast meat']], ['Pancakes', 'Three buttermilk pancakes', [['Short stack (2)', 899], ['Full stack (3)', 1099]], []]]],
      ['Wings', [['Chicken wings', 'Crispy bone-in wings', [['6 wings', 999], ['12 wings', 1799], ['24 wings', 3299]], ['Wing sauce', 'Wing dip']]]],
      ['Burgers and sandwiches', [['Diner burger', 'Beef patty, lettuce, tomato, onion', 1399, ['Cook it', 'Cheese', 'Choose a side', 'Remove ingredients']]]],
      ['Shakes', [['Milkshake', 'Hand-spun', [['Regular', 699], ['Large', 899]], []]]],
    ]],
    steak: ['Steakhouse', 'Steaks by cut and weight, cooking temperature, sauces, add-ons and two sides', [
      ['Steaks', [['Ribeye', 'Dry-aged, char-grilled', [['12 oz', 4800], ['16 oz', 5900]], ['Steak temperature', 'Choose 2 sides', 'Steak sauce', 'Steak add-ons']], ['Filet mignon', 'Center-cut tenderloin', [['8 oz', 4900], ['10 oz', 5600]], ['Steak temperature', 'Choose 2 sides', 'Steak sauce', 'Steak add-ons']]]],
      ['Sides', [['Creamed spinach', 'For the table', 1200, []], ['Truffle fries', 'Parmesan and herbs', 1100, []]]],
    ]],
    bowls: ['Bowls and salads', 'Build-your-own bowls with base, protein, toppings and sauce', [
      ['Build your own', [['Build your own bowl', 'Pick a base, protein, toppings and sauce', 1295, ['Base', 'Protein', 'Bowl toppings', 'Sauce']]]],
    ]],
  });
  // Customer-facing name and template key for a pack group.
  const tplDef = (key) => { let def = null; Object.values(TPL_GROUPS).forEach(([, gs]) => gs.forEach((g) => { if (g[0] === key) def = g; })); return def; };
  const tplLabel = (key) => { const d = tplDef(key); return d && d[6] ? d[6] : key; };
  const tplPicker = (act) => { const pk = S.tplPack || 'coffee';
    return `<div class="m2-pick"><b class="sm-t">Ready-made groups by type of restaurant</b><select class="in" data-m="tplPack" data-rr="1" aria-label="Type of restaurant">${TPL_ORDER.map(([h, ks]) => `<optgroup label="${esc(h)}">${ks.map((k) => `<option value="${k}" ${pk === k ? 'selected' : ''}>${esc(TPL_GROUPS[k][0])}</option>`).join('')}</optgroup>`).join('')}</select>
      <div class="m2-chips wrap">${TPL_GROUPS[pk][1].map((g) => { const has = S.mods.some((m) => m.tpl === g[0]); return `<button class="chip ${has && act === 'm2TplGroup' ? 'on' : ''}" data-a="${act}" data-v="${esc(g[0])}">${has && act === 'm2TplGroup' ? '✓ ' : '+ '}${esc(g[6] || g[0])}</button>`; }).join('')}</div>
      <span class="mut sm-t">${TPL_GROUPS[pk][1].map((g) => `<b>${esc(g[6] || g[0])}</b>: ${g[5].slice(0, 4).map((c) => esc(c[0])).join(', ')}${g[5].length > 4 ? '…' : ''}`).join(' · ')}</span></div>`; };
  const minOf = (it) => (it.sizes && it.sizes.length ? Math.min(...it.sizes.map((s) => s.p)) : it.price);
  const priceText = (it, L) => (it.sizes && it.sizes.length > 1 ? `From ${money(minOf(it))}` : money(L && L !== 'all' ? priceAt(it, L) : it.price));
  const modById = (id) => (S.mods || []).find((g) => g.id === id);
  const usedBy = (gid) => allItems().filter((it) => (it.mods || []).includes(gid));
  const ruleText = (g) => { const min = +g.min || 0; const max = +g.max || 1; const free = +g.free || 0;
    return `${min > 0 ? 'Required' : 'Optional'} · ${min > 0 && min === max ? `pick ${min}` : min > 0 ? `pick ${min} to ${max}` : `pick up to ${max}`}${free ? ` · first ${free} free` : ''}${(+g.each || 1) > 1 ? ` · up to ${g.each} of each` : ''}`; };
  const choicePreview = (g) => g.choices.slice(0, 5).map((c) => esc(c.n) + (toCents(c.p) ? ` +${money(toCents(c.p))}` : '')).join(', ') + (g.choices.length > 5 ? ` and ${g.choices.length - 5} more` : '');
  const catOf = (it) => S.menu.findIndex((s) => s.items.includes(it));
  const field = (label, inner, style = '') => `<label class="f" style="min-width:0;${style}">${label}${inner}</label>`;
  const seg = (opts, cur, act, extra = '') => `<div class="m2-seg" role="group">${opts.map(([k, l]) => `<button type="button" class="${cur === k ? 'on' : ''}" aria-pressed="${cur === k}" data-a="${act}" data-v="${k}" ${extra}>${l}</button>`).join('')}</div>`;
  const tick = (path, on, label) => `<button class="chip ${on ? 'on' : ''}" data-a="m2Flip" data-p="${path}" aria-pressed="${on}">${on ? '✓ ' : ''}${label}</button>`;

  function addTplGroup(name) {
    const def = tplDef(name); if (!def) return null;
    const have = S.mods.find((g) => g.tpl === name) || S.mods.find((g) => !g.tpl && g.name.toLowerCase() === (def[6] || def[0]).toLowerCase()); if (have) return have.id;
    const id = 'g' + Date.now().toString(36) + S.mods.length;
    const g = { id, tpl: def[0], name: def[6] || def[0], min: def[1], max: def[2], free: def[3], each: def[4], choices: def[5].map((c) => ({ n: c[0], p: c[1], def: !!c[2], out: false, next: '' })) };
    S.mods.push(g);
    def[5].forEach((c, i) => { if (c[3]) g.choices[i].next = addTplGroup(c[3]) || ''; });
    return id;
  }
  function ensure2() {
    ensureMenus();
    if (S.m2) return; S.m2 = true;
    S.menu.forEach((s, i) => { if (!s.id) s.id = 'c' + (i + 1); if (s.hidden == null) s.hidden = false; });
    S.mods = []; const seen = {};
    allItems().forEach((it) => {
      it.mods = (it.groups || []).map((g) => {
        const k = JSON.stringify([g.name, +g.min, +g.max, g.choices.map((c) => [c[0], c[1]])]);
        if (!seen[k]) { const id = 'g' + (S.mods.length + 1); seen[k] = id; S.mods.push({ id, name: g.name, min: +g.min || 0, max: +g.max || 1, free: +g.free || 0, each: +g.each || 1, choices: g.choices.map((c) => ({ n: c[0], p: c[1], def: !!c[2], out: !!c[3], next: '' })) }); }
        return seen[k];
      });
      it.allergens = []; if (it.diet.includes('nuts')) it.allergens.push('treenuts'); if (it.diet.includes('dairy')) it.allergens.push('milk');
      it.spice = it.diet.includes('spicy') ? 'medium' : ''; it.diet = it.diet.filter((d) => !['nuts', 'dairy', 'spicy'].includes(d));
      it.labels = it.popular ? ['popular'] : []; it.sizes = null; it.also = []; it.notes = true; it.code = ''; it.serves = ''; it.extraPrep = '';
    });
    const sweet = addTplGroup('Sweetener'); const ice = addTplGroup('Ice');
    const igt = itemById('igt'); if (igt) { igt.mods = [sweet, ice]; igt.sizes = [{ n: '16 oz', p: 350 }, { n: '24 oz', p: 450 }]; igt.price = 350; }
    const lmd = itemById('lmd'); if (lmd) { lmd.mods = [ice]; lmd.sizes = [{ n: '16 oz', p: 450 }, { n: '24 oz', p: 575 }]; lmd.labels = ['new']; }
    Object.assign(S, { itemQ: '', itemCat: 'all', bulk: {}, modQ: '', attachPick: false, tplOpen: false, tplPack: 'coffee', tplQ: '' });
  }
  const menuTabs2 = (cur) => `<div class="m2-tabs" role="tablist">${[['menu', 'Items'], ['cats', 'Categories'], ['mods', 'Option groups'], ['menus', 'Menus and hours'], ['promos', 'Promotions']].map(([k, l]) => `<button role="tab" aria-selected="${cur === k}" class="${cur === k ? 'on' : ''}" data-a="${cur === k ? 'noop' : 'menuSwitch'}" data-to="${k}">${l}</button>`).join('')}</div>`;
  const tagRow = (it) => [...(it.labels || []).map((l) => `<span class="pill p-r m2-pill">${LABELS.find((x) => x[0] === l)[1]}</span>`), ...(it.diet || []).filter((d) => DIET2.some((x) => x[0] === d)).map((d) => `<span class="pill p-n m2-pill">${DIET2.find((x) => x[0] === d)[1]}</span>`), ...(it.spice ? [`<span class="pill p-o m2-pill">🌶 ${SPICE.find((x) => x[0] === it.spice)[1]}</span>`] : []), ...(it.sample ? ['<span class="pill p-o m2-pill">Sample · check price</span>'] : [])].join('');

  V.menu = () => {
    ensure2();
    const L = S.menuLoc || 'all'; const isAll = L === 'all'; const br = S.branches.find((b) => b.id === L); if (!isAll && !br) S.menuLoc = 'all';
    const q = S.itemQ.trim().toLowerCase(); const total = allItems().length;
    const cats = S.menu.map((s, si) => ({ s, si, items: s.items.filter((it) => !q || (it.name + ' ' + it.desc).toLowerCase().includes(q)) })).filter((c) => S.itemCat === 'all' || c.s.id === S.itemCat);
    const nSel = Object.keys(S.bulk).filter((k) => S.bulk[k]).length;
    const row = (it) => {
      const sold = isAll || soldAt(it, L); const on = isAll ? it.on : onAt(it, L);
      const nm = (it.mods || []).length; const ns = it.sizes ? it.sizes.length : 0;
      return `<div class="m2-item ${sold && on ? '' : 'off'}">
        <input type="checkbox" class="m2-check" data-a="m2Sel" data-id="${it.id}" ${S.bulk[it.id] ? 'checked' : ''} aria-label="Select ${esc(it.name)}">
        ${it.img ? `<img src="${IMG(it.img)}" alt="" class="m2-thumb">` : '<span class="m2-thumb m2-nophoto">No photo</span>'}
        <div class="m2-main"><b class="m2-name">${esc(it.name)}</b>${tagRow(it) ? `<div class="m2-tags">${tagRow(it)}</div>` : ''}
          <span class="mut sm-t">${priceText(it, L)}${ns > 1 ? ` · ${ns} sizes` : ''}${nm ? ` · ${nm} option group${nm > 1 ? 's' : ''}` : ''}${promoFor(it) ? ` · <b style="color:var(--red)">${esc(badgeText(promoFor(it)))}</b>` : ''}</span>
          <div class="m2-acts">${sold ? `<label class="row sm-t" style="gap:8px">${sw(`data-a="${isAll ? 'toggleItem' : 'toggleItemLoc'}" data-id="${it.id}"`, on, it.name + ' available')}<span>${on ? 'Available' : isAll && it.soldUntil === 'off' ? 'Sold out' : 'Sold out today'}</span></label>` : `<button class="btn ln sm" data-a="sellHere" data-id="${it.id}">Sell here</button>`}<button class="btn ln sm" data-a="editItem" data-id="${it.id}">Edit</button></div></div></div>`;
    };
    return `${head('Menu', isAll ? `All locations · ${total} items` : `${esc(br.name)} only`, PHONE ? '<button class="btn sm" data-a="newItem">+ Item</button>' : '<button class="btn ln sm" data-a="m2Import">Import menu</button><button class="btn ln sm" data-a="m2Tpl">Templates</button><button class="btn sm" data-a="newItem">+ Add item</button>')}${body(`
      ${menuTabs2('menu')}
      <div class="m2-bar"><label class="m2-search"><span class="mut" aria-hidden="true">⌕</span><input id="m2-q" data-m="itemQ" data-live="1" placeholder="Search items" value="${esc(S.itemQ)}"></label>
        <select class="in m2-locsel" data-m="menuLoc" data-rr="1" aria-label="Location">${[['all', 'All locations'], ...S.branches.map((b) => [b.id, b.name])].map(([k, l]) => `<option value="${k}" ${L === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
      <div class="m2-chips">${[['all', `All (${total})`], ...S.menu.map((s) => [s.id, `${s.s} (${s.items.length})`])].map(([k, l]) => `<button class="chip ${S.itemCat === k ? 'on' : ''}" data-a="m2Cat" data-v="${k}">${esc(l)}</button>`).join('')}</div>
      ${isAll ? '' : `<div class="note n-w sm-t">Editing <b>${esc(br.name)}</b> only: sold out and price changes here don’t affect other locations.</div>`}
      ${PHONE ? '<div class="row wrap" style="gap:8px"><button class="btn ln sm" data-a="m2Tpl">Templates</button><button class="btn ln sm" data-a="m2Import">Import menu</button></div>' : ''}
      ${total < 12 ? `<div class="card pad col m2-quick"><b>Set up your menu faster</b><span class="mut sm-t">Pick your type of restaurant. We add categories, sizes or piece counts, and option groups (spice level, protein, sides, meal upgrades, milk, toppings…) with sample items. Then change names and prices.</span><div class="m2-chips wrap">${['coffee', 'indian', 'bangla', 'mexican', 'ffburger', 'chicken', 'steak', 'pizza'].map((k) => `<button class="chip" data-a="m2TplApply" data-v="${k}">${esc(SHOPS[k][0])}</button>`).join('')}<button class="chip on" data-a="m2Tpl">All ${Object.keys(SHOPS).length} types…</button></div></div>` : ''}
      ${nSel ? `<div class="m2-bulk"><b>${nSel} selected</b><div class="row wrap" style="gap:6px"><button class="btn ln sm" data-a="m2BulkOn" data-v="off">Sold out today</button><button class="btn ln sm" data-a="m2BulkOn" data-v="on">Available</button><button class="btn ln sm" data-a="m2BulkMove">Move to…</button><button class="btn ln sm" data-a="m2BulkPrice">Change price</button><button class="btn ln sm" data-a="m2BulkDel" style="color:var(--red);border-color:var(--red)">Delete</button><button class="btn gh" data-a="m2BulkClear">Clear</button></div></div>` : ''}
      ${cats.map((c) => `<section class="col" style="gap:8px"><div class="m2-cathead"><b>${esc(c.s.s)}</b><span class="mut sm-t">${c.s.items.length} item${c.s.items.length === 1 ? '' : 's'}${c.s.hidden ? ' · hidden from customers' : ''}</span><span class="grow"></span><button class="btn gh" data-a="m2NewIn" data-v="${c.si}" style="padding:0;min-height:30px">+ Add item</button></div>
        <div class="card m2-list">${c.items.map(row).join('') || `<div class="mut sm-t" style="padding:14px">${q ? 'No matches.' : 'No items yet.'}</div>`}</div></section>`).join('')}`)}`;
  };

  function editFrom2(it) {
    const si = catOf(it); const over = {}; S.branches.forEach((b) => { const o = ovr(it, b.id); over[b.id] = { price: o.price != null ? (o.price / 100).toFixed(2) : '', on: o.on !== false }; });
    const some = !!(it.where && it.where !== 'all'); const set = {}; S.branches.forEach((b) => { set[b.id] = some ? it.where.includes(b.id) : true; });
    return { id: it.id, isNew: false, sec: String(si), orig: si, name: it.name, desc: it.desc, priceMode: it.sizes && it.sizes.length ? 'sizes' : 'one', price: (it.price / 100).toFixed(2), sizes: (it.sizes || []).map((s) => ({ n: s.n, p: (s.p / 100).toFixed(2) })), pickupPrice: it.pickupPrice != null ? (it.pickupPrice / 100).toFixed(2) : '', labels: [...(it.labels || [])], diet: [...it.diet], allergens: [...(it.allergens || [])], spice: it.spice || '', cal: it.cal, serves: it.serves || '', taxable: it.taxable !== false, state: it.on ? 'on' : it.soldUntil === 'off' ? 'off' : 'today', avail: it.avail, availDays: [...it.availDays], availFrom: it.availFrom, availTo: it.availTo, img: it.img, mods: [...(it.mods || [])], also: [...(it.also || [])], notes: it.notes !== false, code: it.code || '', extraPrep: it.extraPrep || '', over, whereSome: some, whereSet: set };
  }
  function newEdit2(si) {
    const over = {}; const set = {}; S.branches.forEach((b) => { over[b.id] = { price: '', on: true }; set[b.id] = S.menuLoc && S.menuLoc !== 'all' ? b.id === S.menuLoc : true; });
    return { isNew: true, sec: String(si != null ? si : Math.max(0, S.menu.findIndex((s) => s.id === S.itemCat))), name: '', desc: '', priceMode: 'one', price: '', sizes: [{ n: 'Small', p: '' }, { n: 'Large', p: '' }], pickupPrice: '', labels: [], diet: [], allergens: [], spice: '', cal: '', serves: '', taxable: true, state: 'on', avail: 'menu', availDays: ['1', '2', '3', '4', '5'], availFrom: '11:00', availTo: '15:00', img: '', mods: [], also: [], notes: true, code: '', extraPrep: '', over, whereSome: !!(S.menuLoc && S.menuLoc !== 'all'), whereSet: set };
  }
  function locCard2(e) {
    const sizes = e.priceMode === 'sizes';
    return `<div class="card pad col"><b class="m2-h">Locations and prices</b>
      ${[['all', 'Sell at all locations', 'Also added to any new location'], ['some', 'Only at some locations', 'Pick the locations below']].map(([k, l, x]) => `<label class="opt ${(k === 'some') === !!e.whereSome ? 'on' : ''}"><input type="radio" name="ew" data-a="editWhere" data-v="${k}" ${(k === 'some') === !!e.whereSome ? 'checked' : ''}><span class="grow"><b>${l}</b><span class="mut sm-t" style="display:block">${x}</span></span></label>`).join('')}
      ${S.branches.map((b) => { const sold = !e.whereSome || e.whereSet[b.id]; const o = e.over[b.id] || (e.over[b.id] = { price: '', on: true }); return `<div class="m2-loc ${sold ? '' : 'dim'}">
        <div class="row" style="gap:10px">${e.whereSome ? `<input type="checkbox" data-a="editWhereLoc" data-id="${b.id}" ${e.whereSet[b.id] ? 'checked' : ''} aria-label="Sell at ${esc(b.name)}" style="width:20px;height:20px;flex:none">` : ''}<b class="grow">${esc(b.name)}</b><span class="mut sm-t">Tax ${b.taxRate ? b.taxRate + '%' : 'not set'}</span></div>
        <div class="m2-grid2">${sizes ? '<span class="mut sm-t" style="align-self:center">Uses the size prices</span>' : field('Price here', `<input class="in" id="eo-${b.id}-p" data-m="edit.over.${b.id}.price" inputmode="decimal" value="${esc(o.price)}" placeholder="${esc(e.price || '0.00')}" ${sold ? '' : 'disabled'}>`)}
          <label class="row" style="gap:10px;align-self:end;min-height:48px">${sw(`data-m="edit.over.${b.id}.on" ${sold ? '' : 'disabled'}`, o.on, 'Available at ' + b.name)}<span class="sm-t">Available here</span></label></div></div>`; }).join('')}
      <span class="mut sm-t">Leave “Price here” empty to use the main price. Turning off “Available here” marks the item sold out at that location only.</span></div>`;
  }
  V.editItem = () => {
    ensure2();
    const e = S.edit; const sizes = e.priceMode === 'sizes';
    const unset = S.branches.filter((b) => !b.taxRate);
    const rates = S.branches.map((b) => `${esc(b.name)} ${b.taxRate ? b.taxRate + '%' : '<b style="color:var(--red)">not set</b>'}`).join(' · ');
    const attached = e.mods.map(modById).filter(Boolean);
    const free = S.mods.filter((g) => !e.mods.includes(g.id));
    return `${head(e.isNew ? 'Add item' : 'Edit item', esc((S.menu[+e.sec] || S.menu[0]).s))}${body(narrow(`
      <div class="card pad col"><b class="m2-h">Item</b>
        <div class="m2-photo">${e.img ? `<img src="${IMG(e.img)}" alt="">` : '<span class="m2-nophoto">No photo</span>'}<div class="col" style="gap:6px;min-width:0"><span class="mut sm-t">A real photo of the item. JPG or PNG, at least 1200 × 800. Items with photos get more orders.</span><div class="row wrap" style="gap:8px"><label class="btn ln sm" style="cursor:pointer;position:relative">${e.img ? 'Change photo' : 'Upload photo'}<input type="file" accept="image/*" data-photo="edit" style="position:absolute;width:1px;height:1px;opacity:0"></label>${e.img ? '<button class="btn gh" data-a="removePhoto" style="color:var(--red);padding:0 4px">Remove</button>' : ''}</div></div></div>
        ${field('Name', `<input class="in" id="e-name" data-m="edit.name" value="${esc(e.name)}" maxlength="60" placeholder="e.g. Iced caramel latte">`)}
        ${field('Description', `<textarea class="in" id="e-desc" data-m="edit.desc" maxlength="300" placeholder="Main ingredients, how it’s made, portion size">${esc(e.desc)}</textarea>`)}</div>

      <div class="card pad col"><b class="m2-h">Price</b>
        ${seg([['one', 'One price'], ['sizes', 'Price by size']], e.priceMode, 'm2PriceMode')}
        ${sizes ? `<span class="mut sm-t">For drinks and dishes sold in sizes (12 oz / 16 oz, small / large, 12" / 16"). The first size is selected for customers by default.</span>
          ${e.sizes.map((s, i) => `<div class="m2-size">${field(i ? '' : 'Size name', `<input class="in" id="sz-${i}-n" data-m="edit.sizes.${i}.n" value="${esc(s.n)}" placeholder="e.g. Medium (16 oz)">`)}${field(i ? '' : 'Price', `<input class="in" id="sz-${i}-p" data-m="edit.sizes.${i}.p" inputmode="decimal" value="${esc(s.p)}" placeholder="0.00">`)}<div class="m2-mini">${i ? `<button class="btn gh" data-a="m2SizeMove" data-i="${i}" aria-label="Move up">↑</button>` : '<span class="m2-gap"></span>'}<button class="btn gh" data-a="m2SizeDel" data-i="${i}" aria-label="Remove size" style="color:var(--red)">✕</button></div></div>`).join('')}
          <button class="btn gh" data-a="m2SizeAdd" style="align-self:flex-start;padding:0">+ Add size</button>`
        : `<div class="m2-grid2">${field('Price (USD)', `<input class="in" id="e-price" data-m="edit.price" inputmode="decimal" value="${esc(e.price)}" placeholder="0.00">`)}${field('Pickup price (optional)', `<input class="in" id="e-pprice" data-m="edit.pickupPrice" inputmode="decimal" value="${esc(e.pickupPrice)}" placeholder="Same">`)}</div>`}</div>

      <div class="card pad col"><b class="m2-h">Category</b>
        ${field('Main category', `<select class="in" id="e-sec" data-m="edit.sec" data-rr="1">${S.menu.map((s, i) => `<option value="${i}" ${i === +e.sec ? 'selected' : ''}>${esc(s.s)}</option>`).join('')}</select>`)}
        ${S.menu.length > 1 ? `<b class="sm-t">Also show in</b><div class="m2-chips wrap">${S.menu.map((s, i) => (i === +e.sec ? '' : tick('also.' + s.id, e.also.includes(s.id), esc(s.s)))).join('')}</div><span class="mut sm-t">Like Uber Eats and DoorDash, one item can appear in several categories (for example “Popular” and “Iced drinks”). Edit it once; it changes everywhere.</span>` : ''}
        <button class="btn gh" data-a="addSection" style="align-self:flex-start;padding:0">+ New category</button></div>

      <div class="card pad col"><div class="m2-cardhead"><b class="m2-h">Option groups</b><span class="mut sm-t">${attached.length} added</span></div>
        <span class="mut sm-t">Choices customers make: milk, shots, syrups, toppings, sides, sauces. Groups are shared, so “Milk” can be added to every coffee and edited in one place.</span>
        ${attached.map((g, i) => `<div class="m2-group"><div class="m2-cardhead"><b>${esc(g.name)}</b><span class="pill ${+g.min > 0 ? 'p-r' : 'p-n'} m2-pill">${ruleText(g)}</span></div><span class="mut sm-t">${choicePreview(g)}</span>
          <div class="m2-gacts"><button class="btn ln sm" data-a="m2GroupEdit" data-id="${g.id}">Edit group</button><span class="grow"></span>${i ? `<button class="btn gh m2-iconbtn" data-a="m2ModMove" data-i="${i}" aria-label="Move ${esc(g.name)} up">↑</button>` : ''}<button class="btn gh" data-a="m2ModDel" data-i="${i}">Remove</button></div></div>`).join('') || '<div class="mut sm-t">No option groups. Customers order the item as is.</div>'}
        <div class="row wrap" style="gap:8px"><button class="btn ln sm" data-a="m2Attach">${S.attachPick ? 'Close' : '+ Add a group'}</button><button class="btn ln sm" data-a="m2GroupNew" data-attach="1">+ Create new group</button></div>
        <div class="col" style="gap:4px"><span class="mut sm-t">Quick add (works for any cuisine)</span><div class="m2-chips wrap">${['Meal size', 'Choose a side', 'Choose 2 sides', 'Add a drink', 'Add a dessert', 'Remove ingredients', 'Spice level'].map((k) => `<button class="chip" data-a="m2AttachTpl" data-v="${k}">+ ${esc(tplLabel(k))}</button>`).join('')}</div></div>
        ${S.attachPick ? `<div class="m2-pick"><b class="sm-t">Your groups</b><div class="m2-chips wrap">${free.map((g) => `<button class="chip" data-a="m2AttachDo" data-id="${g.id}">${esc(g.name)} · ${g.choices.length}</button>`).join('') || '<span class="mut sm-t">All your groups are already on this item.</span>'}</div>
          ${tplPicker('m2AttachTpl')}</div>` : ''}</div>

      <div class="card pad col"><b class="m2-h">Labels, dietary and allergens</b>
        <b class="sm-t">Labels</b><div class="m2-chips wrap">${LABELS.map(([k, l]) => tick('labels.' + k, e.labels.includes(k), l)).join('')}</div>
        <b class="sm-t">Dietary</b><div class="m2-chips wrap">${DIET2.map(([k, l]) => tick('diet.' + k, e.diet.includes(k), l)).join('')}</div>
        <b class="sm-t">Spice level</b>${seg(SPICE, e.spice, 'm2Spice')}
        <b class="sm-t">Contains (allergens)</b><div class="m2-chips wrap">${ALLERGENS.map(([k, l]) => tick('allergens.' + k, e.allergens.includes(k), l)).join('')}</div>
        <div class="m2-grid2">${field('Calories (optional)', `<input class="in" id="e-cal" data-m="edit.cal" inputmode="numeric" value="${esc(e.cal)}" placeholder="e.g. 220">`)}${field('Serves (optional)', `<input class="in" id="e-serves" data-m="edit.serves" inputmode="numeric" value="${esc(e.serves)}" placeholder="e.g. 2">`)}</div>
        <span class="mut sm-t">Only tick what you can stand behind. Allergens show on the item so customers with allergies can check before ordering.</span></div>

      <div class="card pad col"><b class="m2-h">Availability</b>
        ${[['on', 'Available'], ['today', 'Sold out today', 'Back on automatically when you open tomorrow'], ['off', 'Sold out until I turn it back on']].map(([k, l, x]) => `<label class="opt ${e.state === k ? 'on' : ''}"><input type="radio" name="est" data-a="editState" data-v="${k}" ${e.state === k ? 'checked' : ''}><span class="grow"><b>${l}</b>${x ? `<span class="mut sm-t" style="display:block">${x}</span>` : ''}</span></label>`).join('')}
        <b class="sm-t">When it can be ordered</b>${seg([['menu', 'Whenever its menu is open'], ['custom', 'Certain days and times']], e.avail, 'editAvail')}
        ${e.avail === 'custom' ? `${dayChips('edit.availDays', e.availDays)}<div class="m2-grid2">${field('From', `<input class="in" type="time" id="e-af" data-m="edit.availFrom" value="${esc(e.availFrom)}">`)}${field('To', `<input class="in" type="time" id="e-at" data-m="edit.availTo" value="${esc(e.availTo)}">`)}</div>` : ''}</div>

      <div class="card pad col"><b class="m2-h">Sales tax</b>
        ${[[true, 'Taxable', `Charged at each location’s rate: ${rates}`], [false, 'Not taxable', 'No sales tax is charged on this item']].map(([k, l, x]) => `<label class="opt ${e.taxable === k ? 'on' : ''}"><input type="radio" name="etx" data-a="editTax" data-v="${k}" ${e.taxable === k ? 'checked' : ''}><span class="grow"><b>${l}</b><span class="mut sm-t" style="display:block">${x}</span></span></label>`).join('')}
        ${unset.length ? `<div class="note n-w sm-t">${unset.map((b) => esc(b.name)).join(', ')} ${unset.length > 1 ? 'have' : 'has'} no sales tax rate yet, so no tax would be charged there. <button class="btn gh" data-a="m2TaxGo" data-id="${unset[0].id}" style="min-height:0;padding:0;font-size:13px">Set the rate</button></div>` : ''}
        <span class="mut sm-t">You decide and you file. Restaurant food and drinks in NY are normally taxable; ask your accountant before marking anything not taxable.</span></div>

      ${locCard2(e)}

      <div class="card pad col"><b class="m2-h">More settings</b>
        <label class="row" style="gap:10px">${sw('data-m="edit.notes"', e.notes, 'Allow special instructions')}<span>Customers can add special instructions</span></label>
        <div class="m2-grid2">${field('Extra prep (minutes)', `<input class="in" id="e-prep" data-m="edit.extraPrep" inputmode="numeric" value="${esc(e.extraPrep)}" placeholder="0">`)}${field('POS code (optional)', `<input class="in" id="e-code" data-m="edit.code" value="${esc(e.code)}" placeholder="e.g. LAT-16">`)}</div></div>

      <div class="note n-g sm-t">You set your own prices; Send Koro takes $0 commission. Want to run a deal on this item? Use <button class="btn gh" data-a="menuSwitch" data-to="promos" style="min-height:0;padding:0;font-size:13px">Promotions</button>.</div>
      <div class="m2-save"><button class="btn ln" data-a="m2Preview">Preview</button><button class="btn grow" data-a="saveItem">Save item</button>${e.isNew ? '' : '<button class="btn ln" data-a="delItem" style="color:var(--red);border-color:var(--red)">Delete</button>'}</div>`))}`;
  };

  V.mods = () => {
    ensure2();
    const q = S.modQ.trim().toLowerCase(); const list = S.mods.filter((g) => !q || (g.name + ' ' + g.choices.map((c) => c.n).join(' ')).toLowerCase().includes(q));
    return `${head('Option groups', 'Also called modifiers · build once, use on many items', `<button class="btn sm" data-a="m2GroupNew">+ New group</button>`)}${body(`
      ${menuTabs2('mods')}
      <label class="m2-search"><span class="mut" aria-hidden="true">⌕</span><input id="m2-mq" data-m="modQ" data-live="1" placeholder="Search groups or choices" value="${esc(S.modQ)}"></label>
      ${list.map((g) => { const u = usedBy(g.id); return `<div class="card pad col" style="gap:6px"><div class="m2-cardhead"><b style="font-size:17px">${esc(g.name)}</b><span class="pill ${+g.min > 0 ? 'p-r' : 'p-n'} m2-pill">${ruleText(g)}</span></div>
        <span class="sm-t">${choicePreview(g)}</span>
        <span class="mut sm-t">${u.length ? `Used in ${u.length} item${u.length > 1 ? 's' : ''}: ${u.slice(0, 4).map((it) => esc(it.name)).join(', ')}${u.length > 4 ? '…' : ''}` : 'Not used on any item yet'}${g.choices.some((c) => c.next) ? ' · has follow-up questions' : ''}${g.choices.some((c) => c.out) ? ' · some choices out of stock' : ''}</span>
        <div class="row wrap" style="gap:6px"><button class="btn ln sm" data-a="m2GroupEdit" data-id="${g.id}">Edit</button><button class="btn gh" data-a="m2GroupDup" data-id="${g.id}">Duplicate</button></div></div>`; }).join('') || '<div class="card empty">No groups match.</div>'}
      <div class="card pad col"><b style="font-size:17px">Ready-made groups</b><span class="mut sm-t">Pick your type of restaurant and add groups with typical choices and prices, then edit them.</span>${tplPicker('m2TplGroup')}</div>`)}`;
  };

  function groupDraft(g, attach) {
    const items = {}; allItems().forEach((it) => { items[it.id] = g ? (it.mods || []).includes(g.id) : false; });
    if (attach && S.edit && S.edit.id) items[S.edit.id] = true;
    return { id: g ? g.id : '', name: g ? g.name : '', req: g && +g.min > 0 ? 'req' : 'opt', min: String(g ? Math.max(1, +g.min || 1) : 1), max: String(g ? g.max : 1), free: String(g ? g.free || 0 : 0), each: String(g ? g.each || 1 : 1), repeat: !!(g && +g.each > 1), choices: g ? g.choices.map((c) => ({ n: c.n, p: (toCents(c.p) / 100).toFixed(2), def: !!c.def, out: !!c.out, next: c.next || '' })) : [{ n: '', p: '0.00', def: false, out: false, next: '' }, { n: '', p: '0.00', def: false, out: false, next: '' }], items, attach: !!attach };
  }
  V.editGroup = () => {
    ensure2();
    const d = S.gdraft; const req = d.req === 'req';
    const others = S.mods.filter((g) => g.id !== d.id);
    const sum = ruleText({ min: req ? d.min : 0, max: d.max, free: d.free, each: d.repeat ? d.each : 1 });
    return `${head(d.id ? 'Edit option group' : 'New option group', d.id ? `Used in ${usedBy(d.id).length} items` : 'Choices customers pick')}${body(narrow(`
      <div class="card pad col"><b class="m2-h">Group</b>
        ${field('Name customers see', `<input class="in" id="gd-name" data-m="gdraft.name" value="${esc(d.name)}" placeholder="e.g. Choose your milk" maxlength="50">`)}
        <b class="sm-t">Do customers have to choose?</b>${seg([['req', 'Required'], ['opt', 'Optional']], d.req, 'm2Req')}
        <div class="m2-grid2">${req ? field('Pick at least', `<input class="in" id="gd-min" data-m="gdraft.min" data-live="1" inputmode="numeric" value="${esc(d.min)}">`) : ''}${field('Pick up to', `<input class="in" id="gd-max" data-m="gdraft.max" data-live="1" inputmode="numeric" value="${esc(d.max)}">`)}${field('Free choices', `<input class="in" id="gd-free" data-m="gdraft.free" data-live="1" inputmode="numeric" value="${esc(d.free)}">`)}</div>
        <label class="row" style="gap:10px">${sw('data-m="gdraft.repeat" data-rr="1"', d.repeat, 'Same choice more than once')}<span>Customers can pick the same choice more than once (e.g. 3 extra shots)</span></label>
        ${d.repeat ? `<div class="m2-grid2">${field('Most of each choice', `<input class="in" id="gd-each" data-m="gdraft.each" data-live="1" inputmode="numeric" value="${esc(d.each)}">`)}</div>` : ''}
        <div class="note n-g sm-t"><b>Customers see:</b> ${esc(d.name || 'Group name')} · ${sum}. ${+d.free > 0 ? `The ${d.free} cheapest picks are free; extra picks cost their price.` : ''}</div></div>

      <div class="card pad col"><div class="m2-cardhead"><b class="m2-h">Choices</b><span class="mut sm-t">${d.choices.length}</span></div>
        ${d.choices.map((c, ci) => `<div class="m2-choice">
          <div class="row" style="gap:8px">${field(ci ? '' : 'Choice', `<input class="in" id="ch-${ci}-n" data-m="gdraft.choices.${ci}.n" value="${esc(c.n)}" placeholder="e.g. Oat milk">`, 'flex:1')}<div class="m2-mini" style="align-self:flex-end;margin-bottom:4px">${ci ? `<button class="btn gh" data-a="m2ChMove" data-i="${ci}" aria-label="Move up">↑</button>` : '<span class="m2-gap"></span>'}<button class="btn gh" data-a="m2ChDel" data-i="${ci}" aria-label="Remove choice" style="color:var(--red)">✕</button></div></div>
          <div class="m2-grid3">${field('Extra price', `<input class="in" id="ch-${ci}-p" data-m="gdraft.choices.${ci}.p" inputmode="decimal" value="${esc(c.p)}" placeholder="0.00">`)}
            <label class="m2-flag"><input type="checkbox" data-a="m2ChDef" data-i="${ci}" ${c.def ? 'checked' : ''}><span>Pre-selected</span></label>
            <label class="m2-flag">${sw(`data-a="m2ChOut" data-i="${ci}"`, !c.out, 'In stock')}<span>${c.out ? 'Out of stock' : 'In stock'}</span></label></div>
          ${others.length ? field('Then ask (optional)', `<select class="in" data-m="gdraft.choices.${ci}.next" data-rr="1"><option value="">Nothing else</option>${others.map((g) => `<option value="${g.id}" ${c.next === g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select>`) : ''}
        </div>`).join('')}
        <button class="btn gh" data-a="m2ChAdd" style="align-self:flex-start;padding:0">+ Add choice</button>
        <span class="mut sm-t">“Then ask” opens another group when this choice is picked, like DoorDash nested options (e.g. “Make it a meal” → choose a drink).</span></div>

      <div class="card pad col"><b class="m2-h">Use on these items</b><span class="mut sm-t">Changes to this group apply to every item it’s on.</span>
        ${S.menu.map((s) => s.items.length ? `<div class="col" style="gap:4px"><span class="mut sm-t">${esc(s.s)}</span><div class="m2-chips wrap">${s.items.map((it) => `<button class="chip ${d.items[it.id] ? 'on' : ''}" data-a="m2GdItem" data-id="${it.id}" aria-pressed="${!!d.items[it.id]}">${d.items[it.id] ? '✓ ' : ''}${esc(it.name)}</button>`).join('')}</div></div>` : '').join('')}</div>

      <div class="m2-save"><button class="btn grow" data-a="m2GroupSave">Save group</button>${d.id ? '<button class="btn ln" data-a="m2GroupDel" style="color:var(--red);border-color:var(--red)">Delete</button>' : ''}<button class="btn gh" data-a="back">Cancel</button></div>`))}`;
  };

  V.cats = () => {
    ensure2();
    return `${head('Categories', 'How your menu is grouped for customers', '<button class="btn sm" data-a="addSection">+ Category</button>')}${body(`
      ${menuTabs2('cats')}
      <div class="note n-g sm-t">Customers see categories in this order. Put your best sellers first. An item can be in more than one category.</div>
      ${S.menu.map((s, si) => `<div class="card pad col">
        <div class="m2-grid2">${field('Name', `<input class="in" id="cn-${si}" data-m="menu.${si}.s" value="${esc(s.s)}">`)}${field('Description (optional)', `<input class="in" id="cd-${si}" data-m="menu.${si}.desc" value="${esc(s.desc)}" placeholder="e.g. All drinks come in 16 or 24 oz">`)}</div>
        <b class="sm-t">Shows in menus</b><div class="m2-chips wrap">${S.menus.map((m) => `<button class="chip ${s.menus.includes(m.id) ? 'on' : ''}" data-a="secMenu" data-s="${si}" data-m="${m.id}" aria-pressed="${s.menus.includes(m.id)}">${esc(m.name)}</button>`).join('')}</div>
        <div class="row wrap" style="gap:10px"><label class="row" style="gap:10px">${sw(`data-a="m2CatHide" data-i="${si}"`, !s.hidden, 'Show to customers')}<span class="sm-t">${s.hidden ? 'Hidden' : 'Shown to customers'}</span></label><span class="grow"></span><span class="mut sm-t">${s.items.length} items</span>
          <button class="btn gh m2-iconbtn" data-a="secMove" data-i="${si}" data-d="-1" ${si ? '' : 'disabled'} aria-label="Move up">↑</button><button class="btn gh m2-iconbtn" data-a="secMove" data-i="${si}" data-d="1" ${si < S.menu.length - 1 ? '' : 'disabled'} aria-label="Move down">↓</button><button class="btn gh" data-a="m2CatDel" data-i="${si}" style="color:var(--red)">Delete</button></div></div>`).join('')}
      <button class="btn" data-a="m2CatSave" style="align-self:flex-start">Save categories</button>`)}`;
  };

  // ----- customer preview of the item being edited -----
  function pvGroups() { const e = S.edit; const out = []; const add = (gid, depth) => { const g = gid === '__draft' ? null : modById(gid); if (!g) return; out.push([g, depth]); const p = S.pv.picks[g.id] || {}; g.choices.forEach((c, ci) => { if (p[ci] && c.next) add(c.next, depth + 1); }); }; e.mods.forEach((id) => add(id, 0)); return out; }
  function pvTotal() {
    const e = S.edit; const sizes = e.priceMode === 'sizes'; let base = sizes ? toCents((e.sizes[S.pv.size] || e.sizes[0] || { p: 0 }).p) : toCents(e.price);
    let extra = 0; let missing = '';
    pvGroups().forEach(([g]) => { const p = S.pv.picks[g.id] || {}; const picks = []; g.choices.forEach((c, ci) => { for (let k = 0; k < (p[ci] || 0); k++) picks.push(toCents(c.p)); }); picks.sort((a, b) => a - b); extra += picks.slice(+g.free || 0).reduce((a, b) => a + b, 0); if (picks.length < (+g.min || 0) && !missing) missing = g.name; });
    return { total: base + extra, missing };
  }
  M2MODAL.preview = () => {
    const e = S.edit; const sizes = e.priceMode === 'sizes'; const t = pvTotal();
    return `<div class="m2-pv">${e.img ? `<img src="${IMG(e.img)}" alt="" class="m2-pvimg">` : ''}<div class="row between"><h2 style="font-size:22px;margin:0">${esc(e.name || 'Item name')}</h2><button class="btn gh" data-a="closeModal" aria-label="Close preview">✕</button></div>
      <span class="mut sm-t">${esc(e.desc || '')}</span><span class="sm-t">${tagRow({ labels: e.labels, diet: e.diet, spice: e.spice })}</span>
      ${e.allergens.length ? `<span class="mut sm-t">Contains: ${e.allergens.map((a) => ALLERGENS.find((x) => x[0] === a)[1]).join(', ')}</span>` : ''}
      ${sizes ? `<div class="m2-pvg"><div class="row between"><b>Size</b><span class="pill p-r m2-pill">Required</span></div>${e.sizes.map((s, i) => `<label class="m2-pvc"><input type="radio" name="pvs" data-a="m2PvSize" data-i="${i}" ${S.pv.size === i ? 'checked' : ''}><span class="grow">${esc(s.n || 'Size')}</span><span>${money(toCents(s.p))}</span></label>`).join('')}</div>` : ''}
      ${pvGroups().map(([g, depth]) => { const p = S.pv.picks[g.id] || {}; const n = Object.values(p).reduce((a, b) => a + b, 0); const single = +g.max === 1 && (+g.each || 1) === 1;
        return `<div class="m2-pvg" style="${depth ? 'margin-left:14px;border-left:3px solid var(--red);padding-left:10px' : ''}"><div class="row between"><b>${esc(g.name)}</b><span class="pill ${+g.min > 0 ? 'p-r' : 'p-n'} m2-pill">${+g.min > 0 ? 'Required' : 'Optional'}</span></div><span class="mut sm-t">${ruleText(g).replace(/^(Required|Optional) · /, '')}</span>
        ${g.choices.map((c, ci) => { const cnt = p[ci] || 0; const pr = toCents(c.p); const dis = c.out || (!cnt && !single && n >= +g.max);
          return (+g.each || 1) > 1 ? `<div class="m2-pvc ${c.out ? 'dim' : ''}"><span class="grow">${esc(c.n)}${c.out ? ' · sold out' : ''}</span><span class="mut">${pr ? '+' + money(pr) : ''}</span><button class="btn gh" data-a="m2PvStep" data-g="${g.id}" data-i="${ci}" data-d="-1" ${cnt ? '' : 'disabled'} aria-label="Less">−</button><b>${cnt}</b><button class="btn gh" data-a="m2PvStep" data-g="${g.id}" data-i="${ci}" data-d="1" ${dis || cnt >= +g.each ? 'disabled' : ''} aria-label="More">+</button></div>`
          : `<label class="m2-pvc ${c.out ? 'dim' : ''}"><input type="${single ? 'radio' : 'checkbox'}" name="pv-${g.id}" data-a="m2PvPick" data-g="${g.id}" data-i="${ci}" ${cnt ? 'checked' : ''} ${dis ? 'disabled' : ''}><span class="grow">${esc(c.n)}${c.out ? ' · sold out' : ''}${c.next ? ' <span class="mut sm-t">› more choices</span>' : ''}</span><span class="mut">${pr ? '+' + money(pr) : ''}</span></label>`; }).join('')}</div>`; }).join('')}
      ${e.notes ? '<label class="f">Special instructions<textarea class="in" placeholder="e.g. No onions" rows="2"></textarea></label>' : ''}
      <button class="btn" data-a="closeModal" ${t.missing ? 'disabled' : ''}>${t.missing ? `Choose ${esc(t.missing)}` : `Add to cart · ${money(t.total)}`}</button>
      <span class="mut sm-t" style="text-align:center">Preview only. This is how the item opens in the customer app.</span></div>`;
  };
  M2MODAL.m2tpl = () => { const q = String(S.tplQ || '').trim().toLowerCase();
    return `<h2 style="font-size:22px">Start from a template</h2><span class="mut sm-t">Pick your type of restaurant. We add categories, sample items (with sizes or piece counts) and option groups. Nothing is removed; change names and prices after.</span>
    <label class="m2-search"><span class="mut" aria-hidden="true">⌕</span><input id="tpl-q" data-m="tplQ" data-live="1" placeholder="Search: Indian, tacos, donuts, steak…" value="${esc(S.tplQ || '')}"></label>
    ${TPL_ORDER.filter(([, ks]) => ks.some((k) => SHOPS[k])).map(([h, ks]) => { const list = ks.filter((k) => SHOPS[k] && (!q || (SHOPS[k][0] + ' ' + SHOPS[k][1]).toLowerCase().includes(q))); return list.length ? `<b class="sm-t" style="margin-top:4px">${esc(h)}</b>${list.map((k) => `<button class="card pad col" data-a="m2TplApply" data-v="${k}" style="text-align:left;gap:4px;cursor:pointer"><b>${esc(SHOPS[k][0])}</b><span class="mut sm-t">${esc(SHOPS[k][1])}</span></button>`).join('')}` : ''; }).join('') || '<span class="mut sm-t">No match. Try another word, or start from “Any restaurant” groups on the Option groups tab.</span>'}
    <button class="btn gh" data-a="closeModal">Cancel</button>`; };
  M2MODAL.m2import = () => `<h2 style="font-size:22px">Import your menu</h2>
    <div class="card pad col"><b>Send us your menu</b><span class="mut sm-t">Photos or a PDF of your printed or website menu. Our team builds it for free within 48 hours, and you check everything before it goes live.</span><label class="btn ln sm" style="align-self:flex-start;cursor:pointer;position:relative">Upload photos or PDF<input type="file" accept="image/*,.pdf" data-photo="import" style="position:absolute;width:1px;height:1px;opacity:0"></label></div>
    <div class="card pad col"><b>Upload a spreadsheet</b><span class="mut sm-t">CSV with columns: category, item, description, price, size, option group, choice, choice price. Items are added as drafts for you to review.</span><label class="btn ln sm" style="align-self:flex-start;cursor:pointer;position:relative">Upload CSV<input type="file" accept=".csv,text/csv" data-photo="import" style="position:absolute;width:1px;height:1px;opacity:0"></label></div>
    <div class="card pad col"><b>Moving from Uber Eats, DoorDash or Grubhub?</b><span class="mut sm-t">Send us your menu export or a link to your store page and we’ll copy items, sizes, options and photos you own.</span></div>
    <button class="btn gh" data-a="closeModal">Close</button>`;
  M2MODAL.m2move = () => `<h2 style="font-size:22px">Move to a category</h2>${S.menu.map((s, i) => `<button class="opt" data-a="m2BulkMoveDo" data-i="${i}" style="text-align:left"><b>${esc(s.s)}</b></button>`).join('')}<button class="btn gh" data-a="closeModal">Cancel</button>`;
  M2MODAL.m2price = (md) => `<h2 style="font-size:22px">Change prices</h2><span class="mut sm-t">For ${Object.keys(S.bulk).filter((k) => S.bulk[k]).length} selected items, including every size.</span>
    ${seg([['up', 'Increase'], ['down', 'Decrease']], md.dir, 'm2PriceDir')}${seg([['pct', 'By percent'], ['amt', 'By amount']], md.mode, 'm2PriceBy')}
    ${field(md.mode === 'pct' ? 'Percent' : 'Amount ($)', `<input class="in" id="bp-v" data-m="modal.v" inputmode="decimal" value="${esc(md.v)}">`)}
    <span class="mut sm-t">Prices are rounded to the nearest cent.</span><button class="btn" data-a="m2BulkPriceDo">Apply</button><button class="btn gh" data-a="closeModal">Cancel</button>`;
  M2MODAL.m2del = () => `<h2 style="font-size:22px">Delete ${Object.keys(S.bulk).filter((k) => S.bulk[k]).length} items?</h2><span class="mut">This removes them from every location. Past orders keep their details.</span><button class="btn" data-a="m2BulkDelDo" style="background:var(--red)">Delete items</button><button class="btn gh" data-a="closeModal">Cancel</button>`;
  M2MODAL.m2gdel = () => { const u = usedBy(S.gdraft.id); return `<h2 style="font-size:22px">Delete “${esc(S.gdraft.name)}”?</h2><span class="mut">${u.length ? `It’s removed from ${u.length} item${u.length > 1 ? 's' : ''}: ${u.map((it) => esc(it.name)).join(', ')}.` : 'It isn’t used on any item.'}</span><button class="btn" data-a="m2GroupDelDo" style="background:var(--red)">Delete group</button><button class="btn gh" data-a="closeModal">Cancel</button>`; };

  const selIds = () => Object.keys(S.bulk).filter((k) => S.bulk[k]);
  Object.assign(A, {
    m2Cat: (d) => { S.itemCat = d.v; render(); },
    m2Sel: (d) => { S.bulk[d.id] = !S.bulk[d.id]; render(); },
    m2BulkClear: () => { S.bulk = {}; render(); },
    m2BulkOn: (d) => { selIds().forEach((id) => { const it = itemById(id); it.on = d.v === 'on'; it.soldUntil = it.on ? null : 'today'; }); toast(`${selIds().length} items ${d.v === 'on' ? 'are available' : 'are sold out today'}.`); S.bulk = {}; render(); },
    m2BulkMove: () => { S.modal = { type: 'm2move' }; render(); },
    m2BulkMoveDo: (d) => { const to = S.menu[+d.i]; const ids = selIds(); ids.forEach((id) => { const it = itemById(id); const from = S.menu[catOf(it)]; from.items.splice(from.items.indexOf(it), 1); to.items.push(it); }); S.modal = null; S.bulk = {}; toast(`Moved ${ids.length} items to ${to.s}.`); render(); },
    m2BulkPrice: () => { S.modal = { type: 'm2price', dir: 'up', mode: 'pct', v: '5' }; render(); },
    m2PriceDir: (d) => { S.modal.dir = d.v; render(); }, m2PriceBy: (d) => { S.modal.mode = d.v; render(); },
    m2BulkPriceDo: () => { const md = S.modal; const v = parseFloat(md.v); if (!(v > 0)) return toast('Enter a number above 0.'); const sign = md.dir === 'up' ? 1 : -1;
      const f = (c) => Math.max(1, md.mode === 'pct' ? Math.round(c * (1 + (sign * v) / 100)) : c + sign * Math.round(v * 100));
      const ids = selIds(); for (const id of ids) { const it = itemById(id); if (f(it.price) < 1) return toast('That would make a price zero.'); }
      ids.forEach((id) => { const it = itemById(id); it.price = f(it.price); if (it.sizes) it.sizes.forEach((s) => { s.p = f(s.p); }); it.sample = false; });
      S.modal = null; S.bulk = {}; toast(`Updated prices on ${ids.length} items.`); render(); },
    m2BulkDel: () => { S.modal = { type: 'm2del' }; render(); },
    m2BulkDelDo: () => { const ids = selIds(); ids.forEach((id) => { const it = itemById(id); const s = S.menu[catOf(it)]; s.items.splice(s.items.indexOf(it), 1); }); S.modal = null; S.bulk = {}; toast(`Deleted ${ids.length} items.`); render(); },
    m2Tpl: () => { S.tplQ = ''; S.modal = { type: 'm2tpl' }; render(); },
    m2Import: () => { S.modal = { type: 'm2import' }; render(); },
    m2TplApply: (d) => {
      const [label, , cats] = SHOPS[d.v]; let n = 0;
      cats.forEach(([cname, items]) => {
        let cat = S.menu.find((s) => s.s.toLowerCase() === cname.toLowerCase());
        if (!cat) { cat = { id: 'c' + Date.now().toString(36) + S.menu.length, s: cname, desc: '', menus: [S.menus[0].id], hidden: false, items: [] }; S.menu.push(cat); }
        items.forEach(([name, desc, price, groups]) => {
          if (allItems().some((it) => it.name === name)) return;
          const sizes = Array.isArray(price) ? price.map(([sn, sp]) => ({ n: sn, p: sp })) : null;
          const it = { id: 'i' + Date.now().toString(36) + n, name, desc, price: sizes ? sizes[0].p : price, img: '', on: true, groups: [], diet: [], allergens: [], spice: '', labels: [], sizes, also: [], notes: true, code: '', serves: '', extraPrep: '', cal: '', pickupPrice: null, taxable: true, popular: false, soldUntil: null, avail: 'menu', availDays: ['1', '2', '3', '4', '5'], availFrom: '11:00', availTo: '15:00', where: 'all', over: {}, sample: true, mods: groups.map(addTplGroup).filter(Boolean) };
          cat.items.push(it); n++;
        });
      });
      S.modal = null; S.itemCat = 'all'; toast(`${label} template added: ${n} sample items. Check names and prices.`); render();
    },
    m2NewIn: (d) => go('editItem', { edit: newEdit2(+d.v), attachPick: false }),
    newItem: () => go('editItem', { edit: newEdit2(), attachPick: false }),
    editItem: (d) => { const it = d.id ? itemById(d.id) : S.menu[S.menuTab].items[+d.i]; go('editItem', { edit: editFrom2(it), attachPick: false }); },
    toggleItem: (d) => { const it = itemById(d.id); if (!it.on) { it.on = true; it.soldUntil = null; toast(`${it.name} is available again at all locations.`); render(); return; } S.modal = { type: 'soldOut', id: d.id, v: 'today' }; render(); },
    soldOutDo: () => { const it = S.modal.id ? itemById(S.modal.id) : S.menu[S.menuTab].items[S.modal.i]; it.on = false; it.soldUntil = S.modal.v; S.modal = null; toast(it.soldUntil === 'today' ? `${it.name} is sold out today. It comes back when you open tomorrow.` : `${it.name} is sold out until you turn it back on.`); render(); },
    toggleItemLoc: (d) => { const it = itemById(d.id); const L = S.menuLoc; const b = S.branches.find((x) => x.id === L); if (!it.on) { toast(`${it.name} is off at all locations. Turn it on in “All locations” first.`); render(); return; } it.over = it.over || {}; const o = it.over[L] = { ...(it.over[L] || {}) }; o.on = o.on === false; toast(`${it.name} is now ${o.on ? 'available' : 'sold out'} at ${b.name} only.`); render(); },
    sellHere: (d) => { const it = itemById(d.id); const L = S.menuLoc; if (Array.isArray(it.where) && !it.where.includes(L)) it.where.push(L); toast(`${it.name} is now sold at ${S.branches.find((x) => x.id === L).name}.`); render(); },
    m2Flip: (d) => { const [k, v] = d.p.split('.'); const arr = S.edit[k]; const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); render(); },
    m2Spice: (d) => { S.edit.spice = d.v; render(); },
    m2PriceMode: (d) => { const e = S.edit; e.priceMode = d.v; if (d.v === 'sizes' && !e.sizes.some((s) => String(s.p).trim())) { e.sizes = [{ n: 'Small', p: e.price || '' }, { n: 'Large', p: '' }]; } render(); },
    m2SizeAdd: () => { S.edit.sizes.push({ n: '', p: '' }); render(); },
    m2SizeDel: (d) => { if (S.edit.sizes.length <= 1) return toast('Keep at least one size, or switch to “One price”.'); S.edit.sizes.splice(+d.i, 1); render(); },
    m2SizeMove: (d) => { const a = S.edit.sizes; const i = +d.i; [a[i - 1], a[i]] = [a[i], a[i - 1]]; render(); },
    m2Attach: () => { S.attachPick = !S.attachPick; render(); },
    m2AttachDo: (d) => { S.edit.mods.push(d.id); toast(`Added “${modById(d.id).name}”.`); render(); },
    m2AttachTpl: (d) => { const id = addTplGroup(d.v); if (!S.edit.mods.includes(id)) S.edit.mods.push(id); toast(`Added “${tplLabel(d.v)}”. Edit it to change choices or prices.`); render(); },
    m2ModDel: (d) => { S.edit.mods.splice(+d.i, 1); render(); },
    m2ModMove: (d) => { const a = S.edit.mods; const i = +d.i; [a[i - 1], a[i]] = [a[i], a[i - 1]]; render(); },
    m2TaxGo: (d) => { S.branchId = d.id; S.stack.push(S.screen); S.screen = 'tax'; render(true); },
    m2Preview: () => { S.pv = { size: 0, picks: {} }; S.edit.mods.forEach((gid) => { const g = modById(gid); if (!g) return; const p = {}; g.choices.forEach((c, ci) => { if (c.def && !c.out) p[ci] = 1; }); S.pv.picks[gid] = p; }); S.modal = { type: 'preview' }; render(); },
    m2PvSize: (d) => { S.pv.size = +d.i; render(); },
    m2PvPick: (d) => { const g = modById(d.g); const p = S.pv.picks[d.g] || (S.pv.picks[d.g] = {}); const i = +d.i; if (+g.max === 1) { const was = p[i]; Object.keys(p).forEach((k) => delete p[k]); if (!was || +g.min > 0) p[i] = 1; } else if (p[i]) delete p[i]; else p[i] = 1; render(); },
    m2PvStep: (d) => { const g = modById(d.g); const p = S.pv.picks[d.g] || (S.pv.picks[d.g] = {}); const i = +d.i; const n = Object.values(p).reduce((a, b) => a + b, 0); if (+d.d > 0 && n >= +g.max) return; p[i] = Math.max(0, (p[i] || 0) + +d.d); if (!p[i]) delete p[i]; render(); },
    m2GroupNew: (d) => go('editGroup', { gdraft: groupDraft(null, d && d.attach) }),
    m2GroupEdit: (d) => go('editGroup', { gdraft: groupDraft(modById(d.id)) }),
    m2GroupDup: (d) => { const g = modById(d.id); const c = JSON.parse(JSON.stringify(g)); c.id = 'g' + Date.now().toString(36); c.name = g.name + ' (copy)'; S.mods.push(c); toast(`Duplicated “${g.name}”.`); render(); },
    m2TplGroup: (d) => { if (S.mods.some((m) => m.tpl === d.v)) return toast(`You already have “${tplLabel(d.v)}”.`); addTplGroup(d.v); toast(`Added “${tplLabel(d.v)}”. Open it to add it to items.`); render(); },
    m2Req: (d) => { S.gdraft.req = d.v; if (d.v === 'req' && !(+S.gdraft.min >= 1)) S.gdraft.min = '1'; render(); },
    m2ChAdd: () => { S.gdraft.choices.push({ n: '', p: '0.00', def: false, out: false, next: '' }); render(); },
    m2ChDel: (d) => { if (S.gdraft.choices.length <= 1) return toast('A group needs at least one choice.'); S.gdraft.choices.splice(+d.i, 1); render(); },
    m2ChMove: (d) => { const a = S.gdraft.choices; const i = +d.i; [a[i - 1], a[i]] = [a[i], a[i - 1]]; render(); },
    m2ChDef: (d) => { const c = S.gdraft.choices[+d.i]; c.def = !c.def; render(); },
    m2ChOut: (d) => { const c = S.gdraft.choices[+d.i]; c.out = !c.out; render(); },
    m2GdItem: (d) => { S.gdraft.items[d.id] = !S.gdraft.items[d.id]; render(); },
    m2GroupSave: () => {
      const d = S.gdraft; const name = String(d.name).trim(); if (name.length < 2) return toast('Name the group, like “Choose your milk”.');
      const choices = d.choices.filter((c) => String(c.n).trim()).map((c) => ({ n: String(c.n).trim(), p: toCents(c.p), def: !!c.def, out: !!c.out, next: c.next || '' }));
      if (!choices.length) return toast('Add at least one choice.');
      if (choices.some((c) => c.p < 0)) return toast('Extra prices can’t be negative.');
      const min = d.req === 'req' ? parseInt(d.min, 10) || 0 : 0; const max = parseInt(d.max, 10) || 0; const free = parseInt(d.free, 10) || 0; const each = d.repeat ? parseInt(d.each, 10) || 1 : 1;
      if (d.req === 'req' && min < 1) return toast('Required groups need “Pick at least” of 1 or more.');
      if (max < 1) return toast('“Pick up to” must be at least 1.');
      if (min > max) return toast('“Pick at least” can’t be more than “Pick up to”.');
      if (min > choices.filter((c) => !c.out).length * each) return toast(`Not enough choices in stock to pick ${min}.`);
      if (free > max) return toast('Free choices can’t be more than “Pick up to”.');
      if (choices.filter((c) => c.def).length > max) return toast(`Too many pre-selected choices for “Pick up to ${max}”.`);
      if (d.id && choices.some((c) => c.next === d.id)) return toast('A choice can’t open its own group.');
      let g = d.id ? modById(d.id) : null;
      if (g) Object.assign(g, { name, min, max, free, each, choices }); else { g = { id: 'g' + Date.now().toString(36), name, min, max, free, each, choices }; S.mods.push(g); }
      allItems().forEach((it) => { it.mods = it.mods || []; const has = it.mods.includes(g.id); if (d.items[it.id] && !has) it.mods.push(g.id); if (!d.items[it.id] && has) it.mods = it.mods.filter((x) => x !== g.id); });
      if (S.edit && S.stack[S.stack.length - 1] === 'editItem') { const inDraft = S.edit.mods.includes(g.id); if ((d.items[S.edit.id] || (d.attach && S.edit.isNew)) && !inDraft) S.edit.mods.push(g.id); if (S.edit.id && !d.items[S.edit.id] && inDraft) S.edit.mods = S.edit.mods.filter((x) => x !== g.id); }
      const n = usedBy(g.id).length; toast(`Saved “${name}”${n ? ` · on ${n} item${n > 1 ? 's' : ''}` : ''}.`); back();
    },
    m2GroupDel: () => { S.modal = { type: 'm2gdel' }; render(); },
    m2GroupDelDo: () => { const id = S.gdraft.id; S.mods = S.mods.filter((g) => g.id !== id); allItems().forEach((it) => { it.mods = (it.mods || []).filter((x) => x !== id); }); S.mods.forEach((g) => g.choices.forEach((c) => { if (c.next === id) c.next = ''; })); if (S.edit) S.edit.mods = S.edit.mods.filter((x) => x !== id); S.modal = null; toast('Group deleted.'); back(); },
    m2CatHide: (d) => { const s = S.menu[+d.i]; s.hidden = !s.hidden; toast(`${s.s} is ${s.hidden ? 'hidden from' : 'shown to'} customers.`); render(); },
    m2CatDel: (d) => { const s = S.menu[+d.i]; if (S.menu.length === 1) return toast('Keep at least one category.'); if (s.items.length) return toast(`Move or delete the ${s.items.length} items in “${s.s}” first.`); S.menu.splice(+d.i, 1); S.itemCat = 'all'; toast(`Deleted “${s.s}”.`); render(); },
    m2CatSave: () => { for (const s of S.menu) { if (String(s.s).trim().length < 2) return toast('Every category needs a name.'); if (!s.menus.length) return toast(`“${s.s}” isn’t in any menu, so customers can’t see it.`); } toast('Categories saved.'); render(); },
    sectionDo: () => { const n = S.modal.name.trim(); if (n.length < 2) return toast('Name the category.'); S.menu.push({ id: 'c' + Date.now().toString(36), s: n, desc: '', hidden: false, menus: [(S.menus || [{ id: 'm1' }])[0].id], items: [] }); S.modal = null; if (S.edit && S.screen === 'editItem') S.edit.sec = String(S.menu.length - 1); toast(`Added category “${n}”.`); render(); },
    saveItem: () => {
      const e = S.edit; const sizesOn = e.priceMode === 'sizes';
      if (String(e.name).trim().length < 2) return toast('Give the item a name.');
      let sizes = null; let cents;
      if (sizesOn) { sizes = e.sizes.filter((s) => String(s.n).trim() || String(s.p).trim()).map((s) => ({ n: String(s.n).trim(), p: Math.round(parseFloat(s.p) * 100) }));
        if (sizes.length < 2) return toast('Add at least 2 sizes, or switch to “One price”.');
        if (sizes.some((s) => !s.n)) return toast('Name every size.'); if (sizes.some((s) => !(s.p > 0))) return toast('Enter a price for every size, like 4.75.');
        if (new Set(sizes.map((s) => s.n.toLowerCase())).size !== sizes.length) return toast('Two sizes have the same name.');
        cents = sizes[0].p;
      } else { cents = Math.round(parseFloat(e.price) * 100); if (!(cents > 0)) return toast('Enter a price, like 12.50.'); }
      const pp = sizesOn ? '' : String(e.pickupPrice || '').trim(); const ppc = pp ? Math.round(parseFloat(pp) * 100) : null;
      if (pp && !(ppc > 0)) return toast('Check the pickup price, or leave it empty.');
      if (String(e.cal).trim() && !/^\d{1,4}(\s*-\s*\d{1,4})?$/.test(String(e.cal).trim())) return toast('Calories: a number like 220, or a range like 180-260.');
      if (String(e.serves).trim() && !/^\d{1,2}$/.test(String(e.serves).trim())) return toast('Serves: a number like 2.');
      if (String(e.extraPrep).trim() && !/^\d{1,3}$/.test(String(e.extraPrep).trim())) return toast('Extra prep time: minutes, like 5.');
      if (e.avail === 'custom') { if (!e.availDays.length) return toast('Pick at least one day the item is offered.'); if (!timeOK(e.availFrom) || !timeOK(e.availTo) || e.availFrom >= e.availTo) return toast('Check the item’s from and to times.'); }
      const where = e.whereSome ? S.branches.filter((b) => e.whereSet[b.id]).map((b) => b.id) : 'all';
      if (e.whereSome && !where.length) return toast('Pick at least one location, or choose “Sell at all locations”.');
      const over = {};
      for (const b of S.branches) { const o = e.over[b.id] || {}; const p = sizesOn ? '' : String(o.price || '').trim(); const pc = p ? Math.round(parseFloat(p) * 100) : null; if (p && !(pc > 0)) return toast(`Check the price for ${b.name}.`); over[b.id] = { price: pc != null && pc !== cents ? pc : null, on: o.on !== false }; }
      const on = e.state === 'on'; const sec = +e.sec;
      const item = { id: e.id || 'i' + Date.now().toString(36), name: String(e.name).trim(), desc: String(e.desc).trim(), price: cents, sizes, pickupPrice: ppc != null && ppc !== cents ? ppc : null, labels: [...e.labels], popular: e.labels.includes('popular'), diet: [...e.diet], allergens: [...e.allergens], spice: e.spice, cal: String(e.cal).trim(), serves: String(e.serves).trim(), taxable: e.taxable !== false, on, soldUntil: on ? null : e.state, avail: e.avail, availDays: [...e.availDays], availFrom: e.availFrom, availTo: e.availTo, img: e.img, groups: [], mods: [...e.mods], also: e.also.filter((id) => id !== (S.menu[sec] || {}).id), notes: !!e.notes, code: String(e.code).trim(), extraPrep: String(e.extraPrep).trim(), where, over, sample: false };
      if (e.isNew) S.menu[sec].items.push(item);
      else { const old = itemById(e.id); const from = S.menu[catOf(old)]; const at = from.items.indexOf(old); from.items.splice(at, 1); if (from === S.menu[sec]) S.menu[sec].items.splice(at, 0, item); else S.menu[sec].items.push(item); }
      const ng = item.mods.length; toast(`Saved “${item.name}” · ${sizes ? `${sizes.length} sizes from ${money(Math.min(...sizes.map((s) => s.p)))}` : money(cents)}${ng ? ` · ${ng} option group${ng > 1 ? 's' : ''}` : ''}.`); back();
    },
    delItem: () => { const it = itemById(S.edit.id); const s = S.menu[catOf(it)]; s.items.splice(s.items.indexOf(it), 1); toast(`Deleted “${it.name}”.`); back(); },
  });

  // ================= Learning center (public on the welcome page, also inside the portal) =================
  // Each lesson = a short animated video (scenes + captions + optional voice) and an article.
  const LTRACKS = [['start', 'Get started'], ['menu', 'Menu and prices'], ['orders', 'Orders and delivery'], ['money', 'Money']];
  const T = (h, sub, cap) => ({ k: 'title', h, sub, cap });
  const ST = (h, items, cap) => ({ k: 'steps', h, items, cap });
  const MO = (h, rows, cap, note) => ({ k: 'money', h, rows, cap, note });
  const FL = (h, nodes, cap) => ({ k: 'flow', h, nodes, cap });
  const PH = (h, sub, title, ui, cap, btn) => ({ k: 'phone', h, sub, title, ui, cap, btn });
  const ul = (a) => `<ul>${a.map((x) => `<li>${x}</li>`).join('')}</ul>`;
  const ol = (a) => `<ol>${a.map((x) => `<li>${x}</li>`).join('')}</ol>`;
  const tbl = (rows) => `<div class="lc-tbl">${rows.map((r) => `<div class="${r[2] ? 'tot' : ''}"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}</div>`;
  const LESSONS = [
    { id: 'start', t: 'start', title: 'How to get started', sum: 'From sign-up to your first order in about a day.', go: 'setup', scenes: [
      T('Welcome to Send Koro', '$0 commission · a flat monthly plan · first month free', 'Welcome to Send Koro. You keep your food sales, pay no commission, and your first month is free.'),
      ST('Create your account', ['Your name, mobile and email', 'Verify the 6-digit text code', 'Restaurant name, address, cuisines', 'Accept the partner agreement'], 'Create your account in four short steps. You sign in with a text code, so there are no passwords.'),
      ST('Finish store setup', ['Business details and licenses', 'Sales tax rate', 'Menu (at least 5 items)', 'Opening hours', 'Delivery fee rule', 'Connect Stripe for payouts'], 'Then finish the store setup checklist. Each item has a short guide in this learning center.'),
      FL('Go live', [['Setup done', 'All green'], ['We review', 'Usually within 1 business day'], ['You’re live', 'Orders start coming in']], 'When every item is green, we review your permit and turn your store on. Then the orders start coming in.'),
    ], body: [
      ['What you need', ul(['A mobile phone for sign-in codes and order alerts.', 'Your food service permit for each location (in NYC, the Health Department permit).', 'Your federal EIN and your New York sales tax ID (Certificate of Authority).', 'A bank account and the owner’s ID, which Stripe checks when you connect payouts.', 'Your menu with prices. Photos help but can be added later.'])],
      ['Steps', ol(['Tap <b>Create account</b>, enter your name, mobile and email, and verify the 6-digit code.', 'Add your restaurant name, address and up to 3 cuisines, then accept the partner agreement.', 'Open <b>Store setup</b> and complete each item: business details, licenses, sales tax, menu, hours, delivery fee rule and payouts (Stripe).', 'When every item is green, Send Koro reviews your food permit and turns your store live.'])],
      ['Good to know', ul(['Your first month is free. After that each location pays a flat plan based on its last month’s food sales.', 'Send Koro takes <b>$0 commission</b>. You pay only card processing on your part of each order and any delivery help you choose to give.', 'Owners, managers and staff each sign in with their own phone. Add them under <b>Team</b>.'])],
    ] },
    { id: 'licenses', t: 'start', title: 'Licenses you need', sum: 'Only the minimum we need to list you, and what Stripe checks.', go: 'legal', scenes: [
      T('Licenses and legal', 'Only the minimum we need to list you', 'Here is the short list of documents Send Koro asks for before your store goes live.'),
      ST('What we ask for', ['Business details: legal name, DBA, entity, EIN, owner', 'Food permit for each location (number, expiry, photo or PDF)', 'Sales tax ID for each location (number only)', 'Your confirmations: other state licenses, food safety, agreement'], 'Business details once, then a food permit and a sales tax ID for each location, plus a few confirmations.'),
      FL('Who checks what', [['Send Koro', 'Food permit for each location'], ['Stripe', 'Owner’s ID and bank account'], ['You', 'Keep everything current']], 'Send Koro checks the food permit. Stripe checks the owner’s identity and bank. You keep everything up to date.'),
    ], body: [
      ['What Send Koro asks for', ol(['<b>Business details</b> (whole business): legal name, doing-business-as name, entity type, federal EIN and the owner or authorized person.', '<b>Food permit for each location</b>: permit number, expiry date and a photo or PDF. In New York City this is the Health Department (DOHMH) Food Service Establishment permit. This is the one document we review.', '<b>Sales tax ID for each location</b>: in New York, the Certificate of Authority number from the Department of Taxation and Finance. Just the number.', '<b>Your confirmations</b>: other licenses your state requires (for example a food protection certificate holder on site), food safety, and the partner agreement.'])],
      ['Good to know', ul(['There is no VAT in the US. The closest thing is your sales tax ID.', 'Stripe asks for the owner’s ID and bank details when you connect payouts. Send Koro never sees your full bank number.', 'When a permit is close to expiring, we remind you to upload the new one. An expired permit pauses that location.', 'Open <b>Licenses and legal</b> to see the exact list for each location’s city or state.'])],
    ] },
    { id: 'setup', t: 'start', title: 'Store setup', sum: 'Profile, photos, hours, prep time, team and alerts.', go: 'profile', scenes: [
      PH('Your store profile', 'What customers see first', 'Store profile', [['Name', 'Brooklyn Bowl Co.'], ['Cuisines', 'Bowls · Salads · Halal', 1], ['Cover photo', 'Uploaded'], ['About', 'Fresh grain bowls…']], 'Start with your store profile: name, cover photo, up to three cuisines and a short description.'),
      PH('Hours and prep time', 'When you take orders', 'Hours', [['Mon–Thu', '11:00 AM – 10:00 PM'], ['Fri–Sat', '11:00 AM – 11:30 PM'], ['Closures', 'Thanksgiving', 1], ['Prep time', '20 min']], 'Set your weekly hours, add holiday closures, and choose your usual prep time.'),
      ST('Team and alerts', ['Owner: everything, including money', 'Manager: orders, menu, hours', 'Staff: live orders only', 'Turn on order sounds, texts and emails'], 'Invite your team with the right role, and turn on order alerts so you never miss an order.'),
    ], body: [
      ['Steps', ol(['<b>Store profile</b>: name, cover photo (wide, real food), up to 3 cuisines (the first is your main one), a short description, and extra charges if you use them (service charge or packaging fee, always shown to customers before they pay).', '<b>Hours</b>: weekly hours for each location, plus closures for holidays. Customers can’t order while you’re closed.', '<b>Prep time</b>: your usual time to get an order ready. You can change it for each order when you accept.', '<b>Team</b>: invite people by phone. Owners see everything, managers run orders, menu and hours, staff see live orders.', '<b>Notifications</b>: order sounds that repeat until you answer, plus texts and emails.'])],
      ['Good to know', ul(['Delivery areas are set by Send Koro for each neighborhood, so there’s nothing to draw. You control Open/Close, hours, prep time and “Accepting orders”.', 'Busy? Use <b>Close store</b> or slow down prep time instead of letting orders time out.'])],
    ] },
    { id: 'branches', t: 'start', title: 'Locations (branches)', sum: 'Run several locations with their own hours, prices, tax and plan.', go: 'locations', scenes: [
      FL('One account, many locations', [['Park Slope', 'Live'], ['Williamsburg', 'Setting up'], ['+ Add location', '']], 'One account can run many locations. Each one is set up and goes live on its own.'),
      ST('What each location has', ['Its own address, phone and hours', 'Its own sales tax rate and permit', 'Its own prices and sold-out items (optional)', 'Its own monthly plan, from its own sales', 'Its own Stripe account (optional)'], 'Each location has its own hours, tax rate, permit and plan, and can have its own prices and its own Stripe account.'),
    ], body: [
      ['Steps', ol(['Open <b>Locations</b> and tap <b>Add location</b>.', 'Enter the address, phone and cuisines. The sales tax rate is suggested from the address.', 'Finish that location’s checklist in <b>Store setup</b>: permit, sales tax ID, hours, delivery fee rule and payouts.', 'Choose whether its money goes to your main Stripe account or the location’s own Stripe account.'])],
      ['Good to know', ul(['A new location’s first month is free, and a location that isn’t live yet isn’t billed.', 'All locations are billed on one invoice, with one line each.', 'On the Menu page, pick a location to change prices or mark items sold out at just that location.'])],
    ] },
    { id: 'tax', t: 'start', title: 'Sales tax setup', sum: 'You set the rate, collect it with each order, and file it.', go: 'tax', scenes: [
      T('Sales tax', 'You set it · you collect it · you file it', 'Sales tax is your responsibility. Send Koro never collects, files or pays it for you.'),
      MO('How it’s charged', [['Food after your discounts', '$30.00'], ['Sales tax 8.875%', '$2.66'], ['Goes to you with the food', '$32.66', 1]], 'Tax is charged on the food after your discounts, and it reaches your Stripe account with the food payment.', 'New York City rate: 8.875%'),
      ST('Set it up', ['Accept “I’m responsible for sales tax”', 'Check the suggested rate for each location', 'Mark items not taxable only if your accountant agrees'], 'Accept responsibility, confirm the rate for each location, and mark items not taxable only if your accountant agrees.'),
    ], body: [
      ['How it works', ul(['Each location has its own rate. We suggest one from the address (NYC: 8.875%); you confirm it.', 'Tax is charged on the food price after your own discounts, and on service charges (in NY a service charge is taxable).', 'The tax goes to your Stripe account together with the food money. You report and pay it to the state.', 'Send Koro never collects, files or pays sales tax.'])],
      ['Example', tbl([['Food after discounts', '$30.00'], ['Sales tax 8.875%', '$2.66'], ['You receive with the food', '$32.66', 1]])],
      ['Good to know', ul(['A location with no rate charges no tax. The item editor warns you when a location has no rate.', 'A mandatory gratuity is untaxed only if it’s listed separately, labelled “gratuity”, and paid 100% to staff.', 'Your monthly statements in the Stripe tab help you file.'])],
    ] },
    { id: 'stripe', t: 'start', title: 'Connect Stripe', sum: 'Where your money goes, and how to set it up in minutes.', go: 'stripe', scenes: [
      FL('Your money, your account', [['Customer pays', 'Card, Apple Pay, Google Pay'], ['Your Stripe account', 'Food + tax'], ['Your bank', 'On your payout schedule']], 'Payments go straight to your own Stripe account, then to your bank. Send Koro never holds your food money.'),
      ST('Connect in minutes', ['Open Stripe (Store setup → Payouts)', 'Enter business and owner details', 'Add your bank account', 'Done: Stripe shows “Active”'], 'Open the Stripe setup, enter your business and owner details, add your bank, and you’re done.'),
      PH('The Stripe tab', 'Balance, payouts, statements', 'Stripe', [['Balance', '$1,284.20'], ['Next payout', 'Tomorrow', 1], ['Bank', '•••• 6789'], ['Statements', '1099-K']], 'Afterwards, the Stripe tab shows your balance, payouts, payments, statements and tax forms.'),
    ], body: [
      ['Steps', ol(['Open <b>Store setup → Payouts</b> (or the <b>Stripe</b> tab) and tap <b>Connect Stripe</b>.', 'Stripe’s secure page asks for your business details, the owner’s ID and your bank account.', 'Come back to Send Koro. When Stripe says <b>Active</b>, you can take orders.', 'Optional: give a location its own Stripe account instead of the main one.'])],
      ['Good to know', ul(['You get the full Stripe Dashboard. Stripe asks you to sign in to Stripe for sensitive changes like your bank.', 'Refunds are done from the Send Koro order screen, not in Stripe, so the delivery part is refunded correctly.', 'You can answer card disputes on your own payments in Stripe.', 'Only the owner can open the Stripe tab.'])],
    ] },
    { id: 'menusetup', t: 'menu', title: 'Set up your menu', sum: 'Templates, categories, items, sizes and photos.', go: 'menu', scenes: [
      ST('Start fast', ['Pick a template for your type of restaurant', 'Or import: photos, PDF or a CSV', 'Or add items one by one'], 'Start from a template for your type of restaurant, import your menu, or add items one by one.'),
      FL('How a menu is built', [['Menu', 'All day · Lunch'], ['Category', 'Curries'], ['Item', 'Tikka masala'], ['Option groups', 'Protein · Spice · Naan']], 'Every menu is built the same way: menus with hours, categories, items, and option groups for choices.'),
      PH('Add an item', 'Name, price, photo, choices', 'Add item', [['Name', 'Tikka masala'], ['Price', '$15.99'], ['Category', 'Curries'], ['Option groups', 'Protein · Spice level', 1]], 'For each item add a name, description, photo and price, then attach option groups like protein and spice level.'),
    ], body: [
      ['Steps', ol(['Open <b>Menu → Templates</b> and pick your type of restaurant (coffee shop, Indian, Bangladeshi, Mexican, burgers, fried chicken, steakhouse and more). Sample items are marked “check price”.', 'Or tap <b>Import menu</b> to send photos, a PDF or a CSV. Our team builds it free within 48 hours and you approve it.', 'Add or edit items: photo (wide, at least 1200 × 800), name, description, price or <b>price by size</b>, category, labels, dietary tags, spice level and allergens.', 'Add <b>option groups</b>: required or optional, how many to pick, free choices, extra prices, and follow-up questions (for example “Make it a meal” → choose a drink).', 'Use <b>Preview</b> to see the item exactly as customers will.'])],
      ['Good to know', ul(['Option groups are shared: build “Milk” or “Spice level” once and add it to many items.', 'An item can appear in more than one category.', 'Menus and hours let you run breakfast, lunch specials or late-night menus.'])],
    ] },
    { id: 'menuedit', t: 'menu', title: 'Edit your menu', sum: 'Sold out, per-location changes, bulk edits and option groups.', go: 'menu', scenes: [
      PH('Sold out in one tap', 'Today only, or until you turn it back on', 'Menu', [['Grilled Chicken Bowl', 'Available'], ['Salmon Bowl', 'Sold out today', 1], ['Mint Lemonade', 'Available']], 'Mark an item sold out for today, or until you turn it back on. It comes back automatically when you open tomorrow.'),
      ST('Change many at once', ['Select items', 'Sold out · Available', 'Move to a category', 'Raise or lower prices by % or $'], 'Select several items to mark them sold out, move them, or change prices by a percent or an amount.'),
      ST('Per location', ['Pick a location on the Menu page', 'Set a different price there', 'Mark sold out only there', 'Choose which items it sells'], 'Pick a location to change prices or availability there only. Your other locations stay the same.'),
    ], body: [
      ['Steps', ol(['<b>Sold out</b>: use the switch on the item. Choose “today” (back automatically tomorrow) or “until I turn it back on”.', '<b>Bulk edit</b>: tick items, then Sold out, Available, Move to…, Change price or Delete.', '<b>One location only</b>: choose the location at the top of the Menu page, then change price or availability.', '<b>Option groups</b>: edit a group once on the Option groups tab and every item using it updates. Mark a single choice out of stock (for example oat milk).', '<b>Categories</b>: rename, reorder, hide or choose which menus they appear in.'])],
      ['Good to know', ul(['Changes show to customers right away.', 'Deleting an item doesn’t change past orders.', 'Running a deal? Use Promotions instead of lowering the price.'])],
    ] },
    { id: 'pricing', t: 'menu', title: 'Food pricing', sum: 'Set your own prices with no commission to cover.', go: 'menu', scenes: [
      T('Your prices, your call', 'Send Koro takes $0 commission', 'You set your own prices. Because Send Koro takes no commission, you don’t need to mark prices up to cover one.'),
      ST('Price tools', ['One price or price by size', 'Extra prices on choices', 'Optional pickup price', 'Different price at a location'], 'Use one price or sizes, extra prices on choices, an optional pickup price, and different prices at a location.'),
      MO('What you keep on a $15 item', [['Item price', '$15.00'], ['Commission', '$0.00'], ['Card processing on your part', 'about 2.9% + share of 30¢'], ['You keep', 'the rest', 1]], 'On every item you keep your full price, minus only card processing on your part of the order.'),
    ], body: [
      ['How pricing works', ul(['<b>One price</b> or <b>price by size</b> (for example 12 oz $4.75, 16 oz $5.25). Customers see “From $4.75”.', '<b>Choice prices</b> are added to the item: oat milk +$0.75, steak +$2.50. Free choices make the cheapest picks free.', '<b>Pickup price</b> is optional, if you want pickup to cost less.', '<b>Per-location price</b> for a location with different costs.', '<b>Promotions</b> (BOGO, % off, spend $X save $Y, free delivery) are paid by you and cost nothing to run.'])],
      ['Good to know', ul(['Prices are what customers pay before tax. Tax is added at checkout at each location’s rate.', 'Send Koro adds no service fee, small-order fee or surge fee to your customers.'])],
    ] },
    { id: 'delivery', t: 'orders', title: 'Delivery fee: who pays and how', sum: 'Choose your rule: customer pays, you pay all, split, or free above an amount.', go: 'delivery', scenes: [
      T('The delivery fee', 'Covers the courier, nothing else', 'The delivery fee only covers the courier. Send Koro adds no service fee, no small-order fee and no surge fee.'),
      ST('Choose your rule', ['Customer pays the full fee', 'You pay all (free delivery)', 'Split: you cover $ or %', 'Free above an order amount'], 'Choose who pays: the customer, you, a split, or free delivery above an order amount.'),
      MO('Example: you pay $3', [['Delivery fee', '$8.48'], ['Brooklyn Bowl Co. pays part', '−$3.00'], ['Customer pays for delivery', '$5.48', 1]], 'For example, if you pay three dollars of an eight forty-eight fee, the customer pays five forty-eight.'),
      FL('Where your share comes from', [['Order paid', '$43.54 card charge'], ['Your share', 'Kept from your payment'], ['Courier', 'Paid in full + 100% tip']], 'Your share is kept from that order’s payment. The courier always gets full pay and the whole tip.'),
    ], body: [
      ['Your options', ol(['<b>Customer pays</b> the full delivery fee.', '<b>You pay all</b> (free delivery for customers).', '<b>Split</b>: you cover a fixed amount (for example $3) or a percent of the fee.', '<b>Free above an amount</b> (for example orders over $30), with optional help below it.'])],
      ['Extra controls', ul(['A per-order cap: you never pay more than a set amount on one order.', 'A monthly budget: once it’s used up, customers pay the full fee.'])],
      ['Example', tbl([['Food', '$30.00'], ['Delivery fee', '$8.48'], ['Your share (split $3)', '−$3.00'], ['Customer pays for delivery', '$5.48'], ['Tax 8.875%', '$2.66'], ['Tip (100% to courier)', '$5.40'], ['Customer card total', '$43.54', 1]])],
      ['Good to know', ul(['Customers see one line, “Delivery fee”, and then your discount (“Brooklyn Bowl Co. pays part”).', 'Delivery areas are set by Send Koro for each neighborhood.', 'Change your rule anytime on the <b>Delivery fee</b> page. Each change applies to new orders.'])],
    ] },
    { id: 'ordersmgmt', t: 'orders', title: 'Managing orders', sum: 'The live orders board, alerts, and busy-time controls.', go: 'orders', scenes: [
      PH('Live orders', 'New · Preparing · Ready', 'Live orders', [['SK1052 · New', '4:38 left', 1], ['SK1051 · Preparing', 'Ready in 12 min'], ['SK1050 · Ready', 'Courier arriving']], 'The live orders board shows new orders, orders you’re preparing, and orders ready for pickup.'),
      ST('Never miss an order', ['A sound repeats every 10 seconds', 'Phone notifications and tab alerts', 'Keep the screen awake on a tablet'], 'New orders ring every ten seconds until someone answers, with phone notifications too.'),
      ST('Busy?', ['Raise prep time for new orders', 'Pause: stop accepting orders', 'Close early for the day'], 'If you get busy, raise prep time, pause new orders, or close early, instead of letting orders time out.'),
    ], body: [
      ['The board', ul(['<b>New</b>: waiting for you to accept. Each has a 5-minute timer.', '<b>Preparing</b>: accepted, with the time it should be ready.', '<b>Ready</b>: waiting for the courier or the pickup customer.', '<b>Order history</b>: search past orders by number or customer.'])],
      ['Alerts', ul(['Order sounds repeat every 10 seconds until you answer.', 'Install the PWA on a tablet or phone and keep it plugged in; the screen stays awake on the live board.', 'Text and email alerts are in <b>Notifications</b>.'])],
    ] },
    { id: 'accept', t: 'orders', title: 'Accepting an order', sum: 'Accept within 5 minutes; the card is charged only when you accept.', go: 'newOrder', scenes: [
      PH('A new order', 'Check items and notes', 'New order', [['2× Grilled Chicken Bowl', '$30.00'], ['Note', 'No onions', 1], ['Prep time', '20 min'], ['Time to answer', '4:52']], 'When an order arrives, check the items and notes, and set the prep time.', 'Accept order'),
      FL('Accept or decline', [['Accept', 'Card is charged'], ['Decline', 'Customer pays nothing'], ['No answer in 5 min', 'Declined automatically']], 'Accept, and the customer’s card is charged. Decline, or let five minutes pass, and the customer pays nothing.'),
      ST('After you accept', ['Start preparing', 'Adjust prep time if needed', 'Tap Ready when it’s packed'], 'After accepting, start preparing, adjust the time if needed, and tap Ready when the order is packed.'),
    ], body: [
      ['Steps', ol(['Read the items, choices and special instructions.', 'Set the prep time (your default is filled in).', 'Tap <b>Accept</b>. The customer’s card is charged now.', 'Or tap <b>Decline</b> and choose a reason (too busy, item sold out, closing soon). The customer’s hold is released and they pay nothing.', 'When it’s packed, tap <b>Ready</b>.'])],
      ['Good to know', ul(['At checkout the customer’s card is only authorized (held). It’s charged when you accept.', 'Orders not answered in 5 minutes are declined automatically. Too many missed orders can pause your store.', 'If an item is sold out, mark it on the menu so new customers can’t order it.'])],
    ] },
    { id: 'handoff', t: 'orders', title: 'Handing the order to the courier', sum: 'Check the order number, hand it over, done.', go: 'orders', scenes: [
      FL('Pickup to door', [['You tap Ready', 'Packed and sealed'], ['Courier arrives', 'Shows the order number'], ['Handed over', 'Order is on its way']], 'When you tap Ready, a courier is on the way. Check the order number they show, then hand it over.'),
      ST('Packing checklist', ['Match the order number on the bag', 'Check items and notes', 'Seal the bag', 'Include utensils only if asked'], 'Before handing over, match the order number, check items and notes, and seal the bag.'),
      ST('At the door', ['Leave at door: courier takes a photo', 'Hand it to me: customer gives a 4-digit PIN'], 'The courier completes the delivery with a photo at the door or a four-digit PIN from the customer.'),
    ], body: [
      ['Steps', ol(['Tap <b>Ready</b> when the order is packed. The courier is told it’s ready.', 'When the courier arrives, ask for the <b>order number</b> (for example SK1052) and check it matches the bag.', 'Hand the order over. The order moves to “On the way” and you’re done.', 'Pickup orders: the customer shows the order number and their name.'])],
      ['Good to know', ul(['Couriers may be Send Koro drivers or partner couriers. Treat them all the same.', 'Couriers deliver with a photo at the door or a 4-digit PIN the customer gives them, depending on what the customer chose.', 'Courier late or a problem at handoff? Use <b>Help</b> on the order. Please give couriers access to a restroom when asked.'])],
    ] },
    { id: 'refunds', t: 'orders', title: 'Refunds', sum: 'Refund an item or a whole order from the order screen.', go: 'history', scenes: [
      ST('Refund from the order', ['Open the order', 'Choose items or the whole order', 'Pick a reason', 'Confirm'], 'Refunds are done from the order screen: pick the items or the whole order, choose a reason, and confirm.'),
      FL('Who pays back what', [['Food and tax', 'From your Stripe balance'], ['Delivery part', 'From Send Koro'], ['Tip', 'Returned if refunded']], 'Food and tax come back from your Stripe balance. The delivery part is returned by Send Koro.'),
      MO('Card fee on a refund', [['Card processing on the order', 'kept by Stripe'], ['Delivery’s share of that fee', 'credited on your next invoice', 1]], 'Stripe keeps its card fee on refunds. The delivery’s share of that fee is credited back to you on your next invoice.'),
    ], body: [
      ['Steps', ol(['Open the order (Live orders or Order history).', 'Tap <b>Refund</b>, choose items or the whole order, and the reason.', 'Confirm. The customer sees the refund on their card in 5–10 business days.'])],
      ['Who pays what', ul(['<b>Food, tax and your service charge</b>: refunded from your Stripe balance.', '<b>Delivery</b> (the customer’s part): refunded by Send Koro.', '<b>Your delivery share</b> is restored if the delivery is refunded.', 'Stripe keeps its processing fee on refunds. The delivery’s share of that lost fee is credited to you on your next plan invoice.'])],
      ['Good to know', ul(['Always refund in Send Koro, not in Stripe, so every part is returned correctly.', 'Refunds lower your net food sales in the month they’re made, which can lower next month’s plan.'])],
    ] },
    { id: 'processing', t: 'money', title: 'Card processing fees', sum: 'What you pay on each order, with a worked example.', go: 'earnings', scenes: [
      T('Card processing', '2.9% + 30¢ · only on your part of the order', 'Card processing is Stripe’s standard 2.9% plus 30 cents. You pay it only on your part of the order.'),
      MO('One $30 order', [['Card charge (whole order)', '$43.54'], ['Stripe fee on it', '$1.57'], ['Paid by the delivery money', '−$0.39'], ['Your part of the fee', '$1.18', 1]], 'On a forty-three fifty-four order, Stripe’s fee is one fifty-seven. The delivery money pays thirty-nine cents, so your part is one eighteen.'),
      ST('Never charged', ['No commission', 'No card fee to customers', 'No fee on the delivery money for you'], 'Customers never pay a card fee, and you never pay processing on the delivery money.'),
    ], body: [
      ['How it works', ul(['Stripe takes its fee (2.9% + 30¢ standard pricing) from the whole card charge, in your Stripe account.', 'The delivery money pays its own share of that fee, so you pay processing only on your part: food, tax and service charges.', 'Customers are never charged a card processing fee. Send Koro takes no commission.'])],
      ['Example', tbl([['Card charge', '$43.54'], ['Stripe fee (2.9% + 30¢)', '$1.57'], ['Delivery money’s share', '−$0.39'], ['Your part of the fee', '$1.18', 1]])],
      ['Good to know', ul(['International cards can cost more; the delivery share is adjusted to the real fee.', 'See fees on each order under <b>Earnings → Order money</b>, and monthly in the Stripe tab.'])],
    ] },
    { id: 'payouts', t: 'money', title: 'Getting paid (payouts)', sum: 'How order money reaches your bank.', go: 'payouts', scenes: [
      FL('From order to bank', [['You accept', 'Card is charged'], ['Stripe balance', 'Food + tax − fees'], ['Your bank', 'Stripe payout']], 'When you accept, the payment lands in your Stripe balance. Stripe then pays your bank on your payout schedule.'),
      MO('What reaches you on a $30 order', [['Food + tax', '$32.66'], ['Your delivery share', '−$3.00'], ['Your part of card processing', '−$1.18'], ['Commission', '$0.00'], ['You receive', '$28.48', 1]], 'On a thirty dollar order with three dollars of delivery help, twenty-eight forty-eight reaches you.'),
      ST('Payout schedule', ['Set in your Stripe Dashboard', 'Daily, weekly or monthly', 'See every payout in the Stripe tab'], 'Choose daily, weekly or monthly payouts in your Stripe Dashboard, and see every payout in the Stripe tab.'),
    ], body: [
      ['How it works', ul(['Each order is a payment on your own Stripe account, created when you accept.', 'Stripe pays your bank on your payout schedule. New US accounts usually start with daily payouts a couple of business days after each payment; you can switch to weekly or monthly in Stripe.', 'The first payout can take longer while Stripe finishes checks.'])],
      ['Example', tbl([['Food', '$30.00'], ['Sales tax', '$2.66'], ['Your delivery share', '−$3.00'], ['Your part of card processing', '−$1.18'], ['Commission', '$0.00'], ['You receive', '$28.48', 1]])],
      ['Good to know', ul(['Your monthly plan is billed separately; it isn’t taken from payouts.', 'Send Koro promo credit used on your orders is paid back on your invoice (see “Referral and promo credit”).', 'Instant payouts are off at launch.'])],
    ] },
    { id: 'plans', t: 'money', title: 'Subscription plans', sum: 'A flat plan for each location, from its last month’s food sales.', go: 'subscription', scenes: [
      T('A flat monthly plan', 'No commission · first month free', 'Instead of commission, each location pays a flat monthly plan. The first month is free.'),
      MO('Plans by last month’s food sales', [['Up to $2,500', '$50'], ['$2,500.01 – $5,000', '$100'], ['$5,000.01 – $7,500', '$150'], ['$7,500.01 – $10,000', '$250'], ['$10,000.01 – $15,000', '$350'], ['Over $15,000', '$500', 1]], 'The plan comes from that location’s net food sales last month, from fifty to five hundred dollars.'),
      MO('Example: Park Slope', [['October net food sales', '$6,240.00'], ['November plan', '$150.00', 1]], 'For example, six thousand two hundred forty dollars of food sales in October means a one hundred fifty dollar plan in November.'),
    ], body: [
      ['The plans', tbl([['Up to $2,500', '$50'], ['$2,500.01 – $5,000', '$100'], ['$5,000.01 – $7,500', '$150'], ['$7,500.01 – $10,000', '$250'], ['$10,000.01 – $15,000', '$350'], ['Over $15,000', '$500', 1]])],
      ['How it’s worked out', ul(['<b>Net food sales</b> = food after your discounts, minus food refunds, for the previous calendar month (New York time).', 'Tips, tax, delivery fees and service charges are not counted. Send Koro promo credit doesn’t lower your food sales.', 'Each location has its own plan. A new location’s first month is free; a location that isn’t live isn’t billed.', 'A month with zero or negative sales pays the lowest plan.'])],
    ] },
    { id: 'billing', t: 'money', title: 'Paying your subscription', sum: 'One invoice on the 1st, card or bank, and what happens if a payment fails.', go: 'subscription', scenes: [
      PH('Your monthly invoice', 'Billed on the 1st at 12:00 PM ET', 'Invoice · December', [['Park Slope plan', '$150.00'], ['Williamsburg (first month)', '$0.00'], ['Send Koro promo credit', '−$15.00', 1], ['Total', '$135.00']], 'On the first of each month at noon Eastern, you get one invoice with a line for each location.'),
      ST('How to pay', ['Add a card or US bank account', 'Charged automatically on the 1st', 'Invoices and receipts by email'], 'Add a card or bank account once. It’s charged automatically, and invoices are emailed to you.'),
      ST('If a payment fails', ['Retried up to 4 times in 2 weeks', 'You get an email each time', 'Update your card on the Subscription page'], 'If a payment fails, it is retried automatically and you get an email each time. Update your card on the Subscription page.'),
    ], body: [
      ['Steps', ol(['Open <b>Subscription</b> and add a billing card or US bank account (stored securely by Stripe).', 'On the 1st at 12:00 PM ET, your invoice is created with one line per location and charged automatically.', 'See past invoices and download receipts on the same page.'])],
      ['Example invoice', tbl([['Park Slope plan (October sales $6,240)', '$150.00'], ['Williamsburg (first month free)', '$0.00'], ['Send Koro promo credit paid back', '−$15.00'], ['Total charged', '$135.00', 1]])],
      ['Good to know', ul(['There’s no proration: plans change on the 1st.', 'If a payment fails, it is retried up to 4 times over about 2 weeks and you are emailed each time. Update your card quickly to avoid interruption.', '<b>Unpaid plan:</b> if the invoice is still unpaid after the last retry, every location on it is deactivated automatically: it stops taking orders and is hidden from customers. Orders already accepted are still completed. You are told by email, text and a banner in the portal, and the Send Koro team reviews the account. Pay the invoice on the Subscription page and your locations go live again automatically.', 'Your food payouts are never held back or reduced to pay a plan.', 'Promo credit and some refund fee credits appear as negative lines that lower your invoice.'])],
    ] },
    { id: 'credit', t: 'money', title: 'Referral and promo credit', sum: 'Customers use Send Koro credit; we pay you back in full.', go: 'subscription', scenes: [
      T('Send Koro credit', 'Paid by Send Koro, never by you', 'Customers can use Send Koro credit from referrals and promo codes. Send Koro pays for it, never you.'),
      MO('An order with $10 credit', [['Customer’s order total', '$42.98'], ['Send Koro credit', '−$10.00'], ['Card charged now', '$32.98'], ['Paid back to you on your invoice', '$10.00', 1]], 'With ten dollars of credit, the card is charged ten dollars less, and Send Koro pays you that ten dollars back.'),
      FL('How you’re paid back', [['Monthly run', 'On the 1st'], ['Invoice line', '−credit used'], ['More than your plan?', 'Rest sent to your Stripe']], 'Each month the credit used lowers your plan invoice. If it’s more than the plan, the rest goes straight to your Stripe account.'),
    ], body: [
      ['How it works', ul(['Customers earn credit from “Refer a friend: give $5, get $5” and Send Koro promo codes. Credit is valid 30 days and covers food and tax only.', 'The customer’s card is charged the order total minus the credit, so you receive the credit amount less at the time of the order.', 'Send Koro pays it back on your next monthly invoice as a “Send Koro promo credit” line.', 'If the credit is more than that month’s plan, the rest is sent to your Stripe account in the same monthly run.'])],
      ['Examples', tbl([['Park Slope plan', '$150.00'], ['Promo credit used in October', '−$15.00'], ['Invoice', '$135.00', 1]]) + tbl([['Plan', '$50.00'], ['Promo credit used', '−$80.00'], ['Invoice', '$0.00'], ['Sent to your Stripe account', '$30.00', 1]])],
      ['Good to know', ul(['Credit doesn’t lower your net food sales, so it never changes your plan.', 'Each order shows the credit and the amount paid back later, under <b>Earnings → Order money</b>.', 'The “Promo credit this month” card on the Subscription page lists every order.'])],
    ] },
  ];
  // ---- Videos show the real portal pages: each “live” scene renders the actual screen, scrolls to the part being explained,
  // moves a pointer to it and rings it, while the caption (and optional voice) explains it.
  const LV = (screen, target, h, cap) => ({ k: 'live', screen, target, h, cap });
  const LIVE_SCENES = {
    start: (o) => [o[0], LV('signup', 'text:Your full name', 'Create your account', 'Tap Create account. Enter your name, mobile number and email. You sign in with a text code, so there are no passwords.'), LV('setup', 'text:Go live', 'Store setup checklist', 'Then open Store setup. Finish each step for your business and for each location. Every step has its own lesson here.'), o[3]],
    licenses: (o) => [o[0], LV('legal', 'text:What Send Koro asks for', 'Licenses and legal', 'Open Licenses and legal. At the top you see exactly what Send Koro asks for.'), LV('legal', 'text:Legal business name', 'Business details', 'Enter your business details once: legal name, doing-business-as name, entity type, EIN and the owner.'), LV('legal', 'text:NYC Food Service Establishment Permit', 'Each location', 'Then for each location, add the food permit with its number, expiry date and a photo, and the sales tax ID.'), o[2]],
    setup: () => [LV('profile', 'text:Restaurant name', 'Store profile', 'In Store profile, add your restaurant name, a short description and a wide cover photo.'), LV('profile', 'text:Cuisines', 'Cuisines', 'Pick up to three cuisines. The first one is your main cuisine, and customers can find you by it.'), LV('hours', 'text:Weekly hours', 'Hours', 'In Hours, set your opening times for each day, and add closures for holidays.'), LV('team', 'text:What each role can do', 'Team', 'In Team, invite your staff by phone. Owners see everything, managers run orders and the menu, and staff see live orders.'), LV('notifications', 'text:Keep ringing until answered', 'Order alerts', 'In Notifications, keep the order sound on. It rings every ten seconds until someone answers.')],
    branches: (o) => [LV('locations', 'text:+ Add location', 'Locations', 'Open Locations to see every branch. Tap Add location to open a new one.'), LV('locations', 'text:Finish setup', 'Each location sets up on its own', 'Each location finishes its own setup: permit, sales tax, hours, delivery fee rule and payouts.'), o[1]],
    tax: (o) => [o[0], LV('tax', 'text:Sales tax rate for Park Slope', 'Your rate, per location', 'Open Sales tax. Choose the location and check its rate. We suggest one from the address, and you confirm it.'), o[1], LV('tax', 'text:Tax collected by month', 'Help with filing', 'Below, you see the tax collected each month, and you can copy it for your accountant.')],
    stripe: (o) => [o[0], LV('setup', 'text:Connect Stripe', 'Connect Stripe', 'In Store setup, tap Connect Stripe. Stripe asks for your business, the owner’s ID and your bank, on its own secure page.'), LV('stripe', 'text:Active', 'The Stripe tab', 'When Stripe says Active, you can take orders. The Stripe tab shows your balance, payout schedule and bank.'), LV('stripe', 'text:Recent payouts', 'Payouts', 'Scroll down to see recent payouts, and use the other tabs for payments, statements and tax forms.')],
    menusetup: (o) => [LV('menu', 'text:Set up your menu faster', 'Start fast', 'On the Menu page, pick a template for your type of restaurant, or tap Import menu and we build it for you.'), o[1], LV('editItem', 'text:Price by size', 'Add an item', 'For each item, add a photo, name and description, then one price, or a price for each size.'), LV('editItem', 'text:+ Add a group', 'Choices', 'Add option groups for choices like protein, spice level or milk. Use Preview to see it as customers will.')],
    menuedit: () => [LV('menu', 'text:Sold out today', 'Sold out in one tap', 'To stop selling an item, turn off its switch. Choose sold out for today, or until you turn it back on.'), LV('menu', '.m2-check', 'Change many at once', 'Tick several items to mark them sold out, move them to a category, or change prices by a percent or an amount.'), LV('menu', 'select.m2-locsel', 'One location only', 'Pick a location at the top to change prices or sold out items at just that location.'), LV('mods', 'text:Ready-made groups', 'Option groups', 'On Option groups, edit a group once and every item using it updates. Add ready-made groups for your type of restaurant.')],
    pricing: (o) => [o[0], LV('editItem', 'text:Price (USD)', 'Your price', 'In the item editor, set the price customers pay before tax. There is no commission to cover.'), LV('editItem', 'text:Pickup price (optional)', 'Pickup price', 'Add an optional lower pickup price. Each location can also have its own price, further down.'), o[2]],
    delivery: (o) => [o[0], LV('delivery', 'text:Who pays the delivery fee?', 'Choose your rule', 'Open Delivery fee and choose who pays: the customer, you, a split, or free delivery above an amount.'), LV('delivery', 'text:You pay ($)', 'Split it', 'With Split, you pay a fixed amount or a percent of each delivery fee, and the customer pays the rest.'), o[2], LV('delivery', 'text:Monthly budget ($)', 'Stay in control', 'Set a maximum per order and a monthly budget. When the budget is used up, customers pay the full fee.')],
    ordersmgmt: (o) => [LV('orders', 'text:New', 'Live orders', 'The Live orders page shows new orders, orders you are preparing, and orders ready for pickup.'), LV('orders', '[data-cd]', 'Answer in time', 'Each new order has a five-minute timer. Answer before it runs out.'), LV('notifications', 'text:Keep ringing until answered', 'Never miss an order', 'In Notifications, keep the sound ringing until someone answers, and get a text if no one does.'), o[2]],
    accept: (o) => [LV('newOrder', 'text:Customer note:', 'A new order', 'When an order arrives, read the items and the customer’s note first.'), LV('newOrder', 'text:Prep time (min)', 'Set the prep time', 'Choose how long it will take. Your usual prep time is already selected.'), LV('newOrder', 'text:Accept order', 'Accept', 'Tap Accept order. The customer’s card is charged now. Decline, or let five minutes pass, and the customer pays nothing.'), LV('orders', 'text:Mark ready', 'Mark it ready', 'The order moves to Preparing. When it’s packed, tap Mark ready.')],
    handoff: (o) => [LV('orders', 'text:Ready', 'Ready for the courier', 'Ready orders wait in the Ready column until the courier arrives.'), o[1], LV('orders', 'text:Handed to courier', 'Hand it over', 'When the courier shows the matching order number, hand it over and tap Handed to courier.'), o[2]],
    refunds: (o) => [LV('history', 'text:SK1049', 'Find the order', 'Open Order history and tap the order with the problem.'), LV('orderDetail', 'text:Report a problem', 'Report a problem', 'Tap Report a problem: missing item, wrong order, courier issue or a complaint. Our team reviews it and refunds the customer.'), o[1], o[2]],
    processing: (o) => [o[0], o[1], LV('orderMoney', 'text:You get', 'See it on every order', 'Open any order’s money breakdown to see the card processing on your part, your delivery share, and what you get.'), o[2]],
    payouts: (o) => [o[0], o[1], LV('stripe', 'text:Every day (2 days to arrive)', 'Your payout schedule', 'In the Stripe tab you see your payout schedule and bank. Change the schedule in your Stripe Dashboard.'), LV('payouts', 'text:Nov 3', 'Every payout', 'On Payouts, open any payout to see the orders, fees and refunds in it.')],
    plans: (o) => [o[0], o[1], LV('subscription', 'text:Plan by location', 'Your plan by location', 'On the Subscription page, you see this month’s plan for each location, and an estimate of next month’s.'), o[2]],
    billing: (o) => [LV('subscription', 'text:Invoices', 'Your invoices', 'Every invoice is listed on the Subscription page, with one line for each location.'), LV('subscription', 'text:Update card', 'How you pay', 'Add or update your billing card or bank account here. It’s charged automatically on the first of the month at noon Eastern.'), o[2], LV('subscription', 'text:If a plan stays unpaid', 'If it stays unpaid', 'If the invoice is still unpaid after the last retry, your locations pause automatically and our team is told. Pay the invoice and they go live again right away.')],
    credit: (o) => [o[0], o[1], LV('subscription', 'text:Send Koro promo credit this month', 'Paid back on your invoice', 'On the Subscription page, the promo credit card lists every order where customers used credit. It comes off your next invoice.'), o[2]],
  };
  LESSONS.forEach((l) => { if (LIVE_SCENES[l.id]) l.scenes = LIVE_SCENES[l.id](l.scenes); });
  const refundsLesson = LESSONS.find((l) => l.id === 'refunds');
  refundsLesson.sum = 'Report a problem on the order; Send Koro handles the refund.';
  refundsLesson.body[0] = ['Steps', ol(['Open the order in <b>Live orders</b> or <b>Order history</b>.', 'Tap <b>Report a problem</b> and choose what happened: missing or wrong item, order not delivered, courier issue, or a customer complaint.', 'The Send Koro team reviews it, talks to the customer and refunds the right parts. You see the refund on the order’s money breakdown.', 'The customer sees the refund on their card in 5–10 business days.'])];
  refundsLesson.body[2] = ['Good to know', ul(['Refunds are never done in Stripe, so every part (food, tax, delivery, tip) is returned correctly.', 'Refunds lower your net food sales in the month they’re made, which can lower next month’s plan.'])];

  const LIVE_W = () => (PHONE ? 390 : 1040);
  function livePrep(k) {
    S.signedIn = true; S.modal = null; S.stack = []; S.screen = k;
    if (k === 'newOrder' || k === 'orders') { const o = S.orders.find((x) => x.status === 'new'); if (o) S.newId = o.id; }
    if (k === 'orderDetail') S.detailId = (S.orders.find((o) => o.status === 'preparing') || S.orders[0] || PAST[0]).id;
    if (k === 'editItem') { ensure2(); S.attachPick = false; S.edit = editFrom2(S.menu[0].items[0]); }
    if (k === 'menu' || k === 'mods') { ensure2(); S.itemQ = ''; S.itemCat = 'all'; S.bulk = {}; S.modQ = ''; }
    if (k === 'orderMoney') S.moneyId = 'SK1049';
    if (k === 'delivery') S.ruleDraft = null;
    if (k === 'payouts') { S.payBranch = S.branches[0].id; S.payoutOpen = null; }
    if (k === 'stripe') S.stripeTab = 'overview';
    if (k === 'legal') { S.licBranch = null; S.licOpen = null; }
    if (k === 'setup') S.branchId = S.branches[S.branches.length - 1].id;
    if (k === 'signup' && !S.signup) S.signup = { step: 1, owner: '', phone: '', email: '', code: '', name: '', address: '', cuisines: [], locs: '1', agree: false, tax: false };
    if (k === 'signup') S.signup = { ...S.signup, step: 1 };
  }
  function liveHTML(k) {
    const snap = { ...S }; let html = '';
    try { livePrep(k); if (k === 'newOrder' && !S.orders.some((o) => o.status === 'new')) S.screen = k = 'orders'; html = (V[k] || V.home)(); } catch (e) { html = `<div class="card pad">Preview of this page isn’t available.</div>`; }
    Object.keys(S).forEach((key) => { if (!(key in snap)) delete S[key]; }); Object.assign(S, snap);
    return html.replace(/\sid="[^"]*"/g, '').replace(/\sdata-(a|m|live|rr|photo)="/g, ' data-x$1="').replace(/\sautofocus/g, '');
  }
  const liveCache = {};
  function liveScene(sc, i, on) {
    const key = sc.screen + (PHONE ? ':p' : ':w'); if (!liveCache[key]) liveCache[key] = liveHTML(sc.screen);
    return `<div class="vp-scene vp-live ${on ? 'on' : ''}" data-i="${i}" aria-hidden="${!on}"><div class="vp-dev ${PHONE ? 'ph' : 'web'}"><div class="vp-dev-bar">${PHONE ? '' : '<i></i><i></i><i></i>'}<span>${esc(PAGES.find((p) => p[0] === sc.screen) ? PAGES.find((p) => p[0] === sc.screen)[1] : sc.h)}</span></div><div class="vp-view"><div class="vp-live-inner ${PHONE ? 'phone' : 'web'}" inert style="width:${LIVE_W()}px">${liveCache[key]}</div><div class="vp-hl"></div><div class="vp-cursor"><svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3l14 8-6 1.5L10 19z" fill="#FFFFFF" stroke="#0E1E33" stroke-width="1.6" stroke-linejoin="round"/></svg></div></div></div><div class="vp-tag"><b>${esc(sc.h)}</b></div></div>`;
  }
  function liveFind(inner, spec) {
    if (!spec.startsWith('text:')) return inner.querySelector(spec);
    const t = spec.slice(5); let best = null;
    inner.querySelectorAll('button,label,b,h1,h2,h3,span,a,div,td,strong').forEach((e) => { const tx = e.textContent.replace(/\s+/g, ' ').trim(); if (tx.startsWith(t) || (tx.includes(t) && tx.length < t.length + 40)) { if (!best || e.textContent.length < best.textContent.length) best = e; } });
    return best;
  }
  function liveLayout(scene, sc) {
    const view = scene.querySelector('.vp-view'); const inner = scene.querySelector('.vp-live-inner'); if (!view || !inner) return;
    const scale = view.clientWidth / LIVE_W(); inner.style.transform = `scale(${scale})`;
    const tgt = liveFind(inner, sc.target); const hl = scene.querySelector('.vp-hl'); const cur = scene.querySelector('.vp-cursor');
    let y = 0; let box = null;
    if (tgt) { const ir = inner.getBoundingClientRect(); const r = tgt.getBoundingClientRect(); box = { x: (r.left - ir.left) / scale, y: (r.top - ir.top) / scale, w: r.width / scale, h: r.height / scale };
      const viewH = view.clientHeight / scale; y = Math.max(0, Math.min(box.y - viewH * 0.32, inner.scrollHeight - viewH)); }
    inner.style.transform = `translateY(${-y * scale}px) scale(${scale})`;
    if (box) { const pad = 6; Object.assign(hl.style, { left: (box.x - pad) * scale + 'px', top: (box.y - y - pad) * scale + 'px', width: (box.w + pad * 2) * scale + 'px', height: (box.h + pad * 2) * scale + 'px', opacity: 1 });
      Object.assign(cur.style, { left: (box.x + Math.min(box.w * 0.6, 120)) * scale + 'px', top: (box.y - y + box.h * 0.7) * scale + 'px', opacity: 1 }); }
    else { hl.style.opacity = 0; cur.style.opacity = 0; }
  }
  function liveLayoutAll() { const el = vpEl(); if (!el) return; const l = lessonById(VP.id); el.querySelectorAll('.vp-scene.vp-live').forEach((s) => { const sc = l.scenes[+s.dataset.i]; s.classList.remove('hl-on'); liveLayout(s, sc); }); const on = el.querySelector('.vp-scene.on.vp-live'); if (on) { void on.offsetWidth; setTimeout(() => on.classList.add('hl-on'), 650); } }

  // ---- Voice: pick the most natural voice the device has, speak slower, wait for each sentence to finish.
  const VOICE_PREF = [/natural/i, /neural/i, /premium/i, /enhanced/i, /google us english/i, /\b(ava|samantha|allison|susan|zoe|aria|jenny|emma|michelle)\b/i];
  function bestVoice() {
    try { const vs = (window.speechSynthesis.getVoices() || []).filter((v) => /^en(-|_)?(US|GB)?/i.test(v.lang));
      if (VP.voiceName) { const v = vs.find((x) => x.name === VP.voiceName); if (v) return v; }
      for (const re of VOICE_PREF) { const v = vs.find((x) => re.test(x.name) && /en.?US/i.test(x.lang)) || vs.find((x) => re.test(x.name)); if (v) return v; }
      return vs.find((x) => /en.?US/i.test(x.lang)) || vs[0] || null; } catch (e) { return null; }
  }
  try { if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = () => {}; } catch (e) { /* no speech */ }
  const SPEEDS = [[0.85, 'Slow'], [1, 'Normal'], [1.15, 'Fast']];
  const sceneDur = (sc) => Math.max(5, Math.round((sc.cap.split(/\s+/).length / 2.3 + (sc.k === 'live' ? 2.5 : 1.5)) / (VP.speed || 1)));
  const lessonDur = (l) => l.scenes.reduce((a, sc) => a + sceneDur(sc), 0);
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const lessonById = (id) => LESSONS.find((l) => l.id === id) || LESSONS[0];
  const IC = { play: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>', pause: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>', prev: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h2v14H6zM20 5v14L9 12z" fill="currentColor"/></svg>', next: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 5h2v14h-2zM4 5v14l11-7z" fill="currentColor"/></svg>', full: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>', vol: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' };
  const VP = { id: null, i: 0, t: 0, playing: false, cc: true, voice: false, timer: null, started: false, speed: 1, speaking: false, hold: 0, voiceName: '' };

  function sceneHTML(sc, i, on) {
    if (sc.k === 'live') return liveScene(sc, i, on);
    const d = (n) => `style="--d:${n}s"`;
    let inner = '';
    if (sc.k === 'title') inner = `<div class="vp-center">${LOGO('', 60).replace('class="sk-mark"', 'class="sk-mark vp-in vp-logo"')}<h3 class="vp-in" ${d(0.2)}>${sc.h}</h3><p class="vp-in" ${d(0.6)}>${sc.sub}</p></div>`;
    if (sc.k === 'steps') inner = `<h4 class="vp-in">${sc.h}</h4><ol class="vp-steps">${sc.items.map((t, j) => `<li class="vp-in" ${d(0.4 + j * 0.7)}><b>${j + 1}</b><span>${t}</span></li>`).join('')}</ol>`;
    if (sc.k === 'money') inner = `<h4 class="vp-in">${sc.h}</h4><div class="vp-receipt">${sc.rows.map((r, j) => `<div class="vp-row ${r[2] ? 'tot' : ''} vp-in" ${d(0.4 + j * 0.5)}><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}</div>${sc.note ? `<p class="vp-note vp-in" ${d(0.6 + sc.rows.length * 0.5)}>${sc.note}</p>` : ''}`;
    if (sc.k === 'flow') inner = `<h4 class="vp-in">${sc.h}</h4><div class="vp-flow">${sc.nodes.map((n, j) => `${j ? `<span class="vp-arrow vp-in" ${d(0.2 + j * 0.9)}>→</span>` : ''}<div class="vp-node vp-in" ${d(0.4 + j * 0.9)}><b>${n[0]}</b>${n[1] ? `<span>${n[1]}</span>` : ''}</div>`).join('')}</div>`;
    if (sc.k === 'phone') inner = `<div class="vp-split"><div class="vp-phone vp-in"><div class="vp-ph-bar">${sc.title}</div>${sc.ui.map((r, j) => `<div class="vp-ui ${r[2] ? 'hl' : ''} vp-in" ${d(0.4 + j * 0.45)}><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}${sc.btn ? `<div class="vp-ph-btn vp-in" ${d(0.6 + sc.ui.length * 0.45)}>${sc.btn}</div>` : ''}</div><div class="vp-side"><h4 class="vp-in" ${d(0.2)}>${sc.h}</h4><p class="vp-in" ${d(0.5)}>${sc.sub}</p></div></div>`;
    return `<div class="vp-scene ${on ? 'on' : ''}" data-i="${i}" aria-hidden="${!on}">${inner}</div>`;
  }
  function playerHTML(l) {
    if (VP.id !== l.id) { vpStop(); Object.assign(VP, { id: l.id, i: 0, t: 0, playing: false, started: false }); }
    const total = lessonDur(l); const before = l.scenes.slice(0, VP.i).reduce((a, sc) => a + sceneDur(sc), 0);
    setTimeout(liveLayoutAll, 80);
    return `<div class="vp ${PHONE ? 'vp-tall' : ''}" data-lesson="${l.id}"><div class="vp-screen" data-a="vpToggle" role="region" aria-label="Video: ${esc(l.title)}">${l.scenes.map((sc, i) => sceneHTML(sc, i, i === VP.i)).join('')}
      <div class="vp-cap ${VP.cc ? '' : 'off'}" aria-live="polite">${l.scenes[VP.i].cap}</div>
      ${VP.started ? '' : `<button class="vp-big" data-a="vpToggle" aria-label="Play video"><svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="#FFFFFF"/></svg></button><span class="vp-len">${mmss(total)}</span>`}</div>
      <div class="vp-ctrl"><button class="vp-b" data-a="vpToggle" aria-label="${VP.playing ? 'Pause' : 'Play'}">${VP.playing ? IC.pause : IC.play}</button><button class="vp-b" data-a="vpStep" data-d="-1" aria-label="Previous scene">${IC.prev}</button><button class="vp-b" data-a="vpStep" data-d="1" aria-label="Next scene">${IC.next}</button>
        <div class="vp-segs">${l.scenes.map((sc, i) => `<button class="vp-seg" data-a="vpSeek" data-i="${i}" aria-label="Scene ${i + 1}" style="flex:${sceneDur(sc)}"><i style="width:${i < VP.i ? 100 : i === VP.i ? Math.min(100, (VP.t / sceneDur(sc)) * 100) : 0}%"></i></button>`).join('')}</div>
        <span class="vp-time">${mmss(before + VP.t)} / ${mmss(total)}</span><button class="vp-b vp-t ${VP.cc ? 'on' : ''}" data-a="vpCC" aria-pressed="${VP.cc}">CC</button><button class="vp-b vp-t ${VP.voice ? 'on' : ''}" data-a="vpVoice" aria-pressed="${VP.voice}" aria-label="Read captions aloud">${IC.vol}</button><button class="vp-b vp-sp" data-a="vpSpeed" aria-label="Speed">${(SPEEDS.find((x) => x[0] === VP.speed) || SPEEDS[1])[1]}</button><button class="vp-b" data-a="vpFull" aria-label="Full screen">${IC.full}</button></div></div>`;
  }
  function vpEl() { return root.querySelector(`.vp[data-lesson="${VP.id}"]`); }
  function vpStop() { clearInterval(VP.timer); VP.timer = null; VP.playing = false; try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* no speech */ } }
  function vpSay() { VP.speaking = false; if (!VP.voice) return; try { const s = window.speechSynthesis; if (!s) return; s.cancel(); const u = new SpeechSynthesisUtterance(lessonById(VP.id).scenes[VP.i].cap.replace(/<[^>]+>/g, '')); const v = bestVoice(); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US'; u.rate = 0.9 * VP.speed; u.pitch = 1; const me = VP.i; u.onend = () => { if (VP.i === me) VP.speaking = false; }; u.onerror = u.onend; VP.speaking = true; VP.hold = 0; s.speak(u); } catch (e) { VP.speaking = false; } }
  function vpPaint(sceneChanged) {
    const el = vpEl(); if (!el) { vpStop(); return; }
    const l = lessonById(VP.id); const total = lessonDur(l); const before = l.scenes.slice(0, VP.i).reduce((a, sc) => a + sceneDur(sc), 0);
    if (sceneChanged) { el.querySelectorAll('.vp-scene').forEach((s) => { const on = +s.dataset.i === VP.i; s.classList.toggle('on', on); s.setAttribute('aria-hidden', String(!on)); }); el.querySelector('.vp-cap').innerHTML = l.scenes[VP.i].cap; liveLayoutAll(); }
    el.querySelectorAll('.vp-seg i').forEach((b, i) => { b.style.width = (i < VP.i ? 100 : i === VP.i ? Math.min(100, (VP.t / sceneDur(l.scenes[i])) * 100) : 0) + '%'; });
    el.querySelector('.vp-time').textContent = `${mmss(before + VP.t)} / ${mmss(total)}`;
    const pb = el.querySelector('.vp-ctrl .vp-b'); pb.innerHTML = VP.playing ? IC.pause : IC.play; pb.setAttribute('aria-label', VP.playing ? 'Pause' : 'Play');
    const big = el.querySelector('.vp-big'); if (big && VP.started) { big.remove(); const ln = el.querySelector('.vp-len'); if (ln) ln.remove(); }
  }
  function vpGo(i) { const l = lessonById(VP.id); VP.i = Math.max(0, Math.min(l.scenes.length - 1, i)); VP.t = 0; vpPaint(true); if (VP.playing) vpSay(); }
  function vpPlay() {
    const l = lessonById(VP.id); VP.playing = true; VP.started = true;
    if (VP.i === l.scenes.length - 1 && VP.t >= sceneDur(l.scenes[VP.i])) { VP.i = 0; VP.t = 0; }
    clearInterval(VP.timer); vpPaint(true); vpSay();
    VP.timer = setInterval(() => {
      if (!vpEl()) { vpStop(); return; }
      VP.t += 0.1; const d = sceneDur(l.scenes[VP.i]);
      if (VP.t >= d && VP.speaking && VP.hold < 12) { VP.hold += 0.1; VP.t = d; vpPaint(false); return; }
      if (VP.t >= d) { if (VP.i < l.scenes.length - 1) { VP.i++; VP.t = 0; vpPaint(true); vpSay(); return; } VP.t = d; vpStop(); vpPaint(false); S.learnDone[VP.id] = true; return; }
      vpPaint(false);
    }, 100);
  }

  const pubHead = (cur) => `<div class="lc-top"><button class="lc-brand" data-a="lcTab" data-to="signin">${LOGO('', 34)}${WORD}<span class="pill p-n">for restaurants</span></button><nav class="lc-tabs" aria-label="Welcome">${[['signin', 'Sign in'], ['signup', PHONE ? 'Join' : 'Create account'], ['learn', 'Learning center']].map(([k, l]) => `<button data-a="lcTab" data-to="${k}" class="${cur === k || (k === 'learn' && cur === 'lesson') ? 'on' : ''}" aria-current="${cur === k ? 'page' : 'false'}">${l}</button>`).join('')}</nav></div>`;
  const lcWrap = (inner) => (S.signedIn ? inner : `<div class="lc-page">${inner}</div>`);

  V.learn = () => {
    const q = String(S.learnQ || '').trim().toLowerCase(); const tr = S.learnTrack || 'all';
    const done = LESSONS.filter((l) => S.learnDone[l.id]).length;
    const list = LESSONS.filter((l) => (tr === 'all' || l.t === tr) && (!q || (l.title + ' ' + l.sum + ' ' + l.body.map((b) => b[0] + b[1]).join(' ')).toLowerCase().includes(q)));
    const card = (l) => `<button class="lc-card" data-a="lcOpen" data-id="${l.id}"><span class="lc-thumb"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="#FFFFFF"/></svg><i>${mmss(lessonDur(l))}</i></span><span class="lc-ct"><b>${esc(l.title)}</b><span class="mut sm-t">${esc(l.sum)}</span><span class="lc-meta">${S.learnDone[l.id] ? '<span class="pill p-g">✓ Done</span>' : ''}<span>Video ${mmss(lessonDur(l))} · ${Math.max(2, Math.round(l.body.map((b) => b[1]).join(' ').replace(/<[^>]+>/g, ' ').split(/\s+/).length / 200))} min read</span></span></span></button>`;
    const inner = `${S.signedIn ? head('Learning center', `${done} of ${LESSONS.length} lessons done`) : ''}${body(`
      <div class="lc-hero"><span class="lc-kick">Learning center</span><h1>Everything you need to sell on Send Koro</h1><p>Short videos and simple guides: getting started, licenses, Stripe, menus, orders, delivery fees, refunds, payouts and your monthly plan.</p>
        <div class="lc-prog"><i style="width:${(done / LESSONS.length) * 100}%"></i></div><span class="sm-t">${done} of ${LESSONS.length} lessons done</span>
        <label class="m2-search lc-search"><span class="mut" aria-hidden="true">⌕</span><input id="lc-q" data-m="learnQ" data-live="1" placeholder="Search: payouts, refund, tax, delivery fee…" value="${esc(S.learnQ || '')}"></label></div>
      <div class="m2-chips">${[['all', 'All lessons'], ...LTRACKS].map(([k, l]) => `<button class="chip ${tr === k ? 'on' : ''}" data-a="lcTrack" data-v="${k}">${l}</button>`).join('')}</div>
      ${LTRACKS.filter(([k]) => list.some((l) => l.t === k)).map(([k, lbl]) => `<section class="col" style="gap:10px"><h2 class="lc-h2">${lbl}</h2><div class="lc-grid">${list.filter((l) => l.t === k).map(card).join('')}</div></section>`).join('') || '<div class="card empty">No lessons match. Try “payout”, “menu” or “tax”.</div>'}
      <div class="card pad col"><b>Still have a question?</b><span class="mut sm-t">Restaurant support: <b style="user-select:all">(718) 555-0150</b>, 11 AM–11 PM, or text us from Help in the portal.</span>${S.signedIn ? '' : '<div class="row wrap" style="gap:8px"><button class="btn sm" data-a="lcTab" data-to="signup">Create your account</button><button class="btn ln sm" data-a="lcTab" data-to="signin">Sign in</button></div>'}</div>`)}`;
    return lcWrap(inner);
  };
  V.lesson = () => {
    const l = lessonById(S.lessonId); const ix = LESSONS.indexOf(l); const prev = LESSONS[ix - 1]; const next = LESSONS[ix + 1];
    const inner = `${S.signedIn ? head(l.title, LTRACKS.find((t) => t[0] === l.t)[1]) : ''}${body(`<div class="lc-lesson">
      ${S.signedIn ? '' : `<button class="btn gh" data-a="lcTab" data-to="learn" style="align-self:flex-start;padding:0">← Learning center</button>`}
      <div class="col" style="gap:4px"><span class="lc-kick">${LTRACKS.find((t) => t[0] === l.t)[1]} · Lesson ${ix + 1} of ${LESSONS.length}</span>${S.signedIn ? '' : `<h1 class="lc-title">${esc(l.title)}</h1>`}<span class="mut">${esc(l.sum)}</span></div>
      ${playerHTML(l)}
      <article class="lc-art">${l.body.map(([h, html]) => `<h2>${h}</h2>${html}`).join('')}
        <details><summary>Video transcript</summary><p>${l.scenes.map((sc) => sc.cap).join(' ')}</p></details></article>
      <div class="row wrap" style="gap:8px"><button class="btn ${S.learnDone[l.id] ? 'ln' : ''}" data-a="lcDone">${S.learnDone[l.id] ? '✓ Marked as done' : 'Mark as done'}</button>${S.signedIn && l.go && can(l.go) ? `<button class="btn ln" data-a="lcGo" data-to="${l.go}">Open this in the portal</button>` : ''}</div>
      <div class="lc-nav">${prev ? `<button class="lc-navb" data-a="lcOpen" data-id="${prev.id}"><span class="mut sm-t">Previous</span><b>${esc(prev.title)}</b></button>` : '<span></span>'}${next ? `<button class="lc-navb r" data-a="lcOpen" data-id="${next.id}"><span class="mut sm-t">Next</span><b>${esc(next.title)}</b></button>` : ''}</div></div>`)}`;
    return lcWrap(inner);
  };
  Object.assign(A, {
    lcTab: (d) => { vpStop(); if (d.to === 'signin' || d.to === 'signup') { if (d.to === 'signup') { A.toSignup(); return; } S.codeSent = false; } S.stack = []; S.screen = d.to; render(true); },
    lcOpen: (d) => { vpStop(); S.lessonId = d.id; if (S.signedIn) { if (S.screen === 'lesson') { S.screen = 'lesson'; render(true); } else go('lesson'); } else { S.screen = 'lesson'; render(true); } },
    lcTrack: (d) => { S.learnTrack = d.v; render(); },
    lcDone: () => { S.learnDone[S.lessonId] = !S.learnDone[S.lessonId]; render(); },
    lcGo: (d) => { vpStop(); tabTo(d.to); },
    vpToggle: () => { if (VP.playing) { vpStop(); vpPaint(false); } else vpPlay(); },
    vpStep: (d) => { VP.started = true; vpGo(VP.i + +d.d); },
    vpSeek: (d) => { VP.started = true; vpGo(+d.i); },
    vpSpeed: () => { const ix = SPEEDS.findIndex((x) => x[0] === VP.speed); VP.speed = SPEEDS[(ix + 1) % SPEEDS.length][0]; VP.t = 0; const el = vpEl(); if (el) { el.querySelector('.vp-sp').textContent = SPEEDS.find((x) => x[0] === VP.speed)[1]; const l = lessonById(VP.id); el.querySelectorAll('.vp-seg').forEach((b, i) => { b.style.flex = sceneDur(l.scenes[i]); }); } vpPaint(false); if (VP.playing) vpSay(); },
    vpFull: () => { const el = vpEl(); if (!el) return; const fsOn = document.fullscreenElement === el; if (fsOn || el.classList.contains('max')) { if (fsOn) document.exitFullscreen().catch(() => {}); el.classList.remove('max'); setTimeout(liveLayoutAll, 200); return; }
      let p = null; try { p = el.requestFullscreen ? el.requestFullscreen() : null; } catch (e) { p = null; }
      if (p && p.then) p.then(() => setTimeout(liveLayoutAll, 200)).catch(() => { el.classList.add('max'); setTimeout(liveLayoutAll, 200); }); else { el.classList.add('max'); setTimeout(liveLayoutAll, 200); } },
    vpCC: () => { VP.cc = !VP.cc; const el = vpEl(); if (el) { el.querySelector('.vp-cap').classList.toggle('off', !VP.cc); const b = el.querySelector('[data-a="vpCC"]'); b.classList.toggle('on', VP.cc); b.setAttribute('aria-pressed', String(VP.cc)); } },
    vpVoice: () => { VP.voice = !VP.voice; const el = vpEl(); if (el) { const b = el.querySelector('[data-a="vpVoice"]'); b.classList.toggle('on', VP.voice); b.setAttribute('aria-pressed', String(VP.voice)); } if (VP.voice && VP.playing) vpSay(); if (!VP.voice) { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* no speech */ } } },
  });

  window.addEventListener('resize', () => { if (vpEl()) liveLayoutAll(); });
  document.addEventListener('fullscreenchange', () => setTimeout(liveLayoutAll, 150));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const el = vpEl(); if (el && el.classList.contains('max')) { el.classList.remove('max'); setTimeout(liveLayoutAll, 150); } } });
  // ---- Legal documents (shared texts in legal.js) ----
  const LG = window.SK_LEGAL;
  const LG_KEY = { agreement: 'restaurantTerms', terms: 'restaurantTerms', privacy: 'privacy', refunds: 'refunds', usage: 'usage', sms: 'sms' };
  V.legalList = () => { const inner = `${S.signedIn ? head('Legal documents', 'For your restaurant') : ''}${body(narrow(`${S.signedIn ? '' : '<h1 class="lc-title">Legal documents</h1>'}<span class="mut">The agreement and policies that apply to restaurants on Send Koro.</span><div class="card col lg-list" style="padding:4px 16px">${LG.listHTML('restaurant')}</div><span class="mut sm-t">Last updated ${LG.UPDATED}. Questions: info@sendkoro.com</span>`))}`; return S.signedIn ? inner : `<div class="lc-page">${inner}</div>`; };
  V.legalDoc = () => { const d = LG.DOCS[S.legalId] || LG.DOCS.restaurantTerms;
    const inner = `${S.signedIn ? head(d.title, 'Legal') : ''}${body(narrow(`${S.signedIn ? '' : `<button class="btn gh" data-a="lgBack" style="align-self:flex-start;padding:0">← Back</button><h1 class="lc-title">${d.title}</h1>`}${LG.docHTML(S.legalId)}`))}`;
    return S.signedIn ? inner : `<div class="lc-page">${inner}</div>`; };
  Object.assign(A, {
    legalOpen: (d) => { S.modal = null; if (S.screen === 'legalDoc') { S.legalId = d.id; render(true); return; } S.legalPrev = S.screen; if (S.signedIn) go('legalDoc', { legalId: d.id }); else { S.legalId = d.id; S.screen = 'legalDoc'; render(true); } },
    lgBack: () => { S.screen = S.legalPrev && S.legalPrev !== 'legalDoc' ? S.legalPrev : 'signin'; render(true); },
    legalJump: (d, el, e) => { if (e) e.preventDefault(); const t = root.querySelector('#lg-' + S.legalId + '-' + d.i); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
  });
  const infoOld = A.info; A.info = (d) => (LG_KEY[d.k] ? A.legalOpen({ id: LG_KEY[d.k] }) : infoOld(d));
  A.page = (d) => openPage(d.k);
  const h = (location.hash || '').slice(1);
  const hit = PAGES.find((p) => hashOf(p[0]) === h);
  if (hit) openPage(hit[0]); else render(true);
})();
