// Send Koro ratings, reviews and complaints: shared by the customer, restaurant and admin prototypes.
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const PRAISE = [['tasty', 'Tasty'], ['fresh', 'Hot and fresh'], ['packed', 'Well packed'], ['portion', 'Good portions'], ['accurate', 'Order was right'], ['value', 'Good value']];
  const ISSUES = [['missing', 'Missing item'], ['wrong', 'Wrong item'], ['cold', 'Food was cold'], ['quality', 'Food quality'], ['packaging', 'Spilled or poor packaging'], ['late', 'Long wait for food'], ['price', 'Price different from menu'], ['allergen', 'Allergen or dietary issue'], ['hygiene', 'Hygiene concern']];
  const SERIOUS = ['allergen', 'hygiene'];
  const LABEL = Object.fromEntries([...PRAISE, ...ISSUES]);
  // One row per location. ids are the customer app's restaurant ids; admin = admin console id; branch = restaurant portal branch id.
  const LOCS = {
    bbc: { admin: 'bbc-ps', branch: 'b1', name: 'Brooklyn Bowl Co.', area: 'Park Slope', rating: 4.8, count: 1240, dist: [82, 11, 4, 1, 2], orders90: 1960, complaints: { missing: 6, cold: 3, packaging: 2, late: 2 } },
    'bbc-wb': { admin: 'bbc-wb', branch: 'b2', name: 'Brooklyn Bowl Co.', area: 'Williamsburg', rating: 4.7, count: 310, dist: [78, 13, 5, 2, 2], orders90: 540, complaints: { missing: 2, late: 1 } },
    dhaka: { admin: 'dk-ken', name: 'Dhaka Kitchen', area: 'Kensington', rating: 4.8, count: 930, dist: [84, 9, 3, 2, 2], orders90: 2410, complaints: { missing: 4, wrong: 2, late: 3 } },
    'dhaka-jh': { admin: 'dk-jh', name: 'Dhaka Kitchen', area: 'Jackson Heights', rating: 4.9, count: 1120, dist: [90, 6, 2, 1, 1], orders90: 610, complaints: { missing: 1 } },
    koro: { admin: 'koro', name: 'Koro Ramen', area: 'Prospect Heights', rating: 4.7, count: 520, dist: [79, 12, 5, 2, 2], orders90: 1520, complaints: { cold: 4, packaging: 3 } },
    burger: { admin: 'bbg', name: 'Brooklyn Burger Co.', area: 'Fort Greene', rating: 4.6, count: 940, dist: [74, 14, 6, 3, 3], orders90: 2280, complaints: { wrong: 5, missing: 4, allergen: 1, cold: 2 } },
    atl: { admin: 'atl', name: 'Atlantic Pizza Co.', area: 'Boerum Hill', rating: 4.7, count: 1260, dist: [80, 12, 4, 2, 2], orders90: 3900, complaints: { late: 6, cold: 3, missing: 2 } },
    wings: { admin: 'fw', name: 'Flatbush Wings', area: 'Flatbush', rating: 4.1, count: 410, dist: [58, 16, 9, 6, 11], orders90: 690, complaints: { quality: 7, hygiene: 2, cold: 5, missing: 4, price: 2 } },
    green: { admin: 'gl', name: 'Green Leaf Salads', area: 'Cobble Hill', rating: 4.6, count: 320, dist: [76, 14, 5, 2, 3], orders90: 1120, complaints: { missing: 2, quality: 1 } },
  };
  const R = (id, loc, order, who, date, stars, praise, issues, text, extra = {}) => ({ id, loc, order, who, date, stars, praise, issues, text, reply: null, complaint: null, verified: true, ...extra });
  const SEED = [
    R('rv1', 'bbc', 'SK1052', 'Maya R.', 'Nov 9', 5, ['tasty', 'fresh', 'packed'], [], 'Best chicken bowl in Park Slope. Still warm when it arrived and nothing spilled.', { reply: { text: 'Thank you, Maya! See you next time.', date: 'Nov 9' } }),
    R('rv2', 'bbc', 'SK1049', 'Jordan T.', 'Nov 8', 2, [], ['missing'], 'No avocado even though I paid for it. Rest of the bowl was good.', { complaint: { status: 'resolved', detail: 'Paid $2.50 for avocado, it was not in the bag.', action: 'Send Koro refunded $2.50 (paid by the restaurant). Restaurant reminded to check add-ons.' } }),
    R('rv3', 'bbc', 'SK1044', 'Priya S.', 'Nov 6', 4, ['portion', 'value'], [], 'Big portions for the price. Salmon was a bit dry this time.'),
    R('rv4', 'bbc', 'SK1041', 'Chris D.', 'Nov 5', 1, [], ['cold', 'packaging'], 'Lid came off, sauce everywhere and the food was cold.', { complaint: { status: 'open', detail: 'Bag was soaked, could not eat half of it.', action: '' } }),
    R('rv5', 'bbc', 'SK1037', 'Ana L.', 'Nov 3', 5, ['accurate', 'tasty'], [], 'Exactly what I ordered, and the harvest salad is great.'),
    R('rv6', 'bbc', 'SK1031', 'Sam K.', 'Oct 31', 3, [], ['late'], 'Tasty but the food took 40 minutes to be ready.', { reply: { text: 'Sorry about the wait, Sam. We had a rush that night and have added a second cook on Fridays.', date: 'Nov 1' } }),
    R('rv7', 'dhaka', 'SK1040', 'Rashed A.', 'Nov 7', 5, ['tasty', 'portion'], [], 'Kacchi tastes like home. Generous portion.'),
    R('rv8', 'dhaka', 'SK1033', 'Leah M.', 'Nov 2', 2, [], ['wrong'], 'Got beef tehari instead of chicken.', { complaint: { status: 'resolved', detail: 'Wrong main dish.', action: 'Send Koro refunded the dish (paid by the restaurant).' } }),
    R('rv9', 'dhaka-jh', 'SK1046', 'Imran H.', 'Nov 8', 5, ['fresh', 'accurate'], [], 'Fast and hot.'),
    R('rv10', 'koro', 'SK1043', 'Ken W.', 'Nov 6', 4, ['tasty'], ['packaging'], 'Great broth, a little spilled.'),
    R('rv11', 'burger', 'SK1048', 'Tara B.', 'Nov 8', 1, [], ['allergen'], 'Asked for no cheese (allergy) and it came with cheese.', { complaint: { status: 'open', detail: 'Dairy allergy written in the kitchen note. Burger had cheese. I did not eat it.', action: '' } }),
    R('rv12', 'burger', 'SK1039', 'Omar F.', 'Nov 4', 5, ['tasty', 'fresh'], [], 'Smash burger was perfect.'),
    R('rv13', 'atl', 'SK1045', 'Nina P.', 'Nov 7', 4, ['tasty', 'value'], ['late'], 'Great pizza, slow on a Friday.'),
    R('rv14', 'wings', 'SK1042', 'Devon J.', 'Nov 7', 1, [], ['hygiene', 'quality'], 'Found a hair in the wings. Not ordering again.', { complaint: { status: 'warned', detail: 'Hair in the food, photo attached.', action: 'Refunded. Warning sent to the restaurant on Nov 8.' } }),
    R('rv15', 'wings', 'SK1036', 'Bea C.', 'Nov 3', 2, [], ['cold', 'quality'], 'Wings were soggy and cold.', { complaint: { status: 'open', detail: 'Second bad order in a week.', action: '' } }),
    R('rv16', 'green', 'SK1038', 'Lily Z.', 'Nov 5', 5, ['fresh', 'packed'], [], 'Crisp and fresh.'),
  ];
  const NOTICES = [{ loc: 'wings', date: 'Nov 8', text: 'Warning: a hygiene complaint (hair in food) was confirmed. Another confirmed hygiene complaint within 90 days pauses this location for review.' }];
  const STATUS = { open: ['p-r', 'Send Koro is reviewing'], resolved: ['p-g', 'Resolved'], warned: ['p-o', 'Warning issued'], removed: ['p-n', 'Review removed'], dismissed: ['p-n', 'Closed, no action'] };

  const starRow = (n, big) => `<span class="rv-stars${big ? ' big' : ''}" role="img" aria-label="${n} out of 5 stars">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= Math.round(n) ? 'on' : ''}">★</i>`).join('')}</span>`;
  const fmtCount = (n) => n.toLocaleString('en-US');
  // extra = reviews written in this session (customer prototype)
  function summary(loc, extra = []) {
    const L = LOCS[loc]; if (!L) return null;
    const mine = extra.filter((r) => r.loc === loc);
    const count = L.count + mine.length;
    const rating = mine.length ? (L.rating * L.count + mine.reduce((a, r) => a + r.stars, 0)) / count : L.rating;
    const c = { ...L.complaints }; mine.forEach((r) => r.issues.forEach((k) => { c[k] = (c[k] || 0) + 1; }));
    const list = Object.entries(c).sort((a, b) => b[1] - a[1]);
    const total = list.reduce((a, x) => a + x[1], 0);
    return { loc, name: L.name, area: L.area, rating: Math.round(rating * 10) / 10, count, dist: L.dist, complaints: list, total, orders: L.orders90 + mine.length, rate: (total / (L.orders90 + mine.length)) * 100 };
  }
  function summaryHTML(s) {
    return `<div class="rv-sum"><div class="rv-avg"><b>${s.rating.toFixed(1)}</b>${starRow(s.rating, true)}<span class="mut sm-t">${fmtCount(s.count)} ratings</span></div>
      <div class="rv-hist">${[5, 4, 3, 2, 1].map((n, i) => `<div class="rv-bar"><span>${n}★</span><i><em style="width:${s.dist[i]}%"></em></i><span class="mut">${s.dist[i]}%</span></div>`).join('')}</div></div>`;
  }
  function complaintsHTML(s) {
    return `<div class="rv-cmp"><div class="row between wrap" style="gap:6px"><b>Complaints in the last 90 days</b><span class="pill ${s.rate > 2 ? 'p-r' : s.rate > 1 ? 'p-o' : 'p-g'}">${s.total} from ${fmtCount(s.orders)} orders · ${s.rate.toFixed(1)}%</span></div>
      <div class="rv-tags">${s.complaints.length ? s.complaints.map(([k, n]) => `<span class="rv-tag bad${SERIOUS.includes(k) ? ' serious' : ''}">${esc(LABEL[k])} · ${n}</span>`).join('') : '<span class="mut sm-t">No complaints.</span>'}</div>
      <span class="mut sm-t">Complaints come only from customers with a completed order and are checked by Send Koro.</span></div>`;
  }
  // view: 'customer' | 'restaurant' | 'admin'
  function cardHTML(rv, view = 'customer', o = {}) {
    const L = LOCS[rv.loc] || {};
    if (rv.complaint && rv.complaint.status === 'removed' && view === 'customer') return '';
    const tags = [...rv.praise.map((k) => `<span class="rv-tag good">${esc(LABEL[k])}</span>`), ...rv.issues.map((k) => `<span class="rv-tag bad${SERIOUS.includes(k) ? ' serious' : ''}">${esc(LABEL[k])}</span>`)].join('');
    const st = rv.complaint && STATUS[rv.complaint.status];
    return `<article class="rv-card${rv.complaint && rv.complaint.status === 'removed' ? ' removed' : ''}"><div class="row between" style="gap:8px;align-items:flex-start"><span class="col" style="gap:2px;min-width:0"><b>${esc(rv.who)}${rv.mine ? ' (you)' : ''}</b><span class="mut sm-t">${esc(rv.date)}${rv.verified ? ' · Verified order' : ''}${view !== 'customer' ? ` · ${esc(rv.order)}` : ''}${view === 'admin' || o.showLoc ? ` · ${esc(L.name)} · ${esc(L.area)}` : ''}</span></span>${starRow(rv.stars)}</div>
      ${tags ? `<div class="rv-tags">${tags}</div>` : ''}${rv.text ? `<p class="rv-text">${esc(rv.text)}</p>` : ''}
      ${rv.complaint && view !== 'customer' ? `<div class="rv-private"><div class="row between wrap" style="gap:6px"><b class="sm-t">Complaint to Send Koro (not public)</b><span class="pill ${st[0]}">${st[1]}</span></div><span class="sm-t">${esc(rv.complaint.detail)}</span>${rv.complaint.action ? `<span class="sm-t mut">${esc(rv.complaint.action)}</span>` : ''}</div>` : ''}
      ${rv.complaint && view === 'customer' && rv.mine ? `<span class="sm-t mut">Your complaint was sent to Send Koro privately. ${esc(STATUS[rv.complaint.status][1])}.</span>` : ''}
      ${rv.reply ? `<div class="rv-reply"><b class="sm-t">Response from ${esc(L.name)}</b><span class="sm-t">${esc(rv.reply.text)}</span><span class="mut sm-t">${esc(rv.reply.date)}</span></div>` : ''}
      ${o.actions || ''}</article>`;
  }
  window.SK_REVIEWS = { PRAISE, ISSUES, SERIOUS, LABEL, LOCS, SEED, NOTICES, STATUS, starRow, summary, summaryHTML, complaintsHTML, cardHTML, clone: () => JSON.parse(JSON.stringify(SEED)) };
})();
