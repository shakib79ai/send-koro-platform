/* Send Koro admin portal prototype. Integer cents. Pretend data only.
   Money follows services/payments/src/core/allocation.ts: A = D + T, Q = F + S + X + C + T,
   restaurant retained = F + S + X − R, delivery fee share = fee × (C + T) / Q. */
(function () {
  const M = window.SK_MODE || {};
  const root = document.getElementById('app'); root.classList.add('cx', 'staff', 'admin'); if (M.theme === 'navy') root.classList.add('navy');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const money = (c) => (c < 0 ? '−' : '') + '$' + (Math.abs(c) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  // Logo M3 "Fork Ring, arrow breaks out" (brand kit v1). Colours come from CSS (.sk-mark).
  const LOGO = (c, size = 34) => `<svg class="sk-mark" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true"><path class="mk-r" d="M92.94 47.75A43 43 0 1 1 82.45 21.79" fill="none" stroke-width="7" stroke-linecap="round"/><g transform="rotate(-22 50 50)"><path class="mk-t" d="M17 42H34M17 50H34M17 58H34" fill="none" stroke-width="4.6" stroke-linecap="round"/><path class="mk-f" d="M32 37.5H37Q46 37.5 49 46L50.5 50L49 54Q46 62.5 37 62.5H32Z"/><path class="mk-a" d="M49 50H84" fill="none" stroke-width="6.5" stroke-linecap="round"/><path class="mk-h" d="M80 40.5L97 50L80 59.5Z" stroke-width="2" stroke-linejoin="round"/></g></svg>`;
  const WORD = '<span class="sk-name">Send <i class="k">Koro</i></span>';
  const TIERS = [[250000, 5000], [500000, 10000], [750000, 15000], [1000000, 25000], [1500000, 35000], [Infinity, 50000]];
  const planFor = (net) => (net <= 0 ? 5000 : TIERS.find((t) => net <= t[0])[1]);
  const stripeFee = (q) => (q ? Math.ceil((q * 290) / 10000) + 30 : 0);
  const tax = (f) => Math.round((f * 88750) / 1000000);
  const now = Date.now(); const MIN = 60000;
  const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  // ---------- data ----------
  const LOCS = [
    { id: 'bbc-ps', brand: 'Brooklyn Bowl Co.', name: 'Park Slope', owner: 'Shakib Haider', status: 'live', juris: 'NYC', octNet: 624000, stripe: 'Main account acct_…4F2', permit: 'verified', taxId: 'verified', taxAccepted: true, rule: 'Split · $3.00 (v3)', joined: 'Oct 1, 2026', free: false },
    { id: 'bbc-wb', brand: 'Brooklyn Bowl Co.', name: 'Williamsburg', owner: 'Shakib Haider', status: 'setup', juris: 'NYC', octNet: 0, stripe: 'Own account · not connected', permit: 'missing', taxId: 'review', taxAccepted: true, rule: 'Split · $3.00 (v3)', joined: 'Nov 2, 2026', free: false },
    { id: 'dk-ken', brand: 'Dhaka Kitchen', name: 'Kensington', owner: 'Rafiq Ahmed', status: 'live', juris: 'NYC', octNet: 1180000, stripe: 'Main account acct_…A11', permit: 'verified', taxId: 'verified', taxAccepted: true, rule: 'Customer pays (v1)', joined: 'Oct 1, 2026', free: false },
    { id: 'dk-jh', brand: 'Dhaka Kitchen', name: 'Jackson Heights', owner: 'Rafiq Ahmed', status: 'live', juris: 'NYC', octNet: 0, stripe: 'Own account acct_…B52', permit: 'verified', taxId: 'verified', taxAccepted: true, rule: 'Customer pays (v1)', joined: 'Nov 1, 2026', free: true },
    { id: 'koro', brand: 'Koro Ramen', name: 'Prospect Heights', owner: 'Ken Mori', status: 'live', juris: 'NYC', octNet: 488000, stripe: 'Main account acct_…C07', permit: 'verified', taxId: 'verified', taxAccepted: true, rule: 'Free over $30 (v2)', joined: 'Oct 3, 2026', free: false },
    { id: 'bbg', brand: 'Brooklyn Burger Co.', name: 'Fort Greene', owner: 'Dana Wells', status: 'live', juris: 'NYC', octNet: 905000, stripe: 'Main account acct_…D31', permit: 'verified', taxId: 'verified', taxAccepted: true, rule: 'Customer pays (v1)', joined: 'Oct 2, 2026', free: false },
    { id: 'atl', brand: 'Atlantic Pizza Co.', name: 'Boerum Hill', owner: 'Gino Russo', status: 'live', juris: 'NYC', octNet: 1610000, stripe: 'Main account acct_…E88', permit: 'verified', taxId: 'verified', taxAccepted: true, rule: 'Restaurant pays all (v2)', joined: 'Oct 1, 2026', free: false },
    { id: 'fw', brand: 'Flatbush Wings', name: 'Flatbush', owner: 'Andre Baptiste', status: 'paused', juris: 'NYC', octNet: 212000, stripe: 'Main account acct_…F19', permit: 'verified', taxId: 'verified', taxAccepted: true, rule: 'Split · $3.00 (v1)', joined: 'Oct 5, 2026', free: false },
    { id: 'gl', brand: 'Green Leaf Salads', name: 'Cobble Hill', owner: 'Ivy Chen', status: 'live', juris: 'NYC', octNet: 356000, stripe: 'Main account acct_…G40', permit: 'verified', taxId: 'verified', taxAccepted: true, rule: 'Customer pays (v1)', joined: 'Oct 4, 2026', free: false, payFail: true },
    { id: 'bsb', brand: 'Bed-Stuy Bagels', name: 'Bed-Stuy', owner: 'Maya Brooks', status: 'unpaid', juris: 'NYC', octNet: 281000, stripe: 'Main account acct_…H63', permit: 'verified', taxId: 'verified', taxAccepted: true, rule: 'Customer pays (v1)', joined: 'Oct 1, 2026', free: false, unpaid: { invoice: 'November 2026', amount: 10000, tries: 4, since: 'Nov 9, 2026, 12:04 PM', notified: 'Email · text · portal banner', review: 'new', note: '' } },
    { id: 'sh', brand: 'Spice House', name: 'Jackson Heights', owner: 'Rina Das', status: 'setup', juris: 'NYC', octNet: 0, stripe: 'Main account · not connected', permit: 'review', taxId: 'review', taxAccepted: true, rule: 'Not set', joined: 'Nov 5, 2026', free: false },
    { id: 'tx', brand: 'Taqueria Sol', name: 'Hoboken', owner: 'Luis Ortega', status: 'setup', juris: 'NJ · not open', octNet: 0, stripe: 'Main account · not connected', permit: 'missing', taxId: 'missing', taxAccepted: false, rule: 'Not set', joined: 'Nov 4, 2026', free: false },
  ];
  const locById = (id) => LOCS.find((l) => l.id === id);
  const locLabel = (l) => `${l.brand} · ${l.name}`;
  const LINES = { 'bbc-ps': [['Grilled Chicken Bowl', 1500]], 'dk-ken': [['Kacchi Biryani', 1695], ['Mango Lassi', 495]], 'dk-jh': [['Beef Tehari', 1395]], koro: [['Tonkotsu Ramen', 1725]], bbg: [['Double Smash', 1700], ['Fries', 500]], atl: [['Pepperoni Pie', 1800]], gl: [['Harvest Salad', 1100]] };
  const RSHARE = { 'bbc-ps': () => 300, 'dk-ken': () => 0, 'dk-jh': () => 0, koro: (f, d) => (f >= 3000 ? d : 0), bbg: () => 0, atl: (f, d) => d, gl: () => 0 };
  const CUSTOMERS = [
    { id: 'c1', name: 'Ana Rivera', phone: '(718) ••• 0101', orders: 14, spent: 52840, since: 'Oct 2', blocked: false },
    { id: 'c2', name: 'Dev Patel', phone: '(347) ••• 2290', orders: 6, spent: 19880, since: 'Oct 9', blocked: false },
    { id: 'c3', name: 'Kim Tran', phone: '(917) ••• 5512', orders: 9, spent: 33120, since: 'Oct 4', blocked: false },
    { id: 'c4', name: 'Shakib Haider', phone: '(718) ••• 0199', orders: 3, spent: 9905, since: 'Oct 20', blocked: false },
    { id: 'c5', name: 'Luis Mendez', phone: '(646) ••• 7781', orders: 21, spent: 80455, since: 'Oct 1', blocked: false },
    { id: 'c6', name: 'Test Account 7', phone: '(212) ••• 0000', orders: 11, spent: 0, since: 'Nov 3', blocked: true, flag: '11 declined cards in 2 days' },
  ];
  const DRIVERS = [
    { id: 'd1', name: 'Alex Morgan', vehicle: 'E-bike', status: 'active', online: true, stripe: true, trips: 42, hours: 19.5, locked: 39800, tips: 11240 },
    { id: 'd2', name: 'Maria Lopez', vehicle: 'Car', status: 'active', online: true, stripe: true, trips: 31, hours: 18.0, locked: 37600, tips: 8420 },
    { id: 'd3', name: 'Sam Okafor', vehicle: 'Bike', status: 'active', online: false, stripe: true, trips: 12, hours: 9.0, locked: 17950, tips: 2980 },
    { id: 'd4', name: 'Priya Nair', vehicle: 'Scooter', status: 'applied', online: false, stripe: false, trips: 0, hours: 0, locked: 0, tips: 0, applied: 'Nov 4' },
    { id: 'd5', name: 'Omar Haddad', vehicle: 'E-bike', status: 'applied', online: false, stripe: true, trips: 0, hours: 0, locked: 0, tips: 0, applied: 'Nov 5' },
    { id: 'd6', name: 'Chris Doyle', vehicle: 'Car', status: 'suspended', online: false, stripe: true, trips: 8, hours: 5.5, locked: 11200, tips: 1900, reason: 'Repeated late pickups' },
  ];
  const NYC_MIN = 2213; // $22.13 per trip hour
  // Delivery pricing (admin only): delivery fee = courier price + payout fee + card fee on the delivery money.
  // Customers and restaurants only ever see one "Delivery fee" amount; the markup is never shown to them.
  const PRICING = { on: true, cardBps: '290', cardFixed: '30', ownBps: '25', ownFixed: '25', tpBps: '25', tpFixed: '25', uberAvg: '780', ddAvg: '820' };
  const num = (v) => Math.max(0, Math.round(parseFloat(v) || 0));
  const feeOf = (q, p = PRICING) => (q ? Math.ceil((q * num(p.cardBps)) / 10000) + num(p.cardFixed) : 0);
  function priceOrder(P, F, X, T, rs, own, p = PRICING) {
    const payout = !p.on ? 0 : own ? Math.ceil(((P + T) * num(p.ownBps)) / 10000) + num(p.ownFixed) : (num(p.tpBps) || num(p.tpFixed) ? Math.ceil(((P + T) * num(p.tpBps)) / 10000) + num(p.tpFixed) : 0);
    let D = P + payout;
    for (let i = 0; p.on && i < 20; i++) { const c0 = D - rs(D); const q0 = F + X + c0 + T; const need = P + payout + Math.min(D + T, Math.round((feeOf(q0, p) * (c0 + T)) / q0)); if (need <= D) break; D = need; }
    return { D, payout };
  }
  let seq = 1060;
  function mkOrder(id, loc, mins, status, provider, opts = {}) {
    const lines = opts.lines || LINES[loc] || [['Dish', 1500]];
    const F = lines.reduce((a, l) => a + l[1], 0); const X = tax(F);
    const pickup = provider === 'Pickup';
    const T = pickup ? 0 : Math.round(F * (opts.tipPct ?? 18) / 100);
    const P = pickup ? 0 : provider === 'DoorDash Drive' ? num(PRICING.ddAvg) : num(PRICING.uberAvg);
    const rs = (d) => Math.min(d, (RSHARE[loc] || (() => 0))(F, d));
    const priced = pickup ? { D: 0, payout: 0 } : priceOrder(P, F, X, T, rs, provider === 'Own driver');
    const D = priced.D; const payout = priced.payout;
    const R = pickup ? 0 : rs(D); const C = D - R;
    const Q = F + X + C + T; const A = D + T; const fee = stripeFee(Q); const share = Q ? Math.min(A, Math.round((fee * (C + T)) / Q)) : 0;
    const placed = now - mins * MIN;
    const o = { id, loc, customer: opts.customer || 'c1', lines, F, X, D, P, payout, markup: D - P - payout, R, C, T, Q, A, fee, share, appFee: A - share, retained: F + X - R, status, provider, placed, deliveryId: provider === 'Uber Direct' ? 'del_' + id.slice(2) + 'uX' : provider === 'DoorDash Drive' ? 'dd_' + id.slice(2) + 'Q' : null, driver: provider === 'Own driver' ? (opts.driver || 'd1') : null, refunded: { food: 0, tax: 0, cdel: 0, subsidy: 0, tip: 0 }, tipSettled: ['delivered'].includes(status), timeline: [['Order placed · card held ' + money(Q), placed]] };
    if (!['waiting', 'declined'].includes(status)) o.timeline.push(['Restaurant accepted · card charged', placed + 2 * MIN]);
    if (['courier', 'delivered'].includes(status) && !pickup) o.timeline.push([provider === 'Own driver' ? 'Own driver assigned (locked pay ' + money(P) + ')' : provider + ' courier assigned', placed + 14 * MIN]);
    if (status === 'delivered') o.timeline.push([pickup ? 'Picked up by customer' : 'Delivered', placed + 34 * MIN]);
    if (status === 'declined') o.timeline.push(['Declined by restaurant · hold released', placed + 3 * MIN]);
    o.locked = provider === 'Own driver' ? D - (D - P - payout) - payout : 0; // driver pay = delivery fee − card share − payout cost = P
    o.stuck = !!opts.stuck;
    return o;
  }
  const S = {
    signedIn: true, phone: '', codeSent: false, code: '',
    // Customer credit program (BUSINESS_MODEL.md → Referral program). Amounts in cents.
    reviews: window.SK_REVIEWS.clone(), rvq: 'open', warnings: { fw: 1 },
    credit: { on: true, referrer: 500, friend: 500, days: 30, when: 'firstOrder', perMonth: 10, minCard: 50,
      codes: [{ code: 'WELCOME10', cents: 1000, uses: 212, limit: 1000, on: true, until: 'Dec 31, 2026' }, { code: 'BROOKLYN5', cents: 500, uses: 640, limit: 0, on: true, until: 'Nov 30, 2026' }],
      newCode: '', newCents: '5' },
    screen: 'ops', stack: [], modal: null, toast: '',
    orders: [
      mkOrder('SK1059', 'koro', 3, 'waiting', 'Uber Direct', { customer: 'c2' }),
      mkOrder('SK1058', 'bbg', 9, 'preparing', 'Uber Direct', { customer: 'c5', stuck: true }),
      mkOrder('SK1057', 'atl', 16, 'courier', 'DoorDash Drive', { customer: 'c3' }),
      mkOrder('SK1056', 'dk-ken', 22, 'courier', 'Own driver', { customer: 'c1', driver: 'd2' }),
      mkOrder('SK1055', 'bbc-ps', 31, 'preparing', 'Pickup', { customer: 'c4' }),
      mkOrder('SK1054', 'gl', 55, 'delivered', 'Uber Direct', { customer: 'c5' }),
      mkOrder('SK1053', 'bbc-ps', 70, 'delivered', 'Own driver', { customer: 'c1', lines: [['Grilled Chicken Bowl', 1500], ['Salmon Bowl', 1300], ['Mint Lemonade', 450]], driver: 'd1', locked: 880 }),
      mkOrder('SK1052', 'dk-jh', 95, 'delivered', 'Uber Direct', { customer: 'c3' }),
      mkOrder('SK1051', 'koro', 130, 'declined', 'Uber Direct', { customer: 'c2' }),
      mkOrder('SK1048', 'bbc-ps', 1440, 'delivered', 'Uber Direct', { customer: 'c1', lines: [['Grilled Chicken Bowl', 1500], ['Grilled Chicken Bowl', 1500]] }),
      mkOrder('SK1047', 'dk-ken', 8700, 'delivered', 'DoorDash Drive', { customer: 'c4', lines: [['Kacchi Biryani', 1695], ['Mango Lassi', 495], ['Mango Lassi', 495]] }),
    ],
    filter: { status: 'all', q: '', provider: 'all' }, detailId: null,
    tickets: [
      { id: 'T-301', order: 'SK1047', customer: 'c4', kind: 'Missing item', items: [['Mango Lassi', 495]], note: 'Only got one lassi.', status: 'open', at: 'Today 1:12 PM' },
      { id: 'T-300', order: 'SK1054', customer: 'c5', kind: 'Very late', items: [], note: 'Arrived 50 minutes after the estimate.', status: 'open', at: 'Today 12:40 PM' },
      { id: 'T-298', order: 'SK1048', customer: 'c1', kind: 'Wrong item', items: [['Grilled Chicken Bowl', 1500]], note: 'Got a salmon bowl instead.', status: 'resolved', at: 'Yesterday', resolution: 'Refunded $16.33 (food + tax)' },
    ],
    verify: [
      { id: 'v1', loc: 'sh', what: 'NYC Food Service Establishment Permit', number: '50998812', expires: '2027-08-31', file: 'spice-house-permit.pdf', status: 'review' },
      { id: 'v2', loc: 'sh', what: 'Sales tax ID (NYS Certificate of Authority)', number: '13-7781190', file: '', status: 'review' },
      { id: 'v3', loc: 'bbc-wb', what: 'Sales tax ID (NYS Certificate of Authority)', number: '12-3456789', file: '', status: 'review' },
      { id: 'v4', loc: 'sh', what: 'Business details and EIN', number: 'EIN 13-7781190 · Spice House LLC', file: '', status: 'review' },
    ],
    zones: [
      { name: 'Brooklyn', zips: '112xx', on: true, maxMi: '5', live: 7, weather: false },
      { name: 'Queens (Jackson Heights, Astoria, LIC)', zips: '111xx, 113xx, 1137x', on: true, maxMi: '4', live: 1, weather: false },
      { name: 'Manhattan', zips: '100xx–102xx', on: true, maxMi: '3', live: 0, weather: false },
      { name: 'Bronx', zips: '104xx', on: false, maxMi: '4', live: 0, weather: false },
      { name: 'Staten Island', zips: '103xx', on: false, maxMi: '5', live: 0, weather: false },
    ],
    zoneRules: { maxMi: '5', bands: [['1.5', '0', '0'], ['3', '5', '0'], ['5', '10', '12']], maxEtaMin: '60', stopBeforeMin: '15', shrinkOn: true, shrinkWaitMin: '12', shrinkToMi: '2', noCourierPickup: true, nycCapOn: true, nycCapPct: '15' },
    locRadius: { atl: '3' },
    promos: [
      { id: 'p1', loc: 'bbc-ps', type: 'Buy 1, get 1 free', detail: 'Grilled Chicken Bowl', audience: 'All customers', when: 'Nov 2 – Nov 30 · whenever open', budget: 15000, status: 'live', orders: 38, sales: 124800, cost: 57000 },
      { id: 'p2', loc: 'bbc-ps', type: 'Spend $X, save $Y', detail: 'Save $5.00 over $30.00', audience: 'New customers', when: 'From Oct 15 · ongoing', budget: 0, status: 'live', orders: 21, sales: 79800, cost: 10500 },
      { id: 'p5', loc: 'koro', type: 'Discount on items', detail: '20% off Tonkotsu Ramen', audience: 'All customers', when: 'Mon–Fri 2–5 PM · ongoing', budget: 10000, status: 'live', orders: 17, sales: 40800, cost: 5100 },
      { id: 'p6', loc: 'atl', type: 'Free delivery', detail: 'Orders over $25.00 · NYC 15% cap applies', audience: 'Returning customers', when: 'From Nov 1 · ongoing', budget: 20000, status: 'live', orders: 44, sales: 162800, cost: 24420 },
      { id: 'p7', loc: 'dk-ken', type: 'Free item with order', detail: 'Free Mango Lassi over $30.00', audience: 'Haven’t ordered in 30 days', when: 'Nov 10 – Nov 24', budget: 0, status: 'scheduled', orders: 0, sales: 0, cost: 0 },
      { id: 'p8', loc: 'gl', type: 'Percent off the order', detail: '15% off · up to $6.00', audience: 'All customers', when: 'Sep 1 – Sep 30', budget: 0, status: 'ended', orders: 61, sales: 158600, cost: 23790 },
    ],
    providers: [
      { id: 'uber', name: 'Uber Direct', role: 'Primary', state: 'Connected (sandbox)', on: true, quote: 780 },
      { id: 'dd', name: 'DoorDash Drive', role: 'Backup', state: 'Pending approval', on: false, quote: 820 },
      { id: 'own', name: 'Send Koro drivers', role: 'First within 2 mi', state: '2 online', on: true, quote: 780 },
    ],
    dispatchRules: { auto: true, fallbackMin: '6', ownFirst: true, ownRadius: '2' },
    admins: [{ name: 'Shakib Haider', phone: '(718) 555-0199', on: true, you: true }, { name: 'Nadia Karim', phone: '(347) 555-0142', on: true }, { name: 'Old Contractor', phone: '(646) 555-0100', on: false }],
    tierRun: null, billMonth: 'nov',
    invoices3p: [
      { id: 'del_1054uX', provider: 'Uber Direct', order: 'SK1054', quoted: 780, billed: 780, tip: 198, status: 'matched' },
      { id: 'del_1052uX', provider: 'Uber Direct', order: 'SK1052', quoted: 780, billed: 860, tip: 251, status: 'mismatch' },
      { id: 'dd_1047Q', provider: 'DoorDash Drive', order: 'SK1047', quoted: 820, billed: 820, tip: 483, status: 'matched' },
      { id: 'del_1048uX', provider: 'Uber Direct', order: 'SK1048', quoted: 780, billed: 780, tip: 540, status: 'unreconciled' },
    ],
    driverPay: { d1: 'transferred', d2: 'transferred', d3: 'pending' },
    feed: [], dcwp: { license: '2112345-DCA', expires: '2027-03-31' },
  };
  const ord = (id) => S.orders.find((o) => o.id === id);
  const cust = (id) => CUSTOMERS.find((c) => c.id === id);
  const drv = (id) => DRIVERS.find((d) => d.id === id);
  const STATUS = { waiting: ['p-o', 'Waiting for restaurant'], preparing: ['p-g', 'Preparing'], courier: ['p-g', 'Out for delivery'], delivered: ['p-n', 'Delivered'], declined: ['p-r', 'Declined · hold released'], cancelled: ['p-r', 'Cancelled · hold released'] };
  const pill = (o) => `<span class="pill ${STATUS[o.status][0]}">${STATUS[o.status][1]}${o.refundTotal ? ' · refunded ' + money(o.refundTotal) : ''}</span>`;

  // ---------- navigation ----------
  function go(s, extra) { if (extra) Object.assign(S, extra); if (S.screen !== s) S.stack.push(S.screen); S.screen = s; S.modal = null; render(true); }
  function tabTo(s) { S.stack = []; S.screen = s; S.modal = null; render(true); }
  function back() { S.screen = S.stack.pop() || 'ops'; render(true); }
  let tt; function toast(m) { S.toast = m; render(); clearTimeout(tt); tt = setTimeout(() => { S.toast = ''; render(); }, 2800); }

  // live feed simulation
  const FEED = [
    () => { const o = S.orders.find((x) => x.status === 'waiting'); if (!o) return null; o.status = 'preparing'; o.timeline.push(['Restaurant accepted · card charged', Date.now()]); return `${o.id} accepted by ${locLabel(locById(o.loc))}. Card charged ${money(o.Q)}.`; },
    () => { const o = S.orders.find((x) => x.status === 'preparing' && x.provider !== 'Pickup' && !x.stuck); if (!o) return null; o.status = 'courier'; o.timeline.push([o.provider + ' courier assigned', Date.now()]); return `${o.provider} courier assigned to ${o.id}.`; },
    () => { const o = S.orders.find((x) => x.status === 'courier'); if (!o) return null; o.status = 'delivered'; o.tipSettled = true; o.timeline.push(['Delivered', Date.now()]); return `${o.id} delivered by ${o.provider === 'Own driver' ? drv(o.driver).name : o.provider}.`; },
    () => { const locs = ['koro', 'bbg', 'atl', 'dk-ken', 'dk-jh', 'gl', 'bbc-ps']; const loc = locs[Math.floor(Math.random() * locs.length)]; const pr = Math.random() < 0.7 ? 'Uber Direct' : 'Own driver'; const o = mkOrder('SK' + seq++, loc, 0, 'waiting', pr, { customer: CUSTOMERS[Math.floor(Math.random() * 5)].id }); S.orders.unshift(o); return `New order ${o.id} at ${locLabel(locById(loc))} · ${money(o.Q)} held.`; },
  ];
  setInterval(() => {
    if (!S.signedIn || !['ops', 'orders'].includes(S.screen) || S.modal) return;
    const pick = FEED[Math.floor(Math.random() * FEED.length)](); if (!pick) return;
    S.feed.unshift([pick, Date.now()]); S.feed = S.feed.slice(0, 10); render();
  }, 4500);

  // ---------- pieces ----------
  const head = (title, sub, right = '') => `${S.stack.length ? '<button class="btn gh" data-a="back" style="align-self:flex-start;padding:0;min-height:32px">← Back</button>' : ''}<div class="row between wrap"><div><h1 style="font-size:30px;color:var(--g)">${esc(title)}</h1>${sub ? `<div class="mut">${sub}</div>` : ''}</div><div class="row wrap">${right}</div></div>`;
  const tile = (l, v, sub = '') => `<div class="card pad"><div class="mut sm-t">${l}</div><b style="font-size:26px;color:var(--g)">${v}</b>${sub ? `<div class="sm-t mut">${sub}</div>` : ''}</div>`;
  const tiles = (arr) => `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px">${arr.join('')}</div>`;
  const table = (cols, rows, min = 720) => `<div class="card" style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;min-width:${min}px;font-size:14px"><thead><tr style="text-align:left">${cols.map((c) => `<th style="padding:10px 12px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--mut)">${c}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${cols.length}" class="empty">Nothing here.</td></tr>`}</tbody></table></div>`;
  const td = (x, extra = '') => `<td style="padding:10px 12px;border-top:1px solid var(--line);${extra}">${x}</td>`;
  const sw = (attrs, on, label) => `<span class="switch"><input type="checkbox" role="switch" aria-label="${esc(label)}" ${attrs} ${on ? 'checked' : ''}></span>`;
  const statusLoc = (l) => ({ live: '<span class="pill" style="background:#0B3B6E;color:#fff">Live</span>', setup: '<span class="pill p-o">Setting up</span>', paused: '<span class="pill p-n">Paused</span>', unpaid: '<span class="pill p-r">Deactivated · plan unpaid</span>', suspended: '<span class="pill p-r">Suspended</span>' }[l.status]);
  const vpill = (s) => ({ verified: '<span class="pill p-g">Verified</span>', review: '<span class="pill p-o">In review</span>', missing: '<span class="pill p-r">Missing</span>', rejected: '<span class="pill p-r">Rejected</span>' }[s]);
  function orderRow(o) { const l = locById(o.loc); return `<tr data-a="detail" data-id="${o.id}" style="cursor:pointer">${td(`<b>${o.id}</b>`)}${td(fmtTime(o.placed))}${td(esc(locLabel(l)))}${td(esc(cust(o.customer).name))}${td(esc(o.provider) + (o.stuck ? ' <span class="pill p-r">No courier</span>' : ''))}${td(pill(o))}${td(`<b>${money(o.Q)}</b>`, 'text-align:right')}</tr>`; }

  // ---------- screens ----------
  const V = {};
  V.signin = () => `<div class="col" style="min-height:100vh;justify-content:center;align-items:center;padding:24px 16px;background:#0B3B6E"><div class="card pad col" style="width:100%;max-width:420px;gap:14px;padding:24px">
    <span class="logo" style="font-size:22px;color:var(--g)">${LOGO('', 49)}${WORD} <span class="pill p-o">Admin</span></span>
    <h1 style="font-size:26px;color:var(--g)">${S.codeSent ? 'Enter your code' : 'Admin sign in'}</h1>
    <p class="mut" style="margin:0">${S.codeSent ? `We texted a code to ${esc(S.phone)}. <b>Prototype: any 6 digits work.</b>` : 'Only people added under Admins can sign in. Text code, no passwords.'}</p>
    ${S.codeSent ? `<label class="f">6-digit code<input class="in" id="a-code" data-m="code" inputmode="numeric" maxlength="6" value="${esc(S.code)}" style="font-size:22px;letter-spacing:.4em;text-align:center;font-weight:800"></label><button class="btn" data-a="verify">Sign in</button><button class="btn gh" data-a="changePhone">Use a different number</button>` : `<label class="f">Mobile number<input class="in" id="a-phone" data-m="phone" inputmode="tel" placeholder="(718) 555-0199" value="${esc(S.phone)}"></label><button class="btn" data-a="sendCode">Text me a code</button>`}</div></div>`;

  V.ops = () => {
    const active = S.orders.filter((o) => ['waiting', 'preparing', 'courier'].includes(o.status));
    const day = S.orders.filter((o) => Date.now() - o.placed < 86400000 && o.status !== 'declined');
    const byProv = ['Uber Direct', 'DoorDash Drive', 'Own driver', 'Pickup'].map((p) => [p, day.filter((o) => o.provider === p).length]);
    const max = Math.max(1, ...byProv.map((x) => x[1]));
    const alerts = [
      ...S.orders.filter((o) => o.stuck && o.status === 'preparing').map((o) => [`<b>${o.id}</b>: no courier after 9 min (${esc(o.provider)})`, `<button class="btn sm" data-a="redispatch" data-id="${o.id}">Send to DoorDash</button>`]),
      ...S.orders.filter((o) => o.status === 'waiting' && Date.now() - o.placed > 2 * MIN).map((o) => [`<b>${o.id}</b>: ${esc(locLabel(locById(o.loc)))} hasn’t answered (${Math.round((Date.now() - o.placed) / MIN)} min). Auto-declines at 5 min.`, `<button class="btn ln sm" data-a="detail" data-id="${o.id}">Open</button>`]),
      ...(S.reviews.some((r) => r.complaint && r.complaint.status === 'open') ? [[`<b>${S.reviews.filter((r) => r.complaint && r.complaint.status === 'open').length}</b> open customer complaints about restaurants${S.reviews.some((r) => r.complaint && r.complaint.status === 'open' && r.issues.some((k) => RVX.SERIOUS.includes(k))) ? ' · <b style="color:var(--red)">includes allergen or hygiene</b>' : ''}`, '<button class="btn sm" data-a="tabTo" data-to="reviews">Review</button>']] : []),
      ...LOCS.filter((l) => l.status === 'unpaid' && l.unpaid.review !== 'done').map((l) => [`Plan unpaid: <b>${esc(locLabel(l))}</b> was deactivated automatically · needs human review`, '<button class="btn sm" data-a="tabTo" data-to="billing">Review</button>']),
      ...LOCS.filter((l) => l.payFail).map((l) => [`Plan payment failed: <b>${esc(locLabel(l))}</b> · Stripe is retrying`, '<button class="btn ln sm" data-a="tabTo" data-to="billing">Billing</button>']),
      ...(S.verify.some((v) => v.status === 'review') ? [[`<b>${S.verify.filter((v) => v.status === 'review').length}</b> documents waiting for verification`, '<button class="btn ln sm" data-a="tabTo" data-to="verify">Review</button>']] : []),
      ...(S.tickets.some((t) => t.status === 'open') ? [[`<b>${S.tickets.filter((t) => t.status === 'open').length}</b> open customer tickets`, '<button class="btn ln sm" data-a="tabTo" data-to="support">Support</button>']] : []),
    ];
    return `${head('Operations', 'Last 24 hours · live', '<span class="pill p-g">● Live</span>')}
      ${tiles([tile('Active orders', active.length), tile('Orders, 24h', day.length), tile('Food sales, 24h', money(day.reduce((a, o) => a + o.F, 0))), tile('Live locations', LOCS.filter((l) => l.status === 'live').length + ' of ' + LOCS.length), tile('Drivers online', DRIVERS.filter((d) => d.online).length)])}
      <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start">
        <div class="card pad col" style="flex:2 1 420px"><b style="font-size:18px">Needs attention</b>${alerts.map(([t, b]) => `<div class="row wrap" style="border-top:1px solid var(--line);padding:10px 0"><span class="grow" style="min-width:200px">${t}</span>${b}</div>`).join('') || '<div class="empty">All clear.</div>'}</div>
        <div class="card pad col" style="flex:1 1 280px"><b style="font-size:18px">Deliveries by provider (24h)</b>${byProv.map(([p, n]) => `<div class="col" style="gap:4px"><div class="row between sm-t"><span>${p}</span><b>${n}</b></div><div style="height:10px;border-radius:99px;background:var(--line)"><div style="height:100%;width:${(n / max) * 100}%;background:${p === 'Uber Direct' ? 'var(--g)' : p === 'DoorDash Drive' ? 'var(--o)' : p === 'Own driver' ? '#0B3B6E' : '#9AA39E'};border-radius:99px"></div></div></div>`).join('')}<span class="mut sm-t">Courier company names appear only here in admin, never to customers.</span></div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start">
        <div class="col" style="flex:2 1 520px;min-width:0"><div class="row between"><b style="font-size:18px">Active orders</b><button class="btn gh" data-a="tabTo" data-to="orders">All orders →</button></div>${table(['Order', 'Placed', 'Location', 'Customer', 'Delivery', 'Status', 'Total'], active.map(orderRow))}</div>
        <div class="card pad col" style="flex:1 1 280px"><b style="font-size:18px">Live feed</b>${S.feed.map(([t, at]) => `<div class="sm-t" style="border-top:1px solid var(--line);padding:8px 0"><span class="mut">${fmtTime(at)}</span> · ${esc(t)}</div>`).join('') || '<span class="mut sm-t">Waiting for events… (new events every few seconds)</span>'}</div>
      </div>`;
  };

  V.orders = () => {
    const f = S.filter; const q = f.q.trim().toLowerCase();
    const list = S.orders.filter((o) => (f.status === 'all' || o.status === f.status) && (f.provider === 'all' || o.provider === f.provider) && (!q || [o.id, locLabel(locById(o.loc)), cust(o.customer).name].join(' ').toLowerCase().includes(q)));
    return `${head('Orders', `${list.length} of ${S.orders.length} orders`)}
      <div class="row wrap"><label class="row grow" style="min-width:240px;height:46px;padding:0 12px;border-radius:10px;border:1.5px solid var(--line2);background:#fff"><span class="mut">⌕</span><input id="o-q" data-m="filter.q" data-live="1" placeholder="Order number, restaurant or customer" value="${esc(f.q)}" style="border:0;outline:0;flex:1;min-width:0;background:transparent"></label>
      <select class="in" data-m="filter.status" data-rr="1" style="width:200px" aria-label="Status"><option value="all">All statuses</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${v[1]}</option>`).join('')}</select>
      <select class="in" data-m="filter.provider" data-rr="1" style="width:200px" aria-label="Delivery"><option value="all">All delivery types</option>${['Uber Direct', 'DoorDash Drive', 'Own driver', 'Pickup'].map((p) => `<option ${f.provider === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
      ${table(['Order', 'Placed', 'Location', 'Customer', 'Delivery', 'Status', 'Total'], list.map(orderRow))}`;
  };

  V.orderDetail = () => {
    const o = ord(S.detailId); if (!o) return V.orders(); const l = locById(o.loc); const c = cust(o.customer);
    const net = o.retained - (o.fee - o.share);
    const courierCost = o.provider === 'Own driver' ? o.locked + o.T + o.payout : o.provider === 'Pickup' ? 0 : o.P + o.T + o.payout;
    const live = ['waiting', 'preparing', 'courier'].includes(o.status);
    const rf = o.refunded; const anyRefund = Object.values(rf).some((x) => x > 0);
    return `${head('Order ' + o.id, `${esc(locLabel(l))} · ${esc(c.name)} · placed ${fmtTime(o.placed)}`, `${pill(o)}`)}
      <div class="row wrap">${o.status === 'waiting' ? '<button class="btn ln sm" data-a="cancelOrder" style="color:var(--red);border-color:var(--red)">Cancel and release hold</button>' : ''}${live && o.provider !== 'Pickup' && o.status !== 'courier' ? `<button class="btn sm" data-a="redispatch" data-id="${o.id}">Send to Uber Direct / DoorDash now</button>` : ''}${['preparing', 'courier', 'delivered'].includes(o.status) ? '<button class="btn dk sm" data-a="refundAsk" style="font-size:14px">Refund by component</button>' : ''}</div>
      <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start">
        <div class="col" style="flex:1 1 360px">
          <div class="card pad col" style="gap:2px"><b style="margin-bottom:6px">Items</b>${o.lines.map((x) => `<div class="rw"><span>1× ${esc(x[0])}</span><span>${money(x[1])}</span></div>`).join('')}</div>
          <div class="card pad col" style="gap:10px"><b>Timeline</b>${o.timeline.map(([t, at]) => `<div class="row" style="align-items:flex-start"><span style="width:10px;height:10px;border-radius:99px;background:#0B3B6E;margin-top:5px;flex:none"></span><span class="grow">${esc(t)}</span><span class="mut sm-t">${fmtTime(at)}</span></div>`).join('')}</div>
          <div class="card pad col" style="gap:2px"><b style="margin-bottom:6px">Delivery</b><div class="rw"><span class="mut">Provider</span><span>${esc(o.provider)}${o.stuck ? ' · no courier yet' : ''}</span></div>${o.deliveryId ? `<div class="rw"><span class="mut">Provider delivery ID</span><span style="font-family:monospace">${o.deliveryId}</span></div><div class="rw"><span class="mut">Provider quote</span><span>${money(o.D)}</span></div><div class="rw"><span class="mut">Provider tracking</span><button class="btn gh" data-a="toastMsg" data-msg="Would open the provider's tracking page (prototype)" style="min-height:0;padding:0">Open ↗</button></div>` : ''}${o.driver ? `<div class="rw"><span class="mut">Driver</span><span>${esc(drv(o.driver).name)}</span></div><div class="rw"><span class="mut">Driver locked pay</span><span>${money(o.locked)}</span></div>` : ''}<div class="rw"><span class="mut">Tip (100% to courier)</span><span>${money(o.T)}${o.tipSettled ? ' · paid out' : ''}</span></div></div>
        </div>
        <div class="col" style="flex:1 1 360px">
          <div class="card pad col" style="gap:2px"><b style="margin-bottom:6px">Charged to customer (direct charge on ${esc(l.stripe.split(' acct')[0].toLowerCase())})</b>
            <div class="rw"><span class="mut">Food (F)</span><span>${money(o.F)}</span></div><div class="rw"><span class="mut">Tax (X) · restaurant’s</span><span>${money(o.X)}</span></div>
            <div class="rw"><span class="mut">Delivery price (D) · customer C ${money(o.C)} + restaurant R ${money(o.R)}</span><span>${money(o.D)}</span></div>
            ${o.D ? `<div class="rw sm-t"><span class="mut" style="padding-left:12px">= courier price P ${money(o.P)} + card-fee markup ${money(o.markup)}${o.payout ? ` + payout markup ${money(o.payout)}` : ''}</span><span></span></div>` : ''}
            <div class="rw"><span class="mut">Tip (T)</span><span>${money(o.T)}</span></div>
            <div class="rw tot"><span>Total charged (Q)</span><span>${money(o.Q)}</span></div></div>
          <div class="card pad col" style="gap:2px"><b style="margin-bottom:6px">Where it goes</b>
            <div class="rw"><span class="mut">Stripe processing fee on Q</span><span>${money(o.fee)}</span></div>
            <div class="rw"><span class="mut">Delivery money’s share of that fee</span><span>${money(o.share)}</span></div>
            <div class="rw"><span class="mut">Application fee A = D + T</span><span>${money(o.A)}</span></div>
            <div class="rw"><span><b>Application fee after share</b></span><span><b>${money(o.appFee)}</b></span></div>
            <div class="rw"><span class="mut">Restaurant retained (F + X − R)</span><span>${money(o.retained)}</span></div>
            <div class="rw"><span><b>Restaurant net after its fee share</b></span><span><b>${money(net)}</b></span></div>
            ${o.provider === 'Own driver' ? `<div class="rw"><span class="mut">Driver locked pay = delivery fee ${money(o.D)} − card share ${money(o.markup)} − payout ${money(o.payout)}</span><span>${money(o.locked)}</span></div>` : ''}
            <div class="rw"><span class="mut">Courier cost (${o.provider === 'Own driver' ? 'locked pay + tip + payout fee' : 'courier quote + tip + payout/settlement fee'})</span><span>${money(courierCost)}</span></div>
            <div class="rw"><span class="mut">Food commission</span><span>$0.00</span></div>
            <div class="rw tot"><span>Send Koro delivery result on this order</span><span>${money(o.appFee - courierCost)}</span></div>
            <span class="mut sm-t">Check: Q − A = ${money(o.Q - o.A)} = restaurant retained ${money(o.retained)}.</span></div>
          ${anyRefund ? `<div class="card pad col" style="gap:2px"><b style="margin-bottom:6px">Refunded</b>${[['Food', rf.food], ['Tax', rf.tax], ['Customer delivery (C)', rf.cdel], ['Restaurant subsidy restored (R)', rf.subsidy], ['Tip', rf.tip]].filter((x) => x[1]).map(([k, v]) => `<div class="rw"><span class="mut">${k}</span><span>${money(v)}</span></div>`).join('')}<div class="rw tot"><span>Back to customer</span><span>${money(o.refundTotal)}</span></div></div>` : ''}
          <div class="card pad col" style="gap:4px"><b>Customer</b><span>${esc(c.name)} · ${esc(c.phone)}</span><span class="mut sm-t">${c.orders} orders · ${money(c.spent)} spent · since ${c.since}</span><button class="btn gh" data-a="custOrders" data-id="${c.id}" style="align-self:flex-start;padding:0">See their orders</button></div>
        </div></div>`;
  };

  V.support = () => {
    const open = S.tickets.filter((t) => t.status === 'open');
    return `${head('Support', `${open.length} open customer tickets`)}
      ${S.tickets.map((t) => { const o = ord(t.order); const l = o && locById(o.loc); return `<div class="card pad col" style="${t.status === 'open' ? 'border-left:4px solid var(--o)' : ''}"><div class="row between wrap"><div><b style="font-size:17px">${t.id} · ${esc(t.kind)}</b><div class="mut sm-t">${esc(cust(t.customer).name)} · <button class="btn gh" data-a="detail" data-id="${t.order}" style="min-height:0;padding:0;font-size:13px">${t.order}</button>${l ? ' · ' + esc(locLabel(l)) : ''} · ${t.at}</div></div><span class="pill ${t.status === 'open' ? 'p-o' : 'p-g'}">${t.status === 'open' ? 'Open' : 'Resolved'}</span></div>
        <div>“${esc(t.note)}”</div>${t.items.length ? `<div class="sm-t">Items reported: ${t.items.map((x) => `${esc(x[0])} (${money(x[1])})`).join(', ')}</div>` : ''}
        ${t.status === 'open' ? `<div class="row wrap"><button class="btn sm" data-a="ticketRefund" data-id="${t.id}">${t.items.length ? `Refund ${money(t.items.reduce((a, x) => a + x[1], 0) + tax(t.items.reduce((a, x) => a + x[1], 0)))} (food + tax)` : 'Choose refund…'}</button><button class="btn ln sm" data-a="ticketReply" data-id="${t.id}">Reply only</button><button class="btn ln sm" data-a="ticketReject" data-id="${t.id}" style="color:var(--red);border-color:var(--red)">Reject</button></div>` : `<div class="note n-g sm-t">${esc(t.resolution)}</div>`}</div>`; }).join('')}`;
  };

  V.restaurants = () => {
    const brands = [...new Set(LOCS.map((l) => l.brand))];
    return `${head('Restaurants', `${brands.length} restaurants · ${LOCS.length} locations · ${LOCS.filter((l) => l.status === 'live').length} live`)}
      ${table(['Location', 'Owner', 'Status', 'Licenses', 'Tax accepted', 'Stripe payouts', 'Delivery rule', 'Plan (Nov)', ''], LOCS.map((l) => `<tr>${td(`<b>${esc(l.brand)}</b><span class="mut sm-t" style="display:block">${esc(l.name)} · ${esc(l.juris)}</span>`)}${td(esc(l.owner))}${td(statusLoc(l))}${td(`${vpill(l.permit)} <span class="sm-t mut">permit</span>`)}${td(l.taxAccepted ? '<span class="pill p-g">Yes</span>' : '<span class="pill p-r">Not yet</span>')}${td(`<span class="sm-t">${esc(l.stripe)}</span>`)}${td(`<span class="sm-t">${esc(l.rule)}</span>`)}${td(planCell(l))}${td(`<button class="btn ln sm" data-a="locOpen" data-id="${l.id}">Open</button>`)}</tr>`), 1100)}`;
  };
  const planCell = (l) => (l.status !== 'live' ? '<span class="mut sm-t">Not billed</span>' : l.free ? '<span class="sm-t">Free · 1st month</span>' : `<b>${money(planFor(l.octNet))}</b>${l.payFail ? ' <span class="pill p-r">Failed</span>' : ''}`);
  V.restaurantDetail = () => {
    const l = locById(S.locId); const sibs = LOCS.filter((x) => x.brand === l.brand);
    const ready = l.permit === 'verified' && l.taxId === 'verified' && l.taxAccepted && !l.stripe.includes('not connected');
    return `${head(locLabel(l), `${esc(l.owner)} · joined ${l.joined} · ${esc(l.juris)}`, statusLoc(l))}
      <div class="row wrap">${l.status === 'setup' ? `<button class="btn sm" data-a="locLive" ${ready ? '' : 'disabled'}>Make live</button>${ready ? '' : '<span class="sm-t mut">Needs a verified permit and sales tax ID, tax acceptance and connected Stripe.</span>'}` : ''}${l.status === 'live' ? '<button class="btn ln sm" data-a="locSet" data-v="paused">Pause</button><button class="btn ln sm" data-a="locSet" data-v="suspended" style="color:var(--red);border-color:var(--red)">Suspend</button>' : ''}${['paused', 'suspended'].includes(l.status) ? '<button class="btn sm" data-a="locSet" data-v="live">Reinstate</button>' : ''}${l.status === 'unpaid' ? `<span class="sm-t" style="color:var(--red)">Deactivated automatically: ${esc(l.unpaid.invoice)} plan (${money(l.unpaid.amount)}) unpaid after ${l.unpaid.tries} retries.</span><button class="btn ln sm" data-a="tabTo" data-to="billing">Review in Billing</button>` : ''}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px">
        <div class="card pad col" style="gap:2px"><b style="margin-bottom:6px">Compliance</b><div class="rw"><span class="mut">Food permit</span>${vpill(l.permit)}</div><div class="rw"><span class="mut">Sales tax ID</span>${vpill(l.taxId)}</div><div class="rw"><span class="mut">Sales tax responsibility accepted</span><span>${l.taxAccepted ? 'Yes' : 'No'}</span></div><div class="rw"><span class="mut">Partner agreement</span><span>Signed</span></div><button class="btn gh" data-a="tabTo" data-to="verify" style="align-self:flex-start;padding:0">Verification queue →</button></div>
        <div class="card pad col" style="gap:2px"><b style="margin-bottom:6px">Money</b><div class="rw"><span class="mut">Stripe account</span><span class="sm-t">${esc(l.stripe)}</span></div><div class="rw"><span class="mut">October net food sales</span><span>${money(l.octNet)}</span></div><div class="rw"><span class="mut">November plan</span><span>${planCell(l)}</span></div><div class="rw"><span class="mut">Food commission</span><span>$0.00</span></div><div class="rw"><span class="mut">Delivery rule (consent)</span><span class="sm-t">${esc(l.rule)}</span></div></div>
        ${zoneOfLoc(l) ? `<div class="card pad col"><b>Delivery area (set by Send Koro)</b><div class="rw"><span class="mut">Area</span><span>${esc(zoneOfLoc(l).name.split(' (')[0])} · ${zoneOfLoc(l).maxMi} mi</span></div><div class="rw"><span class="mut">This location delivers within</span><b>${radiusOfLoc(l)} mi</b></div><label class="f">Custom radius (miles, smaller only)<input class="in" id="lr-${l.id}" data-m="locRadius.${l.id}" inputmode="decimal" value="${esc(S.locRadius[l.id] || '')}" placeholder="Area default" style="width:140px"></label><button class="btn ln sm" data-a="locRadiusSave" data-id="${l.id}" style="align-self:flex-start">Save radius</button><span class="mut sm-t">The restaurant doesn’t see or change this.</span></div>` : ''}
        <div class="card pad col"><b>Other locations of ${esc(l.brand)}</b>${sibs.filter((x) => x.id !== l.id).map((x) => `<button class="row" data-a="locOpen" data-id="${x.id}" style="border:0;border-top:1px solid var(--line);background:none;padding:8px 0;text-align:left;width:100%"><span class="grow">${esc(x.name)}</span>${statusLoc(x)}</button>`).join('') || '<span class="mut sm-t">Only one location.</span>'}</div>
      </div>
      <b style="font-size:18px">Recent orders</b>${table(['Order', 'Placed', 'Location', 'Customer', 'Delivery', 'Status', 'Total'], S.orders.filter((o) => o.loc === l.id).map(orderRow))}`;
  };

  V.verify = () => `${head('Verification', 'Documents restaurants submitted · approve before a location can go live')}
    <div class="note n-g sm-t">We check the minimum: food permit (document), sales tax ID (number) and business details with EIN. Everything else the restaurant confirms in the partner agreement.</div>
    ${S.verify.map((v) => { const l = locById(v.loc); return `<div class="card pad col" style="${v.status === 'review' ? 'border-left:4px solid var(--o)' : ''}"><div class="row between wrap"><div><b style="font-size:17px">${esc(v.what)}</b><div class="mut sm-t">${esc(locLabel(l))} · ${esc(l.juris)}</div></div>${vpill(v.status)}</div>
      <div class="row wrap sm-t" style="gap:16px"><span><span class="mut">Number:</span> <b>${esc(v.number)}</b></span>${v.expires ? `<span><span class="mut">Expires:</span> ${v.expires}</span>` : ''}${v.file ? `<button class="btn gh" data-a="toastMsg" data-msg="Would open ${esc(v.file)} (prototype)" style="min-height:0;padding:0;font-size:13px">📄 ${esc(v.file)}</button>` : ''}</div>
      ${v.status === 'review' ? `<div class="row wrap"><button class="btn sm" data-a="vApprove" data-id="${v.id}" style="background:#0B3B6E">Approve</button><button class="btn ln sm" data-a="vRejectAsk" data-id="${v.id}" style="color:var(--red);border-color:var(--red)">Reject</button><button class="btn gh" data-a="toastMsg" data-msg="Would open the issuing agency's lookup (prototype)">Check with agency ↗</button></div>` : v.reason ? `<div class="note n-r sm-t">Rejected: ${esc(v.reason)}</div>` : ''}</div>`; }).join('')}`;

  V.dispatch = () => `${head('Dispatch and integrations', 'How orders get a courier after the restaurant accepts')}
    <div class="card col" style="gap:0;padding:4px 16px">${S.providers.map((p, i) => `<div class="row wrap" style="border-bottom:1px solid var(--line);padding:14px 0"><b style="width:28px;color:var(--o)">${i + 1}</b><span class="grow" style="min-width:200px"><b>${esc(p.name)}</b><span class="mut sm-t" style="display:block">${esc(p.role)} · ${esc(p.state)} · typical price ${money(p.quote)}</span></span>${sw(`data-a="provToggle" data-i="${i}" ${p.state === 'Pending approval' ? 'disabled' : ''}`, p.on, p.name)}<button class="btn gh" data-a="provUp" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">▲</button><button class="btn gh" data-a="provDown" data-i="${i}" ${i === S.providers.length - 1 ? 'disabled' : ''} aria-label="Move down">▼</button><button class="btn ln sm" data-a="toastMsg" data-msg="Test delivery quote: ${money(p.quote)} (sandbox)">Test quote</button></div>`).join('')}</div>
    <div class="card pad col"><b style="font-size:17px">Rules</b>
      <label class="row">${sw('data-m="dispatchRules.auto"', S.dispatchRules.auto, 'Auto dispatch')}Request a courier automatically right after the restaurant accepts</label>
      <label class="row">${sw('data-m="dispatchRules.ownFirst"', S.dispatchRules.ownFirst, 'Own drivers first')}Offer to Send Koro drivers first within <input class="in" data-m="dispatchRules.ownRadius" value="${esc(S.dispatchRules.ownRadius)}" style="width:70px;height:36px"> miles</label>
      <label class="row">If no courier after <input class="in" data-m="dispatchRules.fallbackMin" value="${esc(S.dispatchRules.fallbackMin)}" style="width:70px;height:36px"> minutes, try the next provider</label>
      <button class="btn sm" data-a="toastMsg" data-msg="Dispatch rules saved." style="align-self:flex-start">Save rules</button>
      <span class="mut sm-t">Delivery fee = courier quote + markup (see <button class="btn gh" data-a="tabTo" data-to="pricing" style="min-height:0;padding:0;font-size:13px">Delivery pricing</button>). Customers only ever see “Delivery fee”.</span></div>
    ${tiles([tile('Push notifications', '<span style="color:#0B3B6E">Working</span>', 'Firebase · last sent 1 min ago'), tile('Text messages', '<span style="color:#0B3B6E">Working</span>', 'Sign-in codes and order updates'), tile('Stripe webhooks', '<span style="color:#0B3B6E">Healthy</span>', 'Last event 20 s ago · 0 failures'), tile('Uber Direct webhooks', '<span style="color:#0B3B6E">Healthy</span>', 'Sandbox')])}`;

  V.drivers = () => `${head('Drivers', `${DRIVERS.filter((d) => d.status === 'active').length} active · ${DRIVERS.filter((d) => d.online).length} online · ${DRIVERS.filter((d) => d.status === 'applied').length} applied`)}
    <div class="note n-g sm-t">Drivers keep 100% of locked pay and tips. No fees and no subscription. The NYC minimum is topped up weekly under Settlements.</div>
    ${table(['Driver', 'Vehicle', 'Status', 'Online', 'Stripe payouts', 'This week', ''], DRIVERS.map((d) => `<tr>${td(`<b>${esc(d.name)}</b>${d.applied ? `<span class="mut sm-t" style="display:block">Applied ${d.applied}</span>` : ''}${d.reason ? `<span class="mut sm-t" style="display:block">${esc(d.reason)}</span>` : ''}`)}${td(esc(d.vehicle))}${td(d.status === 'active' ? '<span class="pill p-g">Active</span>' : d.status === 'applied' ? '<span class="pill p-o">Applied</span>' : '<span class="pill p-r">Suspended</span>')}${td(d.online ? '<b style="color:#0B3B6E">● Online</b>' : '<span class="mut">Offline</span>')}${td(d.stripe ? 'Ready' : '<span class="pill p-r">Not set up</span>')}${td(d.trips ? `${d.trips} trips · ${money(d.locked + d.tips)}` : '—')}${td(d.status === 'applied' ? `<button class="btn sm" data-a="drvApprove" data-id="${d.id}" ${d.stripe ? '' : 'disabled'}>Approve</button>` : d.status === 'active' ? `<button class="btn ln sm" data-a="drvSuspend" data-id="${d.id}" style="color:var(--red);border-color:var(--red)">Suspend</button>` : `<button class="btn ln sm" data-a="drvReinstate" data-id="${d.id}">Reinstate</button>`)}</tr>`), 860)}`;

  V.customers = () => `${head('Customers', `${CUSTOMERS.length} customers`)}
    ${table(['Customer', 'Phone', 'Orders', 'Spent', 'Since', 'Status', ''], CUSTOMERS.map((c) => `<tr>${td(`<b>${esc(c.name)}</b>${c.flag ? `<span class="pill p-r" style="margin-left:6px">${esc(c.flag)}</span>` : ''}`)}${td(c.phone)}${td(c.orders)}${td(money(c.spent))}${td(c.since)}${td(c.blocked ? '<span class="pill p-r">Blocked</span>' : '<span class="pill p-g">Active</span>')}${td(`<div class="row"><button class="btn ln sm" data-a="custOrders" data-id="${c.id}">Orders</button><button class="btn gh" data-a="custBlock" data-id="${c.id}" style="color:${c.blocked ? 'var(--gx)' : 'var(--red)'}">${c.blocked ? 'Unblock' : 'Block'}</button></div>`)}</tr>`), 820)}`;

  V.payouts = () => { const accts = {}; LOCS.forEach((l) => { const k = l.stripe; (accts[k] = accts[k] || []).push(l); });
    return `${head('Restaurant payouts', 'Food money is charged directly on each restaurant’s Stripe account and paid out by Stripe')}
    ${table(['Stripe account', 'Locations', 'Last payout', 'Next payout', 'Status'], Object.entries(accts).map(([k, ls]) => { const off = k.includes('not connected'); const vol = ls.reduce((a, l) => a + l.octNet, 0); return `<tr>${td(`<span class="sm-t" style="font-family:monospace">${esc(k)}</span>`)}${td(ls.map((l) => esc(locLabel(l))).join('<br>'))}${td(off ? '—' : `Nov 3 · ${money(Math.round(vol / 4.4))}`)}${td(off ? '—' : 'Mon Nov 10')}${td(off ? '<span class="pill p-r">Not connected</span>' : '<span class="pill p-g">Payouts on</span>')}</tr>`; }), 820)}
    <span class="mut sm-t">Send Koro never holds restaurant food money. These are read from each connected account.</span>`; };

  V.settlements = () => {
    const rows = DRIVERS.filter((d) => d.trips).map((d) => { const min = Math.round(d.hours * NYC_MIN); const top = Math.max(0, min - d.locked); const st = S.driverPay[d.id] || 'pending'; return `<tr>${td(`<b>${esc(d.name)}</b>`)}${td(d.trips)}${td(d.hours.toFixed(1) + ' h')}${td(money(d.locked))}${td(money(d.tips))}${td(money(min))}${td(top ? `<b style="color:var(--o2)">${money(top)}</b>` : '$0.00')}${td(st === 'transferred' ? '<span class="pill p-g">Transferred</span>' : st === 'failed' ? '<span class="pill p-r">Failed</span>' : '<span class="pill p-o">Pending</span>')}${td(st === 'transferred' ? '' : `<button class="btn sm" data-a="payDriver" data-id="${d.id}">${st === 'failed' ? 'Retry now' : 'Transfer'}</button>`)}</tr>`; });
    return `${head('Driver and courier settlements', 'Calculated every Monday for the previous week')}
      <b style="font-size:18px">Own drivers · week of Oct 27</b>
      ${table(['Driver', 'Trips', 'Trip hours', 'Locked pay', 'Tips (100%)', 'NYC minimum ($22.13/h)', 'Top-up', 'Stripe', ''], rows, 980)}
      <span class="mut sm-t">Top-up = minimum − locked pay, if positive. Tips never count toward the minimum and are never reduced.</span>
      <b style="font-size:18px">Third-party courier invoices</b>
      ${table(['Delivery ID', 'Provider', 'Order', 'Quoted', 'Billed', 'Tip on invoice', 'Status', ''], S.invoices3p.map((x, i) => { const o = ord(x.order); const tipOk = !o || o.T === x.tip; return `<tr>${td(`<span style="font-family:monospace">${x.id}</span>`)}${td(x.provider)}${td(`<button class="btn gh" data-a="detail" data-id="${x.order}" style="min-height:0;padding:0">${x.order}</button>`)}${td(money(x.quoted))}${td(x.billed !== x.quoted ? `<b style="color:var(--red)">${money(x.billed)}</b>` : money(x.billed))}${td(money(x.tip) + (tipOk ? '' : ' <span class="pill p-r">Tip differs</span>'))}${td(x.status === 'matched' ? '<span class="pill p-g">Reconciled</span>' : x.status === 'mismatch' ? '<span class="pill p-r">Billed above quote</span>' : x.status === 'disputed' ? '<span class="pill p-o">Disputed</span>' : '<span class="pill p-n">Not reconciled</span>')}${td(x.status === 'matched' ? '' : x.status === 'mismatch' ? `<div class="row"><button class="btn ln sm" data-a="invAccept" data-i="${i}">Accept</button><button class="btn ln sm" data-a="invDispute" data-i="${i}">Dispute</button></div>` : x.status === 'unreconciled' ? `<button class="btn sm" data-a="invReconcile" data-i="${i}">Reconcile</button>` : '')}</tr>`; }), 940)}
      <span class="mut sm-t">The full tip goes through the provider’s tip field. Couriers are paid on the provider’s invoice, not through Stripe Connect.</span>`;
  };

  V.billing = () => {
    const live = LOCS.filter((l) => l.status === 'live');
    const plans = live.reduce((a, l) => a + (l.free ? 0 : planFor(l.octNet)), 0);
    const day = S.orders.filter((o) => !['declined', 'cancelled', 'waiting'].includes(o.status));
    const app = day.reduce((a, o) => a + o.appFee, 0); const courier = day.reduce((a, o) => a + (o.provider === 'Own driver' ? o.locked + o.T + o.payout : o.provider === 'Pickup' ? 0 : o.P + o.T + o.payout), 0); const markupSum = day.reduce((a, o) => a + o.markup + o.payout, 0);
    const tips = day.reduce((a, o) => a + o.T, 0); const share = day.reduce((a, o) => a + o.share, 0);
    return `${head('Billing and platform money', 'Restaurant plans are per location, from each location’s own net food sales')}
      ${tiles([tile('November plans billed', money(plans), `${live.filter((l) => !l.free).length} locations · Nov 1, 12:00 PM ET`), tile('Food commission', '$0.00', 'Always'), tile('Application fees (orders shown)', money(app), 'Delivery money after its fee share'), tile('Paid to couriers', money(courier), `incl. ${money(tips)} tips, 100% passed on`)])}
      ${unpaidQueue()}
      <div class="row between wrap"><b style="font-size:18px">Restaurant plans · November 2026</b><div class="row wrap"><button class="btn ln sm" data-a="tierDry">Dry run December tier job</button><button class="btn sm" data-a="toastMsg" data-msg="The December job runs on Dec 1 at 12:00 PM ET. Prototype: nothing was charged.">Run now (sandbox)</button></div></div>
      ${S.tierRun ? `<div class="note n-g sm-t"><b>Dry run for December</b> (from November sales so far): ${S.tierRun.map(([n, a]) => `${esc(n)} ${money(a)}`).join(' · ')}. Nothing was charged.</div>` : ''}
      ${table(['Location', 'Status', 'October net food sales', 'Tier', 'November plan', 'Payment', ''], LOCS.map((l) => `<tr>${td(`<b>${esc(l.brand)}</b><span class="mut sm-t" style="display:block">${esc(l.name)}</span>`)}${td(statusLoc(l))}${td(l.status === 'live' ? money(l.octNet) : '—')}${td(l.status !== 'live' ? '—' : l.free ? 'First month' : tierName(l.octNet))}${td(planCell(l))}${td(l.status !== 'live' || l.free ? '—' : l.payFail ? '<span class="pill p-r">Failed · Stripe retrying</span>' : '<span class="pill p-g">Paid</span>')}${td(l.payFail ? `<button class="btn ln sm" data-a="retryPlan" data-id="${l.id}">Retry now</button>` : '')}</tr>`), 900)}
      <div class="card pad col" style="gap:2px"><b style="margin-bottom:6px">Platform money on the orders shown</b><div class="rw"><span class="mut">Application fees taken</span><span>${money(app)}</span></div><div class="rw"><span class="mut">Processing share borne by delivery money</span><span>${money(share)}</span></div><div class="rw"><span class="mut">Courier companies and own drivers (incl. tips)</span><span>${money(-courier)}</span></div><div class="rw tot"><span>Delivery result</span><span>${money(app - courier)}</span></div><div class="rw"><span class="mut">Delivery markup collected (card + payout fees)</span><span>${money(markupSum)}</span></div><span class="mut sm-t">The delivery fee includes a markup for the card fee on the delivery money and, for own drivers, the payout fee, so third-party deliveries break even. Own-driver deliveries can still differ when the driver’s locked pay differs from the courier quote. Plans are the platform’s revenue.</span></div>`;
  };
  const RVX = window.SK_REVIEWS;
  V.reviews = () => {
    const rows = Object.entries(RVX.LOCS).map(([k, L]) => { const l = locById(L.admin); const sm = RVX.summary(k); const open = S.reviews.filter((r) => r.loc === k && r.complaint && r.complaint.status === 'open'); const serious = open.some((r) => r.issues.some((x) => RVX.SERIOUS.includes(x)));
      const health = serious ? ['p-r', 'Action needed'] : sm.rating < 4.3 || sm.rate > 2 ? ['p-o', 'Watch'] : ['p-g', 'Good'];
      return { k, L, l, sm, open, serious, health }; }).sort((a, b) => (b.serious - a.serious) || (b.sm.rate - a.sm.rate));
    const q = S.rvq; const items = S.reviews.filter((r) => r.complaint && (q === 'all' || (q === 'open' ? r.complaint.status === 'open' : q === 'serious' ? r.issues.some((x) => RVX.SERIOUS.includes(x)) : r.complaint.status !== 'open')));
    const openN = S.reviews.filter((r) => r.complaint && r.complaint.status === 'open').length;
    const act = (r) => { const L = RVX.LOCS[r.loc]; const l = locById(L.admin); return r.complaint.status === 'open' ? `<div class="row wrap" style="gap:6px"><button class="btn sm" data-a="cmpSet" data-id="${r.id}" data-v="resolved">Resolve</button><button class="btn ln sm" data-a="cmpSet" data-id="${r.id}" data-v="warned">Warn restaurant</button>${l && l.status === 'live' ? `<button class="btn ln sm" data-a="cmpPause" data-id="${r.id}" style="color:var(--red);border-color:var(--red)">Pause location</button>` : ''}<button class="btn gh sm" data-a="cmpSet" data-id="${r.id}" data-v="dismissed">No action</button><button class="btn gh sm" data-a="cmpSet" data-id="${r.id}" data-v="removed">Remove review</button></div>` : `<button class="btn gh sm" data-a="cmpSet" data-id="${r.id}" data-v="open">Reopen</button>`; };
    return `${head('Ratings and complaints', 'Every restaurant’s rating, customer complaints and the action taken')}
      ${tiles([tile('Open complaints', String(openN), 'Reply to the customer within 24 hours'), tile('Allergen or hygiene', String(S.reviews.filter((r) => r.complaint && r.complaint.status === 'open' && r.issues.some((x) => RVX.SERIOUS.includes(x))).length), 'Open · always reviewed by a person'), tile('Restaurants to watch', String(rows.filter((x) => x.health[1] !== 'Good').length), 'Rating under 4.3, complaints over 2% or serious open'), tile('Warnings in 90 days', String(Object.values(S.warnings).reduce((a, n) => a + n, 0)), 'Shown to the restaurant in its portal')])}
      <b style="font-size:18px">Restaurant health</b>
      ${table(['Location', 'Rating', 'Complaints (90 days)', 'Rate', 'Open', 'Warnings', 'Health', 'Status', ''], rows.map((x) => `<tr>${td(`<b>${esc(x.L.name)}</b><span class="mut sm-t" style="display:block">${esc(x.L.area)}</span>`)}${td(`<b>★ ${x.sm.rating.toFixed(1)}</b><span class="mut sm-t" style="display:block">${x.sm.count.toLocaleString('en-US')} ratings</span>`)}${td(`<span class="sm-t">${x.sm.complaints.slice(0, 3).map(([k, n]) => `${esc(RVX.LABEL[k])} ${n}`).join(' · ') || '—'}</span>`)}${td(`<b style="color:${x.sm.rate > 2 ? 'var(--red)' : '#0B3B6E'}">${x.sm.rate.toFixed(1)}%</b>`)}${td(String(x.open.length))}${td(String(S.warnings[x.L.admin] || 0))}${td(`<span class="pill ${x.health[0]}">${x.health[1]}</span>`)}${td(x.l ? statusLoc(x.l) : '—')}${td(x.l ? `<button class="btn ln sm" data-a="locOpen" data-id="${x.l.id}">Open</button>` : '')}</tr>`), 980)}
      <span class="mut sm-t">Rules: complaints are checked with the restaurant before any action. Serious complaints (allergen, hygiene) get a same-day review. Two confirmed serious complaints in 90 days, or a complaint rate over 5% for a month, pause the location until the owner meets the Send Koro team. Rating alone never deactivates a restaurant.</span>
      <div class="row between wrap"><b style="font-size:18px">Complaints</b><div class="chips" role="tablist">${[['open', 'Open'], ['serious', 'Allergen or hygiene'], ['closed', 'Closed'], ['all', 'All']].map(([k, l]) => `<button class="chip ${q === k ? 'on' : ''}" role="tab" aria-selected="${q === k}" data-a="rvQ" data-v="${k}">${l}</button>`).join('')}</div></div>
      <div class="rv-list">${items.map((r) => RVX.cardHTML(r, 'admin', { actions: act(r) })).join('') || '<span class="mut">No complaints here.</span>'}</div>`;
  };
  const unpaidQueue = () => { const q = LOCS.filter((l) => l.unpaid);
    const rv = { new: '<span class="pill p-r">Needs review</span>', contacted: '<span class="pill p-o">Contacted</span>', done: '<span class="pill p-g">Reviewed</span>', paid: '<span class="pill p-g">Paid · live again</span>' };
    return `<div class="card pad col" style="gap:8px;border-color:${q.some((l) => l.unpaid.review === 'new') ? 'var(--red)' : 'var(--line)'}"><div class="row between wrap"><b style="font-size:18px">Unpaid plans · human review</b><span class="pill ${q.some((l) => l.unpaid.review === 'new') ? 'p-r' : 'p-g'}">${q.filter((l) => l.unpaid.review === 'new').length} to review</span></div>
      <span class="mut sm-t">When a plan invoice is still unpaid after the last automatic retry, the restaurant’s locations on that invoice are deactivated automatically (no new orders, hidden from customers; accepted orders finish). The restaurant is told by email, text and a portal banner, and the account lands here. Paying the invoice reactivates the locations automatically. Food payouts are never held back.</span>
      ${q.length ? table(['Restaurant', 'Invoice', 'Amount', 'Deactivated', 'Restaurant told', 'Review', ''], q.map((l) => `<tr>${td(`<b>${esc(l.brand)}</b><span class="mut sm-t" style="display:block">${esc(l.name)} · ${esc(l.owner)}</span>`)}${td(`${esc(l.unpaid.invoice)}<span class="mut sm-t" style="display:block">${l.unpaid.tries} retries failed</span>`)}${td(`<b>${money(l.unpaid.amount)}</b>`)}${td(`<span class="sm-t">${esc(l.unpaid.since)}</span>`)}${td(`<span class="sm-t">${esc(l.unpaid.notified)}</span>`)}${td(l.status === 'live' && l.unpaid.review === 'done' ? '<span class="pill p-g">Reactivated by admin</span>' : rv[l.unpaid.review])}${td(l.status !== 'unpaid' ? '' : `<div class="row wrap" style="gap:6px"><button class="btn ln sm" data-a="unpaidContact" data-id="${l.id}">Contact</button><button class="btn ln sm" data-a="unpaidPaid" data-id="${l.id}">Mark paid (sandbox)</button><button class="btn sm" data-a="unpaidReactivate" data-id="${l.id}">Reactivate</button>${l.unpaid.review !== 'done' ? `<button class="btn gh sm" data-a="unpaidDone" data-id="${l.id}">Keep deactivated</button>` : ''}</div>`)}</tr>`), 900) : '<span class="mut">No unpaid plans.</span>'}</div>`; };
  const tierName = (n) => { const i = TIERS.findIndex((t) => n <= t[0]); return i === 0 ? 'Up to $2,500' : i === TIERS.length - 1 ? 'Over $15,000' : `$${(TIERS[i - 1][0] / 100).toLocaleString()}–$${(TIERS[i][0] / 100).toLocaleString()}`; };

  V.taxes = () => {
    const states = [['New York City, NY', 'Open', 'No', 'p-g'], ['New York State', 'Later', 'No', 'p-n'], ['California', 'Later', 'No', 'p-n'], ['New Jersey', 'Legal review', 'Check', 'p-o'], ['Texas', 'Legal review', 'Check', 'p-o'], ['Florida', 'Legal review', 'Check', 'p-o'], ['Georgia', 'Blocked', 'Yes, above $100k', 'p-r']];
    const capRows = LOCS.filter((l) => l.status === 'live' && !l.free).map((l) => { const pct = l.octNet ? (planFor(l.octNet) / l.octNet) * 100 : 100; return `<tr>${td(esc(locLabel(l)))}${td(money(l.octNet))}${td(money(planFor(l.octNet)))}${td(`<b style="color:${pct > 5 ? 'var(--red)' : '#0B3B6E'}">${pct.toFixed(1)}%</b>`)}${td(pct > 5 ? '<span class="pill p-r">Above 5% · check</span>' : '<span class="pill p-g">OK</span>')}</tr>`; });
    return `${head('Taxes and compliance', 'Send Koro never collects, files or pays sales tax')}
      <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start">
        <div class="col" style="flex:1 1 420px;min-width:0"><b style="font-size:18px">Launch states</b>${table(['State', 'Status', 'Platform would collect tax?'], states.map(([s, st, c, p]) => `<tr>${td(s)}${td(`<span class="pill ${p}">${st}</span>`)}${td(c)}</tr>`), 420)}<span class="mut sm-t">Add a state only after legal review of its marketplace-facilitator law.</span></div>
        <div class="col" style="flex:1 1 360px"><b style="font-size:18px">NYC rules for delivery apps</b><div class="card pad col" style="gap:2px"><div class="rw"><span class="mut">DCWP third-party delivery license</span><span><b>${S.dcwp.license}</b></span></div><div class="rw"><span class="mut">Expires</span><span>${S.dcwp.expires}</span></div><div class="rw"><span class="mut">Written agreements on file</span><span>${LOCS.length} of ${LOCS.length}</span></div><div class="rw"><span class="mut">Restroom access confirmed</span><span>${LOCS.length - 1} of ${LOCS.length}</span></div><div class="rw"><span class="mut">Restaurant’s direct phone shown</span><span>Yes</span></div></div></div>
      </div>
      <b style="font-size:18px">Tax responsibility</b>${table(['Location', 'Accepted “I’m responsible for sales tax”', 'Sales tax ID'], LOCS.map((l) => `<tr>${td(esc(locLabel(l)))}${td(l.taxAccepted ? '<span class="pill p-g">Accepted</span>' : '<span class="pill p-r">Not accepted · can’t take orders</span>')}${td(vpill(l.taxId))}</tr>`), 620)}
      <b style="font-size:18px">NYC fee cap check (plan as % of last month’s food sales)</b>${table(['Location', 'October food sales', 'Plan', 'Plan ÷ sales', 'Against 5% basic fee cap'], capRows, 700)}
      <span class="mut sm-t">Whether a flat plan counts toward NYC’s per-order fee caps needs a lawyer’s answer. Low-sales locations are flagged so you can decide.</span>`;
  };

  V.pricing = () => {
    const p = S.pricingDraft || (S.pricingDraft = { ...PRICING });
    const ex = (P, own) => { const F = 3000, X = tax(3000), T = 540; const rs = (d) => Math.min(d, 300); const r = priceOrder(P, F, X, T, rs, own, p); const c0 = r.D - rs(r.D); const Q = F + X + c0 + T; const fee = feeOf(Q, p); const share = Math.min(r.D + T, Math.round((fee * (c0 + T)) / Q)); return { ...r, card: r.D - P - r.payout, Q, share, kept: r.D + T - share, cost: P + T + r.payout }; };
    const tp = ex(num(p.uberAvg), false); const own = ex(num(p.uberAvg), true);
    const inp = (k, label, unit) => `<label class="f">${label}<span class="row" style="gap:6px"><input class="in" id="pr-${k}" data-m="pricingDraft.${k}" data-live="1" inputmode="numeric" value="${esc(p[k])}" style="width:120px"><span class="mut sm-t">${unit}</span></span></label>`;
    return `${head('Delivery pricing', 'Admin only · the markup is never shown to customers or restaurants')}
      <div class="note n-w sm-t"><b>Customers and restaurants see one “Delivery fee” amount.</b> It already includes the markup below. Receipts, the restaurant portal and invoices never show the markup or the courier price.</div>
      <div class="card pad col"><label class="row">${sw('data-m="pricingDraft.on" data-rr="1"', p.on, 'Delivery markup')}<b>Add a markup to the delivery fee to cover card and payout fees</b></label><span class="mut sm-t">Off = the delivery fee is just the courier price and Send Koro absorbs these fees.</span></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px">
        <div class="card pad col"><b>Card fee (Stripe)</b>${inp('cardBps', 'Percentage', 'basis points (290 = 2.9%)')}${inp('cardFixed', 'Fixed per charge', 'cents')}<span class="mut sm-t">Only the delivery money’s share of the card fee is added.</span></div>
        <div class="card pad col"><b>Own drivers: payout fee</b>${inp('ownBps', 'Percentage of pay + tip', 'basis points (25 = 0.25%)')}${inp('ownFixed', 'Fixed per delivery', 'cents')}<span class="mut sm-t">Drivers always get their full pay and 100% of tips.</span></div>
        <div class="card pad col"><b>Third-party couriers: payout + settlement fee</b>${inp('tpBps', 'Percentage of quote + tip', 'basis points')}${inp('tpFixed', 'Fixed per delivery', 'cents')}<span class="mut sm-t">Money is paid out to Send Koro’s bank, then settled to Uber Direct or DoorDash.</span></div>
        <div class="card pad col"><b>Typical courier quotes</b>${inp('uberAvg', 'Uber Direct', 'cents')}${inp('ddAvg', 'DoorDash Drive', 'cents')}<span class="mut sm-t">Used for examples here. Real orders use each live quote.</span></div>
      </div>
      <b style="font-size:18px">Live example: $30.00 food, $5.40 tip, restaurant pays $3.00</b>
      ${table(['', 'Third-party courier', 'Own driver'], [
        ['Courier price (hidden)', money(num(p.uberAvg)), money(num(p.uberAvg))], ['+ Payout fee (hidden)', money(tp.payout), money(own.payout)], ['+ Card fee markup (hidden)', money(tp.card), money(own.card)],
        ['<b>Delivery fee customers and restaurants see</b>', `<b>${money(tp.D)}</b>`, `<b>${money(own.D)}</b>`], ['Customer total', money(tp.Q), money(own.Q)],
        ['Send Koro keeps after the card fee', money(tp.kept), money(own.kept)], ['Courier + tip + payout fee', money(tp.cost), money(own.cost)], ['<b>Result</b>', `<b>${money(tp.kept - tp.cost)}</b>`, `<b>${money(own.kept - own.cost)}</b>`],
      ].map((row) => `<tr>${row.map((x, i) => td(x, i ? 'text-align:right' : '')).join('')}</tr>`), 560)}
      <div class="row wrap"><button class="btn" data-a="pricingSave">Save pricing</button><button class="btn ln" data-a="pricingReset">Undo changes</button></div>
      <span class="mut sm-t">Saved settings apply to new quotes only. Orders already placed keep the price the customer agreed to.</span>`;
  };

  // ---------- delivery zones and rules (admin only), modelled on Uber Eats / DoorDash: the platform sets the radius, not the restaurant ----------
  const courierQuoteA = (mi) => Math.max(650, 550 + Math.round(85 * mi));
  const ZONE_OF = { 'Jackson Heights': 1 }; // everything else in the demo is Brooklyn; Hoboken has no area
  const zoneOfLoc = (l) => (l.juris !== 'NYC' ? null : S.zones[ZONE_OF[l.name] ?? 0]);
  const radiusOfLoc = (l) => { const z = zoneOfLoc(l); if (!z) return null; const cap = Math.min(num(z.maxMi), num(S.zoneRules.maxMi)); const o = parseFloat(S.locRadius[l.id]); return o > 0 ? Math.min(o, cap) : cap; };
  // NYC fee caps (DCWP): the delivery part of what a delivery app charges a restaurant ≤ 15% of the order's purchase price.
  const nycCap = (food) => Math.floor((food * num(S.zoneRules.nycCapPct)) / 100);
  V.zones = () => {
    const Z = S.zones; const G = S.zoneRules;
    const bandOf = (mi) => G.bands.findIndex((b) => mi <= num(b[0]));
    const feeRows = [0.5, 1, 2, 3, 4, 5, 6].map((mi) => { const P = courierQuoteA(mi); const r = priceOrder(P, 3000, tax(3000), 540, () => 0, false); const bi = bandOf(mi); const allowed = mi <= num(G.maxMi) && bi >= 0; return `<tr>${[`<b>${mi} mi</b>`, money(P), money(r.D - P - r.payout), money(r.payout), `<b>${money(r.D)}</b>`, allowed ? `Band ${bi + 1}${num(G.bands[bi][1]) ? ' · +' + G.bands[bi][1] + ' min' : ''}` : '—', allowed ? '<span class="pill p-g">Delivery</span>' : '<span class="pill p-r">Pickup only</span>'].map((x, i) => td(x, i > 0 && i < 5 ? 'text-align:right' : '')).join('')}</tr>`; });
    const bandRows = G.bands.map((b, i) => `<tr>${td(`<b>Band ${i + 1}</b><span class="mut sm-t" style="display:block">${i ? G.bands[i - 1][0] : '0'}–${esc(b[0])} mi</span>`)}${td(`<input class="in" id="zb-${i}-0" data-m="zoneRules.bands.${i}.0" data-live="1" inputmode="decimal" value="${esc(b[0])}" style="width:80px;height:38px" aria-label="Band ${i + 1} up to miles"> mi`)}${td(`<input class="in" id="zb-${i}-1" data-m="zoneRules.bands.${i}.1" inputmode="numeric" value="${esc(b[1])}" style="width:80px;height:38px" aria-label="Band ${i + 1} extra minutes"> min`)}${td(`$ <input class="in" id="zb-${i}-2" data-m="zoneRules.bands.${i}.2" inputmode="decimal" value="${esc(b[2])}" style="width:80px;height:38px" aria-label="Band ${i + 1} minimum order">`)}</tr>`);
    const capEx = [[1500, 200], [3000, 300], [3000, 848], [6000, 848]].map(([F, R]) => { const cap = nycCap(F); const ok = R <= cap; return `<tr>${[money(F), money(R), money(cap), G.nycCapOn ? (ok ? '<span class="pill p-g">Within cap</span>' : `<span class="pill p-o">Restaurant pays ${money(cap)}, customer ${money(R - cap)}</span>`) : (ok ? '<span class="pill p-g">Within cap</span>' : '<span class="pill p-r">Over the cap</span>')].map((x, i) => td(x, i < 3 ? 'text-align:right' : '')).join('')}</tr>`; });
    const locRows = LOCS.filter((l) => zoneOfLoc(l)).map((l) => { const z = zoneOfLoc(l); const o = S.locRadius[l.id]; return `<tr>${td(`<button class="btn gh" data-a="locOpen" data-id="${l.id}" style="min-height:0;padding:0;text-align:left"><b>${esc(locLabel(l))}</b></button>`)}${td(esc(z.name.split(' (')[0]))}${td(o ? `<b>${radiusOfLoc(l)} mi</b> <span class="pill p-n">Custom</span>` : `${radiusOfLoc(l)} mi <span class="mut sm-t">area default</span>`)}${td(z.weather ? '<span class="pill p-o">Paused (weather)</span>' : l.status === 'live' ? '<span class="pill p-g">Delivering</span>' : '<span class="mut">Not live</span>')}</tr>`; });
    return `${head('Delivery zones and rules', 'Admin only · Send Koro sets every delivery radius, like Uber Eats and DoorDash. Restaurants can’t change it.')}
      <div class="note n-g sm-t"><b>Restaurants don’t set delivery areas.</b> Their portal only has Open/Close and “Accepting orders”. Every radius, band and pause below is Send Koro’s, applied to all locations in the area unless a location has a custom (smaller) radius.</div>
      <b style="font-size:18px">Service areas</b>
      ${table(['Area', 'Status', 'Delivery radius', 'Locations live', 'Couriers', 'Bad weather', ''], Z.map((z, i) => `<tr>${td(`<b>${esc(z.name)}</b><span class="mut sm-t" style="display:block">${esc(z.zips)}</span>`)}${td(z.on ? '<span class="pill p-g">Open</span>' : '<span class="pill p-n">Coming soon</span>')}${td(`<span style="white-space:nowrap"><input class="in" data-m="zones.${i}.maxMi" value="${esc(z.maxMi)}" style="width:64px;height:36px" aria-label="Radius in miles for ${esc(z.name)}"> mi</span>`)}${td(z.live)}${td(z.on ? 'Uber Direct · DoorDash · own drivers' : '—')}${td(z.on ? (z.weather ? '<span class="pill p-o">Delivery paused</span>' : '<span class="mut">Normal</span>') : '—')}${td(`<div class="row"><button class="btn ln sm" data-a="zoneOpen" data-i="${i}">${z.on ? 'Close area' : 'Open area'}</button>${z.on ? `<button class="btn gh" data-a="zoneWeather" data-i="${i}">${z.weather ? 'Resume delivery' : 'Pause for weather'}</button>` : ''}</div>`)}</tr>`), 980)}
      <span class="mut sm-t">Radius is straight-line distance from the restaurant, as on DoorDash. Manhattan is tighter because trips are slower. Pausing for weather turns delivery off for every restaurant in the area; pickup stays open.</span>
      <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start">
        <div class="card pad col" style="flex:1 1 380px;min-width:0"><b style="font-size:17px">Distance bands (every area)</b>
          <span class="mut sm-t">Farther bands get a longer delivery estimate and can have a minimum order. Bands stop at each area’s radius. There is no extra distance fee: the courier’s quote already grows with distance.</span>
          <div style="overflow-x:auto">${table(['', 'Up to', 'Extra time', 'Minimum order'], bandRows, 420)}</div>
          <label class="f">Longest delivery allowed anywhere (miles)<input class="in" id="zr-max" data-m="zoneRules.maxMi" data-live="1" inputmode="decimal" value="${esc(G.maxMi)}" style="width:120px"></label></div>
        <div class="card pad col" style="flex:1 1 320px"><b style="font-size:17px">Availability rules</b>
          <label class="f">Hide delivery when courier time + prep is over (minutes)<input class="in" id="zr-eta" data-m="zoneRules.maxEtaMin" inputmode="numeric" value="${esc(G.maxEtaMin)}" style="width:120px"></label>
          <label class="f">Stop delivery orders before closing (minutes)<input class="in" id="zr-stop" data-m="zoneRules.stopBeforeMin" inputmode="numeric" value="${esc(G.stopBeforeMin)}" style="width:120px"></label>
          <label class="row">${sw('data-m="zoneRules.shrinkOn" data-rr="1"', G.shrinkOn, 'Shrink radius when busy')}Shrink the radius when couriers are scarce</label>
          ${G.shrinkOn ? `<div class="row wrap sm-t">When courier wait is over <input class="in" data-m="zoneRules.shrinkWaitMin" value="${esc(G.shrinkWaitMin)}" style="width:64px;height:36px" aria-label="Wait minutes"> min, deliver only within <input class="in" data-m="zoneRules.shrinkToMi" value="${esc(G.shrinkToMi)}" style="width:64px;height:36px" aria-label="Shrunk radius miles"> mi</div>` : ''}
          <label class="row">${sw('data-m="zoneRules.noCourierPickup"', G.noCourierPickup, 'No courier')}If no courier is available, show pickup only</label></div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start">
        <div class="card pad col" style="flex:1 1 300px;min-width:0"><b style="font-size:17px">Delivery fee (what customers and restaurants see)</b>
          <div class="card pad col" style="gap:2px;background:var(--bg)"><div class="rw"><span>Courier quote <span class="mut sm-t">hidden</span></span><span>P</span></div><div class="rw"><span>+ Card processing share <span class="mut sm-t">hidden</span></span><span>2.9% + 30¢ share</span></div><div class="rw"><span>+ Payout cost <span class="mut sm-t">hidden</span></span><span>0.25% + 25¢</span></div><div class="rw" style="border-top:1px solid var(--line);padding-top:6px"><b>= Delivery fee</b><b>D</b></div></div>
          <span class="sm-t"><b>Send Koro adds nothing else:</b> no service fee, no small-order fee, no busy-time or surge fee, no distance fee. The courier’s own quote may rise at busy times. Rates are set on <button class="btn gh" data-a="tabTo" data-to="pricing" style="min-height:0;padding:0;font-size:13px">Delivery pricing</button>.</span></div>
        <div class="col" style="flex:3 1 640px;min-width:0"><b style="font-size:17px">Delivery fee by distance</b>${table(['Distance', 'Courier quote', 'Card share', 'Payout', 'Delivery fee', 'Band', 'Allowed'], feeRows, 700)}<span class="mut sm-t">Example $30 order, $5.40 tip, customer pays the fee, third-party courier. Real orders use each live quote. Own drivers are offered the courier quote (P) and keep 100% of tips.</span></div>
      </div>
      <b style="font-size:18px">NYC rules</b>
      <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start">
        <div class="card pad col" style="flex:1 1 380px;min-width:0"><b>Fee caps on what restaurants pay (DCWP)</b>
          <div class="card pad col" style="gap:2px;background:var(--bg)"><div class="rw"><span class="mut">Delivery</span><b>15% of the order</b></div><div class="rw"><span class="mut">Basic service (listing)</span><b>5%</b></div><div class="rw"><span class="mut">Card processing</span><b>3%</b></div><div class="rw"><span class="mut">Enhanced service (optional)</span><b>20%</b></div></div>
          <label class="row">${sw('data-m="zoneRules.nycCapOn" data-rr="1"', G.nycCapOn, 'NYC 15% cap')}Limit a restaurant’s share of the delivery fee to 15% of the food; the customer pays the rest</label>
          <div style="overflow-x:auto">${table(['Food', 'Restaurant’s share', '15% cap', 'Result'], capEx, 460)}</div>
          <span class="mut sm-t">Send Koro charges $0 commission and no per-order fees, so the only per-order amount a restaurant can pay us is the delivery share it chooses. Whether the flat plan counts toward the 5% cap needs a lawyer’s answer (see Taxes and compliance).</span></div>
        <div class="card pad col" style="flex:1 1 320px"><b>Delivery workers (own drivers)</b>
          <span class="sm-t">✓ Every offer shows pickup and drop-off distance, route and locked pay before the driver accepts.</span>
          <span class="sm-t">✓ A driver’s own maximum distance and “no bridges or tunnels” setting are respected; those offers aren’t sent to them.</span>
          <span class="sm-t">✓ Declining an offer has no penalty.</span>
          <span class="sm-t">✓ Restaurants in the area confirm restroom access for couriers.</span>
          <span class="sm-t">✓ NYC minimum pay, topped up weekly; 100% of tips.</span></div>
      </div>
      <b style="font-size:18px">Locations and their radius</b>
      ${table(['Location', 'Area', 'Delivery radius', 'Delivery'], locRows, 620)}
      <span class="mut sm-t">Set a custom (smaller) radius on a location’s page, for example if food doesn’t travel well. It can never be larger than the area radius.</span>
      <button class="btn" data-a="zonesSave" style="align-self:flex-start">Save zones and rules</button>`;
  };

  // ---------- promotions across restaurants (restaurant-funded; Send Koro charges nothing) ----------
  V.promos = () => {
    const P = S.promos; const live = P.filter((p) => p.status === 'live');
    const pill = (p) => ({ live: '<span class="pill p-g">Live</span>', scheduled: '<span class="pill p-n">Scheduled</span>', paused: '<span class="pill p-o">Paused by admin</span>', ended: '<span class="pill p-n">Ended</span>' }[p.status]);
    return `${head('Promotions', 'Every restaurant’s offers · restaurants fund 100% of the discount, Send Koro charges nothing to run them')}
      ${tiles([tile('Live now', live.length, `${P.filter((p) => p.status === 'scheduled').length} scheduled`), tile('Orders with a promotion (30 days)', P.reduce((a, p) => a + p.orders, 0), ''), tile('Food sales on those orders', money(P.reduce((a, p) => a + p.sales, 0)), ''), tile('Discounts paid by restaurants', money(P.reduce((a, p) => a + p.cost, 0)), 'Send Koro cost: $0.00')])}
      ${table(['Restaurant', 'Promotion', 'When and who', 'Weekly budget', 'Orders', 'Discount paid', 'Status', ''], P.map((p, i) => `<tr>${td(`<button class="btn gh" data-a="locOpen" data-id="${p.loc}" style="min-height:0;padding:0;text-align:left"><b>${esc(locLabel(locById(p.loc)))}</b></button>`)}${td(`<b>${esc(p.type)}</b><span class="mut sm-t" style="display:block">${esc(p.detail)}</span>`)}${td(`${esc(p.when)}<span class="mut sm-t" style="display:block">${esc(p.audience)}</span>`)}${td(p.budget ? money(p.budget) : '<span class="mut">No cap</span>')}${td(p.orders, 'text-align:right')}${td(money(p.cost), 'text-align:right')}${td(pill(p))}${td(p.status === 'live' || p.status === 'paused' ? `<button class="btn ln sm" data-a="promoAdmin" data-i="${i}">${p.status === 'paused' ? 'Resume' : 'Pause'}</button>` : '')}</tr>`), 980)}
      <div class="note n-g sm-t"><b>Rules every promotion follows.</b> The restaurant pays the whole discount; there’s no marketing fee and no commission. One promotion per order: the customer gets the one that saves the most. Sales tax is charged on the price after the discount. Free delivery is the restaurant’s delivery share, so the NYC 15% cap applies. Pause a promotion only if it’s misleading or breaks a rule; the restaurant is told why.</div>`;
  };


  // Customer credit: referral and promo-code credit, its rules, and the monthly pay-back to restaurants.
  const CREDIT_RECON = [
    { loc: 'bbc-ps', orders: 3, used: 1500 }, { loc: 'dk-ken', orders: 9, used: 5000 }, { loc: 'koro', orders: 2, used: 1000 },
  ];
  V.credit = () => {
    const c = S.credit; const due = CREDIT_RECON.reduce((a, r) => a + r.used, 0);
    const field = (label, path, val, suffix, help) => `<label class="f">${label}<span class="row" style="gap:8px"><input class="in" data-m="${path}" inputmode="decimal" value="${esc(val)}" style="max-width:140px">${suffix ? `<span class="mut">${suffix}</span>` : ''}</span>${help ? `<span class="mut sm-t" style="font-weight:600">${help}</span>` : ''}</label>`;
    return `${head('Customer credit', 'Referral and promo-code credit · funded by Send Koro · paid back to restaurants on their monthly invoice')}
      ${tiles([tile('Credit given (30 days)', money(84500), '131 referrals · 852 promo codes'), tile('Credit used at checkout', money(61200), '14 locations'), tile('Credit expired unused', money(9500), 'After 30 days'), tile('Owed to restaurants · Dec 1', money(due), 'Credited on their plan invoices')])}
      <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start">
      <div class="card pad col" style="flex:1 1 360px"><div class="row between"><b style="font-size:18px">Refer-a-friend program</b>${sw('data-a="credToggle"', c.on, 'Referral program on')}</div>
        <span class="mut sm-t">Customer-facing offer: “Give $${(c.friend / 100).toFixed(0)}, get $${(c.referrer / 100).toFixed(0)}.”</span>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">
          ${field('Person who refers gets', 'credit.referrerIn', (c.referrer / 100).toFixed(2), 'USD')}
          ${field('New customer gets', 'credit.friendIn', (c.friend / 100).toFixed(2), 'USD')}
          ${field('Credit valid for', 'credit.daysIn', c.days, 'days')}
          ${field('Max referral rewards', 'credit.perMonthIn', c.perMonth, 'per person per month')}
        </div>
        <label class="f">Give the person who refers their credit when<select class="in" data-m="credit.when"><option value="firstOrder" ${c.when === 'firstOrder' ? 'selected' : ''}>The friend completes their first order (recommended)</option><option value="verified" ${c.when === 'verified' ? 'selected' : ''}>The friend creates an account and verifies their phone</option></select></label>
        <div class="col sm-t" style="gap:4px"><b>Always on</b><span>✓ Only phone-verified accounts can earn or use credit</span><span>✓ One referral reward per person, phone number, device and card</span><span>✓ Internet (VoIP) and temporary numbers can’t earn rewards</span><span>✓ Credit can only be used at checkout · no cash value · can’t be transferred</span><span>✓ At least $0.50 of every order is paid by card (Stripe minimum)</span></div>
        <button class="btn sm" data-a="credSave" style="align-self:flex-start">Save program</button></div>
      <div class="card pad col" style="flex:1 1 360px;gap:0"><b style="font-size:18px;margin-bottom:6px">Promo codes</b>${c.codes.map((pc, i) => `<div class="row wrap" style="border-top:1px solid var(--line);padding:10px 0;gap:10px"><span class="grow"><b>${esc(pc.code)}</b> · ${money(pc.cents)} credit<span class="mut sm-t" style="display:block">${pc.uses} used${pc.limit ? ` of ${pc.limit}` : ''} · ends ${esc(pc.until)} · once per customer</span></span>${sw(`data-a="codeToggle" data-i="${i}"`, pc.on, 'Code ' + pc.code + ' active')}</div>`).join('')}
        <div class="row wrap" style="border-top:1px solid var(--line);padding-top:12px;gap:8px"><input class="in" data-m="credit.newCode" placeholder="NEWCODE" value="${esc(c.newCode)}" style="max-width:160px;text-transform:uppercase"><span class="row" style="gap:6px">$<input class="in" data-m="credit.newCents" inputmode="decimal" value="${esc(c.newCents)}" style="max-width:80px"></span><button class="btn sm" data-a="codeAdd">Add code</button></div>
        <span class="mut sm-t" style="margin-top:8px">Promo-code credit follows the same rules: phone-verified accounts only, valid ${c.days} days, checkout only.</span></div>
      </div>
      <div class="row between wrap"><b style="font-size:18px">Pay-back to restaurants · November 2026</b><button class="btn ln sm" data-a="toastMsg" data-msg="Prototype: the Dec 1 invoices will carry these credits. Any amount above a plan fee is sent to the restaurant’s Stripe account.">Preview Dec 1 run</button></div>
      ${table(['Location', 'Orders with credit', 'Credit used', 'December plan', 'Paid back on invoice', 'Sent to Stripe account'], CREDIT_RECON.map((r) => { const l = locById(r.loc); const plan = l && l.status === 'live' ? planFor(l.octNet) : 0; const onInv = Math.min(plan, r.used); return `<tr>${td(`<b>${esc(l ? l.brand : r.loc)}</b><span class="mut sm-t" style="display:block">${esc(l ? l.name : '')}</span>`)}${td(r.orders)}${td(`<b>${money(r.used)}</b>`)}${td(money(plan))}${td(money(-onInv))}${td(r.used > onInv ? money(r.used - onInv) : '—')}</tr>`; }))}
      <div class="note n-g sm-t"><b>How credit moves money.</b> The customer’s card is charged the order total minus the credit, on the restaurant’s own Stripe account, so the restaurant receives less at the time of the order. Send Koro pays that back as a credit line on the restaurant’s next monthly plan invoice (“Send Koro promo credit”). If the credit is more than the plan fee, the rest is sent to the restaurant’s Stripe account in the same run. Couriers always get their full pay and 100% of tips. Every receipt and the restaurant’s order screen show the credit as its own line.</div>`;
  };
  V.admins = () => `${head('Admins', 'People who can sign in to this console', '<button class="btn sm" data-a="adminAdd">+ Add admin</button>')}
    ${table(['Name', 'Mobile', 'Status', ''], S.admins.map((a, i) => `<tr>${td(`<b>${esc(a.name)}</b>${a.you ? ' <span class="pill p-n">You</span>' : ''}`)}${td(esc(a.phone))}${td(a.on ? '<span class="pill p-g">Active</span>' : '<span class="pill p-n">Disabled</span>')}${td(a.you ? '' : `<button class="btn ln sm" data-a="adminToggle" data-i="${i}">${a.on ? 'Disable' : 'Enable'}</button>`)}</tr>`), 560)}
    <span class="mut sm-t">Admins sign in with a text code. Disabling someone signs them out everywhere.</span>`;

  // ---------- modals ----------
  function modal() {
    const md = S.modal; if (!md) return '';
    const wrap = (inner) => `<div class="overlay"><div class="sheet" role="dialog" aria-modal="true">${inner}</div></div>`;
    if (md.type === 'refund') {
      const o = ord(md.id); const r = md.r; const left = (k, cap) => cap - o.refunded[k];
      const field = (k, label, cap, dis, note) => `<label class="f">${label} <span class="mut" style="font-weight:600">· up to ${money(left(k, cap))}${note ? ' · ' + note : ''}</span><input class="in" id="rf-${k}" data-m="modal.r.${k}" inputmode="decimal" value="${esc(r[k])}" ${dis ? 'disabled' : ''}></label>`;
      const c = (k) => Math.round((parseFloat(r[k]) || 0) * 100);
      const charge = c('food') + c('tax') + c('cdel') + c('tip'); const appRefund = c('cdel') + c('subsidy') + c('tip');
      return wrap(`<h2 style="font-size:22px">Refund ${o.id} by component</h2><span class="mut sm-t">Each part comes from the right place. Food and tax come from the restaurant; delivery parts are returned from the application fee.</span>
        ${field('food', 'Food', o.F)}${field('tax', 'Tax', o.X)}${field('cdel', 'Customer delivery (C)', o.C, false, o.status === 'delivered' ? 'only if delivery failed or by decision' : '')}${field('subsidy', 'Restore restaurant subsidy (R)', o.R, false, 'goes back to the restaurant')}${field('tip', 'Tip', o.T, o.tipSettled, o.tipSettled ? 'already paid to the courier · can’t be clawed back' : '')}
        <label class="f">Reason<input class="in" id="rf-reason" data-m="modal.reason" value="${esc(md.reason || '')}" placeholder="e.g. Missing item"></label>
        <div class="card pad col" style="gap:2px"><div class="rw"><span class="mut">Refund on the charge (back to customer’s card)</span><b>${money(charge)}</b></div><div class="rw"><span class="mut">Application fee refund (platform → restaurant)</span><b>${money(appRefund)}</b></div><div class="rw"><span class="mut">Lowers the restaurant’s plan base by</span><span>${money(c('food'))}</span></div></div>
        <button class="btn" data-a="refundDo">Refund ${money(charge)}</button><button class="btn gh" data-a="closeModal">Cancel</button>`);
    }
    if (md.type === 'reject') return wrap(`<h2 style="font-size:22px">Reject this document?</h2><label class="f">Tell the restaurant why<select class="in" data-m="modal.reason">${['Document is unreadable', 'Number doesn’t match the agency record', 'Expired', 'Wrong business name or address', 'Other'].map((x) => `<option ${md.reason === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label><button class="btn" data-a="vRejectDo" style="background:var(--red)">Reject and notify</button><button class="btn gh" data-a="closeModal">Cancel</button>`);
    if (md.type === 'reply') return wrap(`<h2 style="font-size:22px">${md.reject ? 'Reject ticket' : 'Reply to customer'} · ${md.id}</h2><label class="f">Message (sent by text)<textarea class="in" id="tk-msg" data-m="modal.msg">${esc(md.msg)}</textarea></label><button class="btn" data-a="ticketSend">${md.reject ? 'Reject and send' : 'Send reply'}</button><button class="btn gh" data-a="closeModal">Cancel</button>`);
    if (md.type === 'admin') return wrap(`<h2 style="font-size:22px">Add an admin</h2><label class="f">Name<input class="in" id="ad-name" data-m="modal.name" value="${esc(md.name)}"></label><label class="f">Mobile number<input class="in" id="ad-phone" data-m="modal.phone" inputmode="tel" value="${esc(md.phone)}"></label><button class="btn" data-a="adminDo">Add admin</button><button class="btn gh" data-a="closeModal">Cancel</button>`);
    return '';
  }

  // ---------- frame ----------
  const NAV = [['Run', [['ops', 'Operations'], ['orders', 'Orders'], ['support', 'Support'], ['dispatch', 'Dispatch']]], ['Partners', [['restaurants', 'Restaurants'], ['verify', 'Verification'], ['drivers', 'Drivers'], ['customers', 'Customers'], ['reviews', 'Ratings and complaints'], ['promos', 'Promotions'], ['credit', 'Customer credit']]], ['Money', [['payouts', 'Payouts'], ['settlements', 'Settlements'], ['billing', 'Billing']]], ['Compliance', [['taxes', 'Taxes and compliance']]], ['Settings', [['zones', 'Delivery zones'], ['pricing', 'Delivery pricing'], ['admins', 'Admins']]]];
  const PARENT = { orderDetail: 'orders', restaurantDetail: 'restaurants' };
  const badge = (k) => ({ support: S.tickets.filter((t) => t.status === 'open').length, verify: S.verify.filter((v) => v.status === 'review').length, orders: S.orders.filter((o) => o.stuck && o.status === 'preparing').length }[k] || 0);
  function sidebar() {
    const cur = PARENT[S.screen] || S.screen;
    return `<aside style="background:var(--g);color:#fff;padding:18px 12px;display:flex;flex-direction:column;gap:2px;width:236px;flex:none;position:sticky;top:0;height:100vh;overflow-y:auto">
      <span class="logo" style="font-size:20px;padding:4px 8px 4px">${LOGO('', 40)}${WORD}</span><span style="padding:0 8px 10px"><span class="pill p-o">Admin console</span></span>
      ${NAV.map(([g, items]) => `<span style="font-size:11px;font-weight:800;letter-spacing:.1em;color:#BFD3EA;padding:10px 12px 4px">${g.toUpperCase()}</span>` + items.map(([k, l]) => `<button data-a="tabTo" data-to="${k}" aria-current="${cur === k ? 'page' : 'false'}" style="display:flex;align-items:center;gap:8px;height:40px;padding:0 12px;border:0;border-radius:10px;text-align:left;font-weight:700;background:${cur === k ? 'rgba(255,255,255,.14)' : 'transparent'};color:#fff;${cur === k ? 'box-shadow:inset 3px 0 0 #E3242B' : ''}"><span class="grow">${l}</span>${badge(k) ? `<span class="pill" style="background:#FF7A2E;color:var(--g)">${badge(k)}</span>` : ''}</button>`).join('')).join('')}
      <span class="grow" style="min-height:12px"></span>
      <div style="padding:10px;border-radius:12px;background:rgba(255,255,255,.08);font-size:13px;display:flex;flex-direction:column;gap:4px"><b>Shakib Haider</b><span style="color:#BFD3EA">Sandbox mode · no live money</span><button data-a="signOut" style="border:0;background:none;color:#fff;text-decoration:underline;text-align:left;padding:0;font-weight:700">Sign out</button></div></aside>`;
  }
  const PAGES = [['signin', 'Sign in'], ['ops', 'Operations'], ['orders', 'Orders'], ['orderDetail', 'Order details'], ['support', 'Support'], ['dispatch', 'Dispatch'], ['restaurants', 'Restaurants'], ['restaurantDetail', 'Restaurant details'], ['verify', 'Verification'], ['drivers', 'Drivers'], ['customers', 'Customers'], ['reviews', 'Ratings and complaints'], ['promos', 'Promotions'], ['credit', 'Customer credit'], ['payouts', 'Payouts'], ['settlements', 'Settlements'], ['billing', 'Billing'], ['taxes', 'Taxes and compliance'], ['zones', 'Delivery zones'], ['pricing', 'Delivery pricing'], ['admins', 'Admins']];
  const pagesBar = () => `<nav class="pages" aria-label="Open a page"><span class="pages-l">Open a page</span>${PAGES.map(([k, l], i) => `<button data-a="page" data-k="${k}" class="${S.screen === k ? 'on' : ''}">${i + 1}. ${l}</button>`).join('')}</nav>`;
  let last;
  function render(top) {
    const winKeep = !top && last === S.screen ? window.scrollY : 0;
    const act = document.activeElement && document.activeElement.id; let caret = null; try { caret = act ? document.activeElement.selectionStart : null; } catch (e) { caret = null; }
    const ov = modal() + (S.toast ? `<div class="toast" role="status">${esc(S.toast)}</div>` : '');
    const content = (V[S.screen] || V.ops)();
    if (S.screen === 'signin') root.innerHTML = `<div class="web">${pagesBar()}${content}${ov}</div>`;
    else root.innerHTML = `<div class="web rw-shell" style="display:flex;min-height:100vh;background:var(--bg)">${sidebar()}<div class="col grow" style="min-width:0;gap:0"><div class="demo"><b>Prototype.</b> Pretend data, sandbox only. No real money moves.</div>${pagesBar()}<main class="scr col" style="padding:24px max(16px,env(safe-area-inset-right,0px)) 32px 24px;gap:16px;overflow:visible;flex:1">${content}<footer class="mut sm-t" style="border-top:1px solid var(--line);padding-top:14px;margin-top:auto">Send Koro admin · Sandbox · © 2026 Send Koro, New York, NY</footer></main></div>${ov}</div>`;
    last = S.screen; window.scrollTo(0, winKeep);
    if (act) { const el = document.getElementById(act); if (el) { el.focus(); try { if (caret != null) el.setSelectionRange(caret, caret); } catch (e) { /* not text */ } } }
  }
  function setPath(path, val) { const p = path.split('.'); let o = S; while (p.length > 1) o = o[p.shift()]; o[p[0]] = val; }
  root.addEventListener('input', (e) => { const t = e.target; if (!t.dataset.m) return; setPath(t.dataset.m, t.type === 'checkbox' ? t.checked : t.value); if (t.dataset.live || (t.type === 'checkbox' && t.dataset.rr) || (S.modal && S.modal.type === 'refund' && t.dataset.m.startsWith('modal.r.'))) render(); });
  root.addEventListener('change', (e) => { const t = e.target; if (t.dataset.m && t.tagName === 'SELECT') { setPath(t.dataset.m, t.value); if (t.dataset.rr) render(); } });

  const A = {
    rvQ: (d) => { S.rvq = d.v; render(); },
    cmpSet: (d) => { const r = S.reviews.find((x) => x.id === d.id); const L = RVX.LOCS[r.loc]; r.complaint.status = d.v;
      const msg = { resolved: ['Resolved. The customer was told; refund any money from the order page.', 'Resolved by Send Koro.'], warned: [`Warning sent to ${L.name} · ${L.area} by email and in its portal.`, 'Warning sent to the restaurant.'], dismissed: ['Closed with no action. The customer was told why.', 'Checked: no action needed.'], removed: ['Review removed from the restaurant page (breaks the Community Guidelines).', 'Review removed for breaking the Community Guidelines.'], open: ['Reopened.', ''] }[d.v];
      if (d.v === 'warned') S.warnings[L.admin] = (S.warnings[L.admin] || 0) + 1; r.complaint.action = msg[1]; toast(msg[0]); render(); },
    cmpPause: (d) => { const r = S.reviews.find((x) => x.id === d.id); const L = RVX.LOCS[r.loc]; const l = locById(L.admin); if (l) l.status = 'paused'; r.complaint.status = 'warned'; r.complaint.action = 'Location paused by Send Koro pending review.'; S.warnings[L.admin] = (S.warnings[L.admin] || 0) + 1; toast(`${L.name} · ${L.area} paused. It stops taking orders until you reinstate it on its page.`); render(); },
    back, go: (d) => go(d.to), tabTo: (d) => tabTo(d.to), toastMsg: (d) => toast(d.msg), closeModal: () => { S.modal = null; render(); },
    sendCode: () => { if (S.phone.replace(/\D/g, '').length !== 10) return toast('Enter a 10-digit mobile number.'); S.codeSent = true; toast('Code sent (prototype: any 6 digits work).'); render(); },
    changePhone: () => { S.codeSent = false; render(); },
    verify: () => { if (!/^\d{6}$/.test(S.code)) return toast('Enter the 6-digit code.'); S.signedIn = true; S.codeSent = false; S.code = ''; tabTo('ops'); },
    signOut: () => { S.signedIn = false; S.screen = 'signin'; render(true); },
    detail: (d) => go('orderDetail', { detailId: d.id }),
    custOrders: (d) => { S.filter = { status: 'all', provider: 'all', q: cust(d.id).name }; go('orders'); },
    custBlock: (d) => { const c = cust(d.id); c.blocked = !c.blocked; toast(`${c.name} ${c.blocked ? 'blocked. They can’t place orders.' : 'unblocked.'}`); render(); },
    redispatch: (d) => { const o = ord(d.id); o.provider = 'DoorDash Drive'; o.stuck = false; o.deliveryId = 'dd_' + o.id.slice(2) + 'Q'; o.status = 'courier'; o.timeline.push(['Re-sent to DoorDash Drive · courier assigned', Date.now()]); toast(`${o.id} sent to DoorDash Drive. Courier assigned.`); render(); },
    cancelOrder: () => { const o = ord(S.detailId); o.status = 'cancelled'; o.timeline.push(['Cancelled by admin · hold released', Date.now()]); toast('Order cancelled. The hold on the customer’s card was released.'); render(); },
    refundAsk: (d, t, e, pre) => { const o = ord(S.detailId); S.modal = { type: 'refund', id: o.id, r: pre || { food: '', tax: '', cdel: '', subsidy: '', tip: '' }, reason: '' }; render(); },
    refundDo: () => {
      const md = S.modal; const o = ord(md.id); const c = (k) => Math.round((parseFloat(md.r[k]) || 0) * 100);
      const caps = { food: o.F, tax: o.X, cdel: o.C, subsidy: o.R, tip: o.T };
      for (const k of Object.keys(caps)) { if (c(k) < 0) return toast('Amounts can’t be negative.'); if (c(k) > caps[k] - o.refunded[k]) return toast(`That’s more than is left to refund for ${k === 'cdel' ? 'customer delivery' : k}.`); }
      if (o.tipSettled && c('tip')) return toast('The tip was already paid to the courier.');
      const charge = c('food') + c('tax') + c('cdel') + c('tip'); if (!charge && !c('subsidy')) return toast('Enter an amount to refund.');
      if (!String(md.reason || '').trim()) return toast('Add a reason.');
      Object.keys(caps).forEach((k) => { o.refunded[k] += c(k); }); o.refundTotal = (o.refundTotal || 0) + charge;
      o.timeline.push([`Refunded ${money(charge)} · ${md.reason}`, Date.now()]);
      if (md.ticket) { const tk = S.tickets.find((x) => x.id === md.ticket); tk.status = 'resolved'; tk.resolution = `Refunded ${money(charge)} (${md.reason})`; }
      S.modal = null; toast(`Refunded ${money(charge)} to the customer’s card.`); render();
    },
    ticketRefund: (d) => { const tk = S.tickets.find((x) => x.id === d.id); const f = tk.items.reduce((a, x) => a + x[1], 0); S.detailId = tk.order; S.modal = { type: 'refund', id: tk.order, ticket: tk.id, r: { food: f ? (f / 100).toFixed(2) : '', tax: f ? (tax(f) / 100).toFixed(2) : '', cdel: '', subsidy: '', tip: '' }, reason: tk.kind }; render(); },
    ticketReply: (d) => { S.modal = { type: 'reply', id: d.id, msg: 'Hi, thanks for letting us know. We’re looking into this with the restaurant.' }; render(); },
    ticketReject: (d) => { S.modal = { type: 'reply', id: d.id, reject: true, msg: 'We checked with the restaurant and couldn’t confirm the issue, so we can’t refund this one.' }; render(); },
    ticketSend: () => { const md = S.modal; const tk = S.tickets.find((x) => x.id === md.id); if (md.reject) { tk.status = 'resolved'; tk.resolution = 'Rejected: ' + md.msg; } S.modal = null; toast(md.reject ? 'Ticket rejected. Customer notified.' : 'Reply sent by text.'); render(); },
    locOpen: (d) => go('restaurantDetail', { locId: d.id }),
    locSet: (d) => { const l = locById(S.locId); l.status = d.v; toast(`${locLabel(l)} is now ${d.v}.`); render(); },
    locLive: () => { const l = locById(S.locId); l.status = 'live'; l.free = true; toast(`${locLabel(l)} is live. First month free.`); render(); },
    vApprove: (d) => { const v = S.verify.find((x) => x.id === d.id); v.status = 'verified'; const l = locById(v.loc); if (/Permit/.test(v.what)) l.permit = 'verified'; if (/Sales tax/.test(v.what)) l.taxId = 'verified'; toast(`Approved: ${v.what} for ${locLabel(l)}.`); render(); },
    vRejectAsk: (d) => { S.modal = { type: 'reject', id: d.id, reason: 'Document is unreadable' }; render(); },
    vRejectDo: () => { const v = S.verify.find((x) => x.id === S.modal.id); v.status = 'rejected'; v.reason = S.modal.reason; const l = locById(v.loc); if (/Permit/.test(v.what)) l.permit = 'rejected'; if (/Sales tax/.test(v.what)) l.taxId = 'rejected'; S.modal = null; toast('Rejected. The restaurant was notified with the reason.'); render(); },
    provToggle: (d) => { const p = S.providers[+d.i]; p.on = !p.on; toast(`${p.name} ${p.on ? 'on' : 'off'}.`); render(); },
    provUp: (d) => { const i = +d.i; [S.providers[i - 1], S.providers[i]] = [S.providers[i], S.providers[i - 1]]; render(); },
    provDown: (d) => { const i = +d.i; [S.providers[i + 1], S.providers[i]] = [S.providers[i], S.providers[i + 1]]; render(); },
    drvApprove: (d) => { const x = drv(d.id); x.status = 'active'; toast(`${x.name} approved. They can go online now.`); render(); },
    drvSuspend: (d) => { const x = drv(d.id); x.status = 'suspended'; x.online = false; x.reason = 'Suspended by admin'; toast(`${x.name} suspended.`); render(); },
    drvReinstate: (d) => { const x = drv(d.id); x.status = 'active'; x.reason = ''; toast(`${x.name} reinstated.`); render(); },
    payDriver: (d) => { S.driverPay[d.id] = 'transferred'; toast(`Transferred to ${drv(d.id).name} (sandbox). Once per driver per week.`); render(); },
    invReconcile: (d) => { const x = S.invoices3p[+d.i]; x.status = x.billed === x.quoted ? 'matched' : 'mismatch'; toast(x.status === 'matched' ? 'Invoice line matches the quote and tip.' : 'Billed amount differs from the quote.'); render(); },
    invAccept: (d) => { S.invoices3p[+d.i].status = 'matched'; toast('Accepted the billed amount.'); render(); },
    invDispute: (d) => { S.invoices3p[+d.i].status = 'disputed'; toast('Dispute sent to the provider.'); render(); },
    credToggle: () => { S.credit.on = !S.credit.on; toast(S.credit.on ? 'Referral program is on.' : 'Referral program is off. Existing credit still works until it expires.'); render(); },
    credSave: () => {
      const c = S.credit; const cents = (v, d) => { const n = Math.round(parseFloat(String(v ?? '').replace(/[$,]/g, '')) * 100); return Number.isFinite(n) ? n : d; };
      const ref = cents(c.referrerIn, c.referrer), fr = cents(c.friendIn, c.friend), days = parseInt(c.daysIn ?? c.days, 10), pm = parseInt(c.perMonthIn ?? c.perMonth, 10);
      if (ref < 0 || fr < 0 || ref > 5000 || fr > 5000) return toast('Rewards must be between $0 and $50.');
      if (!(days >= 1 && days <= 365)) return toast('Credit must be valid for 1 to 365 days.');
      if (!(pm >= 1 && pm <= 100)) return toast('Max referral rewards must be 1 to 100 a month.');
      Object.assign(c, { referrer: ref, friend: fr, days, perMonth: pm }); toast('Saved. New rewards use these amounts; credit already given keeps its own expiry.'); render();
    },
    codeToggle: (d) => { const pc = S.credit.codes[+d.i]; pc.on = !pc.on; toast(`${pc.code} ${pc.on ? 'turned on' : 'paused'}.`); render(); },
    codeAdd: () => { const c = S.credit; const code = c.newCode.trim().toUpperCase(); const cents = Math.round(parseFloat(c.newCents) * 100); if (!/^[A-Z0-9]{4,16}$/.test(code)) return toast('Codes are 4–16 letters or numbers.'); if (c.codes.some((x) => x.code === code)) return toast('That code already exists.'); if (!(cents > 0 && cents <= 5000)) return toast('Credit must be between $0.01 and $50.'); c.codes.unshift({ code, cents, uses: 0, limit: 0, on: true, until: 'in 30 days' }); c.newCode = ''; toast(`${code} added.`); render(); },
    tierDry: () => { S.tierRun = LOCS.filter((l) => l.status === 'live').map((l) => [locLabel(l), planFor(Math.round(l.octNet * 0.3))]); toast('Dry run done. Nothing was charged.'); render(); },
    unpaidContact: (d) => { const l = locById(d.id); l.unpaid.review = 'contacted'; toast(`Reminder sent to ${l.owner} by email and text with a link to pay.`); render(); },
    unpaidPaid: (d) => { const l = locById(d.id); l.unpaid.review = 'paid'; l.status = 'live'; toast(`${locLabel(l)} paid ${money(l.unpaid.amount)}. Reactivated automatically (sandbox).`); render(); },
    unpaidReactivate: (d) => { const l = locById(d.id); l.unpaid.review = 'done'; l.status = 'live'; toast(`${locLabel(l)} reactivated by admin. The invoice stays open and is retried.`); render(); },
    unpaidDone: (d) => { const l = locById(d.id); l.unpaid.review = 'done'; toast(`Reviewed. ${locLabel(l)} stays deactivated until the invoice is paid.`); render(); },
    retryPlan: (d) => { const l = locById(d.id); l.payFail = false; toast(`Payment retried and succeeded for ${locLabel(l)} (sandbox).`); render(); },
    promoAdmin: (d) => { const p = S.promos[+d.i]; p.status = p.status === 'paused' ? 'live' : 'paused'; toast(p.status === 'paused' ? `Paused “${p.type}” at ${locLabel(locById(p.loc))}. The restaurant gets a text and an email with the reason.` : `Resumed “${p.type}” at ${locLabel(locById(p.loc))}.`); render(); },
    zoneOpen: (d) => { const z = S.zones[+d.i]; z.on = !z.on; toast(`${z.name} ${z.on ? 'is open for orders.' : 'is closed. Its restaurants stop showing to customers.'}`); render(); },
    zoneWeather: (d) => { const z = S.zones[+d.i]; z.weather = !z.weather; toast(z.weather ? `Delivery paused in ${z.name}. Pickup stays open.` : `Delivery resumed in ${z.name}.`); render(); },
    zonesSave: () => { const G = S.zoneRules; let prev = 0; for (const b of G.bands) { const mi = parseFloat(b[0]); if (!(mi > prev)) return toast('Each band must end farther than the one before.'); if (!(parseFloat(b[2]) >= 0) || !(parseInt(b[1], 10) >= 0)) return toast('Enter minutes and a minimum order (0 for none).'); prev = mi; } if (prev > parseFloat(G.maxMi)) return toast('The last band can’t go past the longest delivery allowed.'); if (S.zones.some((z) => !(parseFloat(z.maxMi) > 0) || parseFloat(z.maxMi) > parseFloat(G.maxMi))) return toast(`Each area radius must be between 0 and ${G.maxMi} mi.`); toast('Delivery zones and rules saved. Customers see the change right away.'); render(); },
    locRadiusSave: (d) => { const v = String(S.locRadius[d.id] ?? '').trim(); const l = locById(d.id); const z = zoneOfLoc(l); if (v && !(parseFloat(v) > 0)) return toast('Enter miles, or leave empty for the area default.'); if (v && parseFloat(v) > num(z.maxMi)) return toast(`${z.name.split(' (')[0]} radius is ${z.maxMi} mi. A location can only be smaller.`); if (!v) delete S.locRadius[d.id]; toast(v ? `${locLabel(l)} now delivers within ${v} mi.` : `${locLabel(l)} uses the area radius.`); render(); },
    pricingSave: () => { const p = S.pricingDraft; for (const k of ['cardBps', 'cardFixed', 'ownBps', 'ownFixed', 'tpBps', 'tpFixed', 'uberAvg', 'ddAvg']) if (!/^\d+$/.test(String(p[k]).trim())) return toast('Use whole numbers only.'); Object.assign(PRICING, p); S.pricingDraft = null; toast('Delivery pricing saved. New orders use it.'); render(); },
    pricingReset: () => { S.pricingDraft = null; render(); },
    adminAdd: () => { S.modal = { type: 'admin', name: '', phone: '' }; render(); },
    adminDo: () => { const m = S.modal; if (m.name.trim().length < 2) return toast('Enter a name.'); if (m.phone.replace(/\D/g, '').length !== 10) return toast('Enter a 10-digit mobile number.'); S.admins.push({ name: m.name.trim(), phone: m.phone, on: true }); S.modal = null; toast(`${m.name.trim()} can now sign in.`); render(); },
    adminToggle: (d) => { const a = S.admins[+d.i]; a.on = !a.on; toast(`${a.name} ${a.on ? 'enabled' : 'disabled and signed out'}.`); render(); },
  };
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-a]'); if (!t || !root.contains(t)) return;
    const fn = A[t.dataset.a]; if (!fn) return;
    if (!(t.tagName === 'INPUT' && (t.type === 'checkbox' || t.type === 'radio'))) e.preventDefault();
    fn(t.dataset, t, e);
  });
  function openPage(k) {
    S.modal = null; S.stack = []; if (k !== 'signin') S.signedIn = true; else { S.signedIn = false; S.codeSent = false; }
    if (k === 'orderDetail') { S.detailId = 'SK1053'; S.stack = ['orders']; }
    if (k === 'restaurantDetail') { S.locId = 'sh'; S.stack = ['restaurants']; }
    S.screen = k; try { history.replaceState(null, '', '#' + k); } catch (e) { /* ignore */ } render(true);
  }
  A.page = (d) => openPage(d.k);
  const h = (location.hash || '').slice(1);
  if (PAGES.some((p) => p[0] === h)) openPage(h); else render(true);
})();
