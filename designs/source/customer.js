/* Send Koro customer prototype. One code path for web, PWA and Flutter layouts.
   Money is integer cents, like the real apps. Nothing is sent anywhere. */
(function () {
  const M = window.SK_MODE || { layout: 'web' };
  const PHONE = M.layout === 'phone';
  const root = document.getElementById('app');

  // ---------- helpers ----------
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const money = (c) => (c < 0 ? '−' : '') + '$' + (Math.abs(c) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const IMG = (n) => 'img/' + n + '.jpg';
  document.getElementById('app').classList.add('cx');
  const TAX_PPM = 88750; // 8.875%, set by each restaurant
  // Delivery markup (same rule as services/payments priceDelivery): D = courier price + the delivery money's card-fee share.
  const COURIER = 780; // typical courier quote (P)
  const stripeFee = (q) => (q ? Math.ceil((q * 290) / 10000) + 30 : 0);
  // Payout fee: Send Koro pays out and settles to the courier (own driver or Uber Direct/DoorDash): 0.25% of (courier + tip) + 25¢.
  const payoutFee = (tip) => Math.ceil(((COURIER + tip) * 25) / 10000) + 25;
  function priceD(shareOf, food, taxC, tip, P = COURIER, payout = Math.ceil(((P + tip) * 25) / 10000) + 25) {
    let D = P + payout;
    for (let i = 0; i < 20; i++) { const R = shareOf(D); const C = D - R; const Q = food + taxC + C + tip; const share = Q ? Math.min(D + tip, Math.round((stripeFee(Q) * (C + tip)) / Q)) : 0; const need = P + payout + share; if (need <= D) break; D = need; }
    return D;
  }  // Courier quotes grow with distance (like an Uber Direct quote): about $7.80 at 2.7 miles.
  const courierQuote = (mi) => Math.max(650, 550 + Math.round(85 * mi));
  let READY = false;

  const tax = (food) => Math.round((food * TAX_PPM) / 1e6);
  const ic = {
    gps: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
    back: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
    search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    pin: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    cart: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 4h2l2.4 11h10.2L20 8H6.2"/><circle cx="9" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/></svg>',
    home: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"/></svg>',
    list: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
    user: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>',
    lock: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  };
  // Logo M3 "Fork Ring, arrow breaks out": navy ring + fork, red arrow leaving the ring. Colours come from CSS (.sk-mark).
  const LOGO = (c, size = 34) => `<svg class="sk-mark" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true"><path class="mk-r" d="M92.94 47.75A43 43 0 1 1 82.45 21.79" fill="none" stroke-width="7" stroke-linecap="round"/><g transform="rotate(-22 50 50)"><path class="mk-t" d="M17 42H34M17 50H34M17 58H34" fill="none" stroke-width="4.6" stroke-linecap="round"/><path class="mk-f" d="M32 37.5H37Q46 37.5 49 46L50.5 50L49 54Q46 62.5 37 62.5H32Z"/><path class="mk-a" d="M49 50H84" fill="none" stroke-width="6.5" stroke-linecap="round"/><path class="mk-h" d="M80 40.5L97 50L80 59.5Z" stroke-width="2" stroke-linejoin="round"/></g></svg>`;
  const WORD = '<span class="sk-wm"><span class="sk-name">Send <i class="k">Koro</i></span><span class="sk-tag">Order food from local restaurants</span></span>';

  // ---------- data ----------
  const SIZE = (big, label2 = 'Large') => ({ id: 'size', name: 'Size', one: true, choices: [{ id: 'reg', name: 'Regular', price: 0 }, { id: 'lg', name: label2, price: big }] });
  const R = [
    { id: 'bbc', name: 'Brooklyn Bowl Co.', cuisine: 'Bowls', tags: ['halal'], area: 'Park Slope', addr: '412 7th Ave', rating: '4.8', reviews: '1,240', eta: '25–35', etaMax: 35, img: 'hero_bowl', rule: { type: 'split', cents: 300 }, menu: [
      { s: 'Popular', items: [
        { id: 'gcb', name: 'Grilled Chicken Bowl', desc: 'Chicken, quinoa, greens, tomatoes, feta', price: 1500, img: 'chicken_bowl', allergens: 'Contains dairy (feta).', opts: [SIZE(300), { id: 'ex', name: 'Extras', max: 3, choices: [{ id: 'avo', name: 'Avocado', price: 200 }, { id: 'chk', name: 'Extra chicken', price: 400 }, { id: 'feta', name: 'Extra feta', price: 100 }] }] },
        { id: 'slm', name: 'Salmon Bowl', desc: 'Roasted salmon, rice, avocado, greens', price: 1300, img: 'hero_bowl', allergens: 'Contains fish and sesame.', opts: [SIZE(300)] },
        { id: 'hrv', name: 'Harvest Salad', desc: 'Greens, tomatoes, olives, feta. Vegetarian.', price: 1100, img: 'salad', allergens: 'Contains dairy.', opts: [{ id: 'ex', name: 'Extras', max: 2, choices: [{ id: 'avo', name: 'Avocado', price: 200 }, { id: 'feta', name: 'Extra feta', price: 100 }] }] },
        { id: 'scb', name: 'Spicy Chicken Bites', desc: 'Crispy chicken, gochujang glaze', price: 900, img: 'spicy', soldOut: 'Sold out until 5 PM' },
      ] },
      { s: 'Drinks', items: [{ id: 'igt', name: 'Iced Green Tea', desc: 'Unsweetened', price: 350 }, { id: 'lmd', name: 'Mint Lemonade', desc: 'Fresh lemon and mint', price: 450 }] },
    ] },
    { id: 'dhaka', name: 'Dhaka Kitchen', cuisine: 'Bangladeshi', tags: ['halal'], area: 'Kensington', addr: '520 McDonald Ave', rating: '4.8', reviews: '900+', eta: '25–40', etaMax: 40, img: 'biryani', rule: { type: 'customer' }, menu: [
      { s: 'Biryani & rice', items: [
        { id: 'kac', name: 'Kacchi Biryani', desc: 'Mutton, aged basmati, saffron, potato, egg', price: 1695, img: 'biryani', allergens: 'Contains egg and dairy.', opts: [SIZE(1200, 'Family (serves 3)'), { id: 'ex', name: 'Extras', max: 2, choices: [{ id: 'raita', name: 'Extra raita', price: 150 }, { id: 'borhani', name: 'Borhani drink', price: 350 }] }] },
        { id: 'teh', name: 'Beef Tehari', desc: 'Chinigura rice, beef, green chili', price: 1395, img: 'biryani' },
      ] },
      { s: 'Curries', items: [{ id: 'roast', name: 'Chicken Roast', desc: 'Onion and yogurt gravy', price: 1450, img: 'spicy', allergens: 'Contains dairy.' }] },
      { s: 'Drinks', items: [{ id: 'lassi', name: 'Mango Lassi', desc: 'Alphonso mango, yogurt, cardamom', price: 495 }] },
    ] },
    { id: 'koro', name: 'Koro Ramen', cuisine: 'Ramen', tags: [], area: 'Prospect Heights', addr: '640 Vanderbilt Ave', rating: '4.7', reviews: '500+', eta: '20–35', etaMax: 35, img: 'ramen', rule: { type: 'freeOver', over: 3000 }, menu: [
      { s: 'Ramen', items: [
        { id: 'tonk', name: 'Tonkotsu Ramen', desc: 'Pork broth, chashu, egg, scallion', price: 1725, img: 'ramen', allergens: 'Contains wheat, egg, soy.', opts: [{ id: 'ex', name: 'Extras', max: 2, choices: [{ id: 'egg', name: 'Extra egg', price: 200 }, { id: 'chashu', name: 'Extra chashu', price: 400 }] }] },
        { id: 'miso', name: 'Spicy Miso Ramen', desc: 'Miso broth, chili oil, corn', price: 1650, img: 'ramen', allergens: 'Contains wheat, soy, sesame.' },
      ] },
      { s: 'Sides', items: [{ id: 'gyoza', name: 'Gyoza (6)', desc: 'Pork and cabbage', price: 800 }] },
    ] },
    { id: 'burger', name: 'Brooklyn Burger Co.', cuisine: 'Burgers', tags: [], area: 'Fort Greene', addr: '88 DeKalb Ave', rating: '4.6', reviews: '900+', eta: '25–40', etaMax: 40, img: 'burger', rule: { type: 'customer' }, menu: [
      { s: 'Burgers', items: [
        { id: 'cheese', name: 'Classic Cheeseburger', desc: 'Beef, cheddar, lettuce, tomato', price: 1400, img: 'burger', allergens: 'Contains wheat and dairy.', opts: [{ id: 'ex', name: 'Extras', max: 2, choices: [{ id: 'bacon', name: 'Bacon', price: 250 }, { id: 'patty', name: 'Extra patty', price: 450 }] }] },
        { id: 'smash', name: 'Double Smash', desc: 'Two patties, pickles, house sauce', price: 1700, img: 'burger2' },
      ] },
      { s: 'Sides', items: [{ id: 'fries', name: 'Fries', desc: 'Sea salt', price: 500 }] },
    ] },
    { id: 'atl', name: 'Atlantic Pizza Co.', cuisine: 'Pizza', tags: [], area: 'Boerum Hill', addr: '301 Atlantic Ave', rating: '4.7', reviews: '1,200+', eta: '20–35', etaMax: 35, img: 'pizza', rule: { type: 'free' }, menu: [
      { s: 'Pies', items: [
        { id: 'pep', name: 'Pepperoni Pie (16")', desc: 'Tomato, mozzarella, pepperoni', price: 1800, img: 'pizza', opts: [SIZE(400, '18 inch')] },
        { id: 'marg', name: 'Margherita (16")', desc: 'Tomato, mozzarella, basil', price: 1600, img: 'pizza' },
      ] },
    ] },
    { id: 'wings', name: 'Flatbush Wings', cuisine: 'Wings', tags: ['halal'], area: 'Flatbush', addr: '1102 Flatbush Ave', rating: '4.5', reviews: '400+', eta: '30–40', etaMax: 40, img: 'spicy', rule: { type: 'split', cents: 300 }, menu: [
      { s: 'Wings', items: [{ id: 'gochu', name: 'Gochujang Wings (10)', desc: 'Sweet and spicy', price: 1500, img: 'spicy' }, { id: 'soy', name: 'Soy Garlic Wings (10)', desc: 'Savory, sticky', price: 1500, img: 'spicy' }] },
    ] },
    { id: 'green', name: 'Green Leaf Salads', cuisine: 'Salads', tags: ['vegetarian'], area: 'Cobble Hill', addr: '190 Court St', rating: '4.6', reviews: '300+', eta: '15–25', etaMax: 25, img: 'salad', rule: { type: 'customer' }, menu: [
      { s: 'Salads', items: [{ id: 'hs', name: 'Harvest Salad', desc: 'Greens, tomatoes, olives, feta', price: 1100, img: 'salad' }, { id: 'qp', name: 'Quinoa Power Bowl', desc: 'Quinoa, chickpeas, greens, tahini', price: 1300, img: 'chicken_bowl' }] },
    ] },
  ];
  const CUISINES = [['Burgers', 'burger'], ['Pizza', 'pizza'], ['Bangladeshi', 'biryani'], ['Ramen', 'ramen'], ['Bowls', 'chicken_bowl'], ['Salads', 'salad'], ['Wings', 'spicy']];
  const rest = (id) => R.find((r) => r.id === id);
  const GEO = { bbc: [40.6660, -73.9822, 3], dhaka: [40.6440, -73.9790, 3], koro: [40.6780, -73.9690, 2.5], burger: [40.6900, -73.9780, 2.5], atl: [40.6870, -73.9850, 3], wings: [40.6440, -73.9580, 2], green: [40.6860, -73.9940, 2] };
  R.forEach((r) => { const g = GEO[r.id]; r.brand = r.name; r.lat = g[0]; r.lng = g[1]; r.radius = g[2]; });
  R.push({ ...R.find((x) => x.id === 'bbc'), id: 'bbc-wb', area: 'Williamsburg', addr: '150 Bedford Ave', lat: 40.7190, lng: -73.9570, radius: 2.5, eta: '20–30', etaMax: 30, rating: '4.7', reviews: '310' });
  R.push({ ...R.find((x) => x.id === 'dhaka'), id: 'dhaka-jh', area: 'Jackson Heights', addr: '37-12 74th St', lat: 40.7470, lng: -73.8910, radius: 3, eta: '25–35', etaMax: 35, rating: '4.9', reviews: '1,100+' });
  const AVAIL = { bbc: { rings: [[2, 0], [3, 2000]] }, dhaka: { rings: [[2, 0], [3, 1500]] }, atl: { rings: [[1, 0], [3, 2500]] }, koro: { paused: true }, green: { closed: 'Opens tomorrow at 11:00 AM' } };
  R.forEach((r) => { const a = AVAIL[r.id] || {}; r.paused = !!a.paused; r.closed = a.closed || ''; r.rings = (a.rings || [[r.radius, 0]]).map((x) => [...x]); r.rings[r.rings.length - 1][0] = r.radius; });
  const findItem = (r, id) => { for (const sec of r.menu) for (const it of sec.items) if (it.id === id) return it; return null; };
  const estFee = (r) => priceD((D) => deliveryShare(r, 3000, D), 3000, tax(3000), 540, READY ? courierQuote(dist(r)) : COURIER);
  const ruleText = (r) => ({ customer: `About ${money(estFee(r))} delivery`, split: `${r.name} pays $3 of delivery`, freeOver: 'Free delivery over $30', free: 'Free delivery' }[r.rule.type]);
  // ── US address suggestions (prototype index). Real apps: Google Places Autocomplete via the core API. ──
  // Each street: [name, city, state, ZIP, lat, lng, house-number range]. Typing "210 fr" → "210 Franklin Ave, Brooklyn, NY 11205".
  const STREETS = [
    // Brooklyn
    ['Franklin Ave', 'Brooklyn', 'NY', '11205', 40.6890, -73.9570, [1, 1200]], ['Franklin St', 'Brooklyn', 'NY', '11222', 40.7330, -73.9580, [1, 250]],
    ['Flatbush Ave', 'Brooklyn', 'NY', '11226', 40.6470, -73.9580, [1, 2400]], ['Fulton St', 'Brooklyn', 'NY', '11238', 40.6830, -73.9640, [1, 3000]],
    ['Bedford Ave', 'Brooklyn', 'NY', '11249', 40.7200, -73.9560, [1, 3000]], ['Atlantic Ave', 'Brooklyn', 'NY', '11217', 40.6860, -73.9780, [1, 3000]],
    ['7th Ave', 'Brooklyn', 'NY', '11215', 40.6660, -73.9822, [1, 600]], ['5th Ave', 'Brooklyn', 'NY', '11215', 40.6700, -73.9850, [1, 1000]],
    ['Prospect Park W', 'Brooklyn', 'NY', '11215', 40.6720, -73.9700, [1, 250]], ['Court St', 'Brooklyn', 'NY', '11201', 40.6890, -73.9930, [1, 700]],
    ['Smith St', 'Brooklyn', 'NY', '11231', 40.6830, -73.9920, [1, 600]], ['Water St', 'Brooklyn', 'NY', '11201', 40.7030, -73.9910, [1, 200]],
    ['Myrtle Ave', 'Brooklyn', 'NY', '11205', 40.6940, -73.9690, [1, 1800]], ['DeKalb Ave', 'Brooklyn', 'NY', '11205', 40.6900, -73.9700, [1, 1700]],
    ['Nostrand Ave', 'Brooklyn', 'NY', '11216', 40.6800, -73.9500, [1, 3000]], ['Eastern Pkwy', 'Brooklyn', 'NY', '11238', 40.6720, -73.9590, [1, 1800]],
    ['Ocean Ave', 'Brooklyn', 'NY', '11226', 40.6460, -73.9610, [1, 3000]], ['Coney Island Ave', 'Brooklyn', 'NY', '11218', 40.6350, -73.9680, [1, 3000]],
    ['Liberty Ave', 'Brooklyn', 'NY', '11208', 40.6760, -73.8730, [1, 3000]], ['Pitkin Ave', 'Brooklyn', 'NY', '11212', 40.6700, -73.9100, [1, 3000]],
    ['Grand St', 'Brooklyn', 'NY', '11211', 40.7110, -73.9570, [1, 800]], ['Metropolitan Ave', 'Brooklyn', 'NY', '11211', 40.7140, -73.9510, [1, 1200]],
    ['Manhattan Ave', 'Brooklyn', 'NY', '11222', 40.7270, -73.9520, [1, 1200]], ['Knickerbocker Ave', 'Brooklyn', 'NY', '11237', 40.7010, -73.9220, [1, 600]],
    ['Kings Hwy', 'Brooklyn', 'NY', '11229', 40.6080, -73.9580, [1, 3000]], ['86th St', 'Brooklyn', 'NY', '11209', 40.6220, -74.0310, [1, 2400]],
    ['Bay Ridge Pkwy', 'Brooklyn', 'NY', '11209', 40.6290, -74.0230, [1, 800]], ['Church Ave', 'Brooklyn', 'NY', '11226', 40.6510, -73.9530, [1, 3000]],
    ['Vanderbilt Ave', 'Brooklyn', 'NY', '11238', 40.6790, -73.9680, [1, 700]], ['Washington Ave', 'Brooklyn', 'NY', '11238', 40.6780, -73.9640, [1, 1000]],
    // Manhattan
    ['5th Ave', 'New York', 'NY', '10118', 40.7484, -73.9857, [1, 2200]], ['Broadway', 'New York', 'NY', '10012', 40.7250, -73.9970, [1, 3800]],
    ['Lexington Ave', 'New York', 'NY', '10022', 40.7590, -73.9700, [1, 2100]], ['Park Ave', 'New York', 'NY', '10016', 40.7470, -73.9810, [1, 1900]],
    ['Madison Ave', 'New York', 'NY', '10016', 40.7470, -73.9840, [1, 2100]], ['Amsterdam Ave', 'New York', 'NY', '10024', 40.7860, -73.9760, [1, 2100]],
    ['Columbus Ave', 'New York', 'NY', '10023', 40.7760, -73.9800, [1, 1000]], ['W 42nd St', 'New York', 'NY', '10036', 40.7570, -73.9900, [1, 700]],
    ['E 14th St', 'New York', 'NY', '10003', 40.7340, -73.9890, [1, 700]], ['Canal St', 'New York', 'NY', '10013', 40.7190, -74.0020, [1, 500]],
    ['Houston St', 'New York', 'NY', '10012', 40.7250, -73.9960, [1, 700]], ['Bleecker St', 'New York', 'NY', '10012', 40.7280, -74.0000, [1, 400]],
    ['St Nicholas Ave', 'New York', 'NY', '10031', 40.8210, -73.9450, [1, 1500]], ['Frederick Douglass Blvd', 'New York', 'NY', '10027', 40.8100, -73.9510, [1, 2900]],
    ['Wall St', 'New York', 'NY', '10005', 40.7060, -74.0090, [1, 130]], ['Water St', 'New York', 'NY', '10038', 40.7070, -74.0030, [1, 600]],
    // Queens
    ['74th St', 'Jackson Heights', 'NY', '11372', 40.7470, -73.8910, ['37-01', '37-99']], ['37th Ave', 'Jackson Heights', 'NY', '11372', 40.7490, -73.8860, ['70-01', '96-99']],
    ['Steinway St', 'Astoria', 'NY', '11103', 40.7620, -73.9170, ['25-01', '43-99']], ['Broadway', 'Astoria', 'NY', '11106', 40.7610, -73.9250, ['21-01', '48-99']],
    ['Queens Blvd', 'Forest Hills', 'NY', '11375', 40.7200, -73.8450, ['100-01', '120-99']], ['Roosevelt Ave', 'Flushing', 'NY', '11354', 40.7590, -73.8300, ['132-01', '136-99']],
    ['Main St', 'Flushing', 'NY', '11355', 40.7550, -73.8290, ['37-01', '45-99']], ['Jamaica Ave', 'Jamaica', 'NY', '11432', 40.7050, -73.7940, ['146-01', '170-99']],
    ['Vernon Blvd', 'Long Island City', 'NY', '11101', 40.7450, -73.9530, ['10-01', '50-99']], ['Ditmars Blvd', 'Astoria', 'NY', '11105', 40.7750, -73.9110, ['18-01', '50-99']],
    // Bronx and Staten Island
    ['Grand Concourse', 'Bronx', 'NY', '10451', 40.8230, -73.9240, [1, 3400]], ['Arthur Ave', 'Bronx', 'NY', '10458', 40.8550, -73.8880, [2300, 2600]],
    ['Fordham Rd', 'Bronx', 'NY', '10458', 40.8620, -73.8900, [1, 700]], ['Victory Blvd', 'Staten Island', 'NY', '10301', 40.6270, -74.0900, [1, 4000]],
    ['Hylan Blvd', 'Staten Island', 'NY', '10305', 40.5930, -74.0700, [1, 7000]],
    // More NYC streets
    ['McKinley Ave', 'Brooklyn', 'NY', '11208', 40.6832, -73.8740, [1, 400]],
    ['Liberty Ave', 'Brooklyn', 'NY', '11208', 40.6760, -73.8730, [1, 3000]],
    ['Fulton St', 'Brooklyn', 'NY', '11208', 40.6810, -73.8790, [2800, 3400]],
    ['Atlantic Ave', 'Brooklyn', 'NY', '11208', 40.6790, -73.8800, [2800, 3400]],
    ['Jamaica Ave', 'Brooklyn', 'NY', '11208', 40.6880, -73.8720, [1, 300]],
    ['Etna St', 'Brooklyn', 'NY', '11208', 40.6850, -73.8740, [1, 400]],
    ['Ridgewood Ave', 'Brooklyn', 'NY', '11208', 40.6865, -73.8730, [1, 400]],
    ['Arlington Ave', 'Brooklyn', 'NY', '11208', 40.6830, -73.8800, [1, 700]],
    ['Pitkin Ave', 'Brooklyn', 'NY', '11208', 40.6740, -73.8750, [2400, 3000]],
    ['Euclid Ave', 'Brooklyn', 'NY', '11208', 40.6770, -73.8720, [1, 800]],
    ['Crescent St', 'Brooklyn', 'NY', '11208', 40.6800, -73.8680, [1, 800]],
    ['Hale Ave', 'Brooklyn', 'NY', '11208', 40.6840, -73.8650, [1, 300]],
    ['Lincoln Ave', 'Brooklyn', 'NY', '11208', 40.6800, -73.8770, [1, 800]],
    ['Logan St', 'Brooklyn', 'NY', '11208', 40.6780, -73.8780, [1, 800]],
    ['Fountain Ave', 'Brooklyn', 'NY', '11208', 40.6720, -73.8710, [1, 1100]],
    ['Conduit Blvd', 'Brooklyn', 'NY', '11208', 40.6740, -73.8670, [1, 1200]],
    ['Sutter Ave', 'Brooklyn', 'NY', '11207', 40.6690, -73.8940, [1, 2500]],
    ['Blake Ave', 'Brooklyn', 'NY', '11207', 40.6680, -73.8930, [1, 2500]],
    ['Dumont Ave', 'Brooklyn', 'NY', '11207', 40.6670, -73.8920, [1, 2500]],
    ['Linden Blvd', 'Brooklyn', 'NY', '11207', 40.6610, -73.8920, [1, 3200]],
    ['New Lots Ave', 'Brooklyn', 'NY', '11207', 40.6620, -73.8880, [1, 1200]],
    ['Pennsylvania Ave', 'Brooklyn', 'NY', '11207', 40.6670, -73.8960, [1, 1100]],
    ['Van Siclen Ave', 'Brooklyn', 'NY', '11207', 40.6730, -73.8910, [1, 1100]],
    ['Bradford St', 'Brooklyn', 'NY', '11207', 40.6730, -73.8890, [1, 900]],
    ['Highland Blvd', 'Brooklyn', 'NY', '11207', 40.6840, -73.8850, [1, 300]],
    ['Bushwick Ave', 'Brooklyn', 'NY', '11207', 40.6940, -73.9180, [1, 1800]],
    ['Broadway', 'Brooklyn', 'NY', '11211', 40.7030, -73.9400, [1, 2000]],
    ['Wilson Ave', 'Brooklyn', 'NY', '11237', 40.6990, -73.9200, [1, 1500]],
    ['Irving Ave', 'Brooklyn', 'NY', '11237', 40.7010, -73.9130, [1, 700]],
    ['Wyckoff Ave', 'Brooklyn', 'NY', '11237', 40.7020, -73.9180, [1, 600]],
    ['Myrtle Ave', 'Brooklyn', 'NY', '11221', 40.6960, -73.9300, [1000, 1800]],
    ['Gates Ave', 'Brooklyn', 'NY', '11221', 40.6880, -73.9300, [1, 1500]],
    ['Halsey St', 'Brooklyn', 'NY', '11233', 40.6830, -73.9300, [1, 1200]],
    ['Malcolm X Blvd', 'Brooklyn', 'NY', '11221', 40.6880, -73.9290, [1, 900]],
    ['Ralph Ave', 'Brooklyn', 'NY', '11233', 40.6780, -73.9210, [1, 1800]],
    ['Utica Ave', 'Brooklyn', 'NY', '11213', 40.6680, -73.9310, [1, 2200]],
    ['Rochester Ave', 'Brooklyn', 'NY', '11213', 40.6710, -73.9270, [1, 1500]],
    ['Kingston Ave', 'Brooklyn', 'NY', '11213', 40.6700, -73.9420, [1, 1000]],
    ['Albany Ave', 'Brooklyn', 'NY', '11213', 40.6680, -73.9390, [1, 1500]],
    ['Troy Ave', 'Brooklyn', 'NY', '11213', 40.6680, -73.9360, [1, 1500]],
    ['Schenectady Ave', 'Brooklyn', 'NY', '11213', 40.6680, -73.9330, [1, 1500]],
    ['Lefferts Ave', 'Brooklyn', 'NY', '11225', 40.6630, -73.9500, [1, 800]],
    ['Empire Blvd', 'Brooklyn', 'NY', '11225', 40.6630, -73.9530, [1, 1000]],
    ['Rogers Ave', 'Brooklyn', 'NY', '11225', 40.6600, -73.9530, [1, 1500]],
    ['Bedford Ave', 'Brooklyn', 'NY', '11225', 40.6600, -73.9550, [1000, 2600]],
    ['Clarkson Ave', 'Brooklyn', 'NY', '11226', 40.6550, -73.9480, [1, 800]],
    ['Cortelyou Rd', 'Brooklyn', 'NY', '11226', 40.6400, -73.9650, [1, 2000]],
    ['Newkirk Ave', 'Brooklyn', 'NY', '11230', 40.6350, -73.9620, [1, 2000]],
    ['Avenue J', 'Brooklyn', 'NY', '11230', 40.6250, -73.9620, [1, 3000]],
    ['Avenue M', 'Brooklyn', 'NY', '11230', 40.6180, -73.9580, [1, 3000]],
    ['Avenue U', 'Brooklyn', 'NY', '11229', 40.5990, -73.9580, [1, 3000]],
    ['Ocean Pkwy', 'Brooklyn', 'NY', '11218', 40.6300, -73.9700, [1, 3000]],
    ['McDonald Ave', 'Brooklyn', 'NY', '11218', 40.6370, -73.9790, [1, 3000]],
    ['Church Ave', 'Brooklyn', 'NY', '11218', 40.6440, -73.9790, [1, 1000]],
    ['Fort Hamilton Pkwy', 'Brooklyn', 'NY', '11219', 40.6340, -73.9940, [1, 7500]],
    ['New Utrecht Ave', 'Brooklyn', 'NY', '11219', 40.6290, -73.9960, [1, 8000]],
    ['13th Ave', 'Brooklyn', 'NY', '11219', 40.6330, -73.9960, [3800, 6500]],
    ['18th Ave', 'Brooklyn', 'NY', '11204', 40.6190, -73.9850, [5500, 8000]],
    ['Bay Pkwy', 'Brooklyn', 'NY', '11204', 40.6150, -73.9840, [1, 8000]],
    ['20th Ave', 'Brooklyn', 'NY', '11204', 40.6120, -73.9840, [5500, 8000]],
    ['3rd Ave', 'Brooklyn', 'NY', '11209', 40.6300, -74.0260, [1, 9000]],
    ['4th Ave', 'Brooklyn', 'NY', '11215', 40.6680, -73.9880, [1, 9000]],
    ['5th Ave', 'Brooklyn', 'NY', '11220', 40.6380, -74.0170, [4000, 9000]],
    ['8th Ave', 'Brooklyn', 'NY', '11220', 40.6350, -74.0110, [4000, 7000]],
    ['Union St', 'Brooklyn', 'NY', '11215', 40.6740, -73.9800, [1, 1800]],
    ['President St', 'Brooklyn', 'NY', '11215', 40.6760, -73.9830, [1, 1800]],
    ['Carroll St', 'Brooklyn', 'NY', '11215', 40.6770, -73.9850, [1, 1800]],
    ['Sterling Pl', 'Brooklyn', 'NY', '11217', 40.6770, -73.9740, [1, 1700]],
    ['St Marks Ave', 'Brooklyn', 'NY', '11217', 40.6790, -73.9720, [1, 1700]],
    ['Bergen St', 'Brooklyn', 'NY', '11217', 40.6820, -73.9770, [1, 2000]],
    ['Dean St', 'Brooklyn', 'NY', '11217', 40.6810, -73.9760, [1, 2200]],
    ['Pacific St', 'Brooklyn', 'NY', '11217', 40.6840, -73.9790, [1, 2200]],
    ['Lafayette Ave', 'Brooklyn', 'NY', '11238', 40.6870, -73.9640, [1, 1500]],
    ['Greene Ave', 'Brooklyn', 'NY', '11238', 40.6870, -73.9600, [1, 1500]],
    ['Clinton Ave', 'Brooklyn', 'NY', '11205', 40.6900, -73.9680, [1, 600]],
    ['Classon Ave', 'Brooklyn', 'NY', '11205', 40.6880, -73.9600, [1, 1000]],
    ['Flushing Ave', 'Brooklyn', 'NY', '11205', 40.6980, -73.9650, [1, 1800]],
    ['Kent Ave', 'Brooklyn', 'NY', '11249', 40.7160, -73.9640, [1, 800]],
    ['Wythe Ave', 'Brooklyn', 'NY', '11249', 40.7180, -73.9610, [1, 800]],
    ['Berry St', 'Brooklyn', 'NY', '11249', 40.7170, -73.9600, [1, 600]],
    ['Driggs Ave', 'Brooklyn', 'NY', '11211', 40.7160, -73.9560, [1, 1000]],
    ['N 7th St', 'Brooklyn', 'NY', '11249', 40.7190, -73.9580, [1, 300]],
    ['Graham Ave', 'Brooklyn', 'NY', '11206', 40.7110, -73.9440, [1, 1000]],
    ['Lorimer St', 'Brooklyn', 'NY', '11206', 40.7110, -73.9490, [1, 1000]],
    ['Nassau Ave', 'Brooklyn', 'NY', '11222', 40.7240, -73.9480, [1, 400]],
    ['Greenpoint Ave', 'Brooklyn', 'NY', '11222', 40.7300, -73.9540, [1, 300]],
    ['Henry St', 'Brooklyn', 'NY', '11201', 40.6940, -73.9950, [1, 700]],
    ['Montague St', 'Brooklyn', 'NY', '11201', 40.6940, -73.9930, [1, 200]],
    ['Jay St', 'Brooklyn', 'NY', '11201', 40.6930, -73.9870, [1, 400]],
    ['Hicks St', 'Brooklyn', 'NY', '11201', 40.6940, -73.9960, [1, 700]],
    ['Van Brunt St', 'Brooklyn', 'NY', '11231', 40.6810, -74.0080, [1, 500]],
    ['Columbia St', 'Brooklyn', 'NY', '11231', 40.6850, -74.0020, [1, 300]],
    ['Brighton Beach Ave', 'Brooklyn', 'NY', '11235', 40.5780, -73.9600, [1, 1300]],
    ['Surf Ave', 'Brooklyn', 'NY', '11224', 40.5750, -73.9800, [1, 3700]],
    ['Emmons Ave', 'Brooklyn', 'NY', '11235', 40.5840, -73.9480, [1, 3000]],
    ['Flatlands Ave', 'Brooklyn', 'NY', '11236', 40.6340, -73.9180, [1, 10000]],
    ['Rockaway Pkwy', 'Brooklyn', 'NY', '11236', 40.6460, -73.9060, [1, 1600]],
    ['Remsen Ave', 'Brooklyn', 'NY', '11236', 40.6480, -73.9180, [1, 1500]],
    ['Avenue D', 'Brooklyn', 'NY', '11203', 40.6440, -73.9310, [1, 6000]],
    ['1st Ave', 'New York', 'NY', '10009', 40.7270, -73.9850, [1, 2400]],
    ['2nd Ave', 'New York', 'NY', '10003', 40.7290, -73.9870, [1, 2400]],
    ['3rd Ave', 'New York', 'NY', '10003', 40.7330, -73.9880, [1, 2400]],
    ['6th Ave', 'New York', 'NY', '10011', 40.7400, -73.9940, [1, 1500]],
    ['7th Ave', 'New York', 'NY', '10011', 40.7390, -73.9990, [1, 900]],
    ['8th Ave', 'New York', 'NY', '10014', 40.7390, -74.0030, [1, 1000]],
    ['9th Ave', 'New York', 'NY', '10011', 40.7430, -74.0040, [1, 1000]],
    ['10th Ave', 'New York', 'NY', '10011', 40.7450, -74.0060, [1, 1000]],
    ['Avenue A', 'New York', 'NY', '10009', 40.7260, -73.9830, [1, 250]],
    ['Avenue B', 'New York', 'NY', '10009', 40.7250, -73.9810, [1, 250]],
    ['Avenue C', 'New York', 'NY', '10009', 40.7230, -73.9790, [1, 250]],
    ['Mott St', 'New York', 'NY', '10013', 40.7170, -73.9970, [1, 300]],
    ['Mulberry St', 'New York', 'NY', '10013', 40.7190, -73.9970, [1, 300]],
    ['Delancey St', 'New York', 'NY', '10002', 40.7180, -73.9880, [1, 300]],
    ['Essex St', 'New York', 'NY', '10002', 40.7180, -73.9880, [1, 200]],
    ['Orchard St', 'New York', 'NY', '10002', 40.7190, -73.9900, [1, 200]],
    ['Spring St', 'New York', 'NY', '10012', 40.7240, -74.0010, [1, 600]],
    ['Prince St', 'New York', 'NY', '10012', 40.7240, -73.9990, [1, 300]],
    ['W 4th St', 'New York', 'NY', '10014', 40.7330, -74.0020, [1, 300]],
    ['Christopher St', 'New York', 'NY', '10014', 40.7330, -74.0040, [1, 200]],
    ['Hudson St', 'New York', 'NY', '10014', 40.7330, -74.0070, [1, 700]],
    ['Greenwich St', 'New York', 'NY', '10013', 40.7210, -74.0100, [1, 900]],
    ['Chambers St', 'New York', 'NY', '10007', 40.7150, -74.0080, [1, 400]],
    ['Fulton St', 'New York', 'NY', '10038', 40.7100, -74.0070, [1, 300]],
    ['W 34th St', 'New York', 'NY', '10001', 40.7500, -73.9910, [1, 700]],
    ['E 23rd St', 'New York', 'NY', '10010', 40.7400, -73.9850, [1, 700]],
    ['W 57th St', 'New York', 'NY', '10019', 40.7650, -73.9790, [1, 700]],
    ['E 86th St', 'New York', 'NY', '10028', 40.7790, -73.9550, [1, 700]],
    ['W 72nd St', 'New York', 'NY', '10023', 40.7780, -73.9810, [1, 400]],
    ['W 125th St', 'New York', 'NY', '10027', 40.8100, -73.9500, [1, 700]],
    ['Malcolm X Blvd', 'New York', 'NY', '10026', 40.8030, -73.9490, [1, 800]],
    ['Adam Clayton Powell Jr Blvd', 'New York', 'NY', '10030', 40.8150, -73.9440, [1, 2900]],
    ['Dyckman St', 'New York', 'NY', '10034', 40.8650, -73.9260, [1, 300]],
    ['Riverside Dr', 'New York', 'NY', '10025', 40.8000, -73.9700, [1, 2000]],
    ['West End Ave', 'New York', 'NY', '10024', 40.7880, -73.9780, [1, 1000]],
    ['York Ave', 'New York', 'NY', '10021', 40.7680, -73.9520, [1, 1700]],
    ['Northern Blvd', 'Jackson Heights', 'NY', '11372', 40.7560, -73.8850, ['70-01', '99-99']],
    ['Junction Blvd', 'Corona', 'NY', '11368', 40.7490, -73.8690, ['34-01', '56-99']],
    ['Austin St', 'Forest Hills', 'NY', '11375', 40.7190, -73.8440, ['70-01', '72-99']],
    ['Metropolitan Ave', 'Middle Village', 'NY', '11379', 40.7120, -73.8800, ['60-01', '80-99']],
    ['Myrtle Ave', 'Ridgewood', 'NY', '11385', 40.7000, -73.9000, ['56-01', '70-99']],
    ['Fresh Pond Rd', 'Ridgewood', 'NY', '11385', 40.7070, -73.8960, ['55-01', '70-99']],
    ['Woodhaven Blvd', 'Woodhaven', 'NY', '11421', 40.6990, -73.8550, ['85-01', '99-99']],
    ['Jamaica Ave', 'Woodhaven', 'NY', '11421', 40.6930, -73.8580, ['84-01', '99-99']],
    ['Liberty Ave', 'Ozone Park', 'NY', '11417', 40.6810, -73.8450, ['100-01', '134-99']],
    ['Rockaway Blvd', 'Ozone Park', 'NY', '11416', 40.6760, -73.8430, ['90-01', '130-99']],
    ['Cross Bay Blvd', 'Howard Beach', 'NY', '11414', 40.6600, -73.8430, ['150-01', '165-99']],
    ['Hillside Ave', 'Jamaica', 'NY', '11432', 40.7110, -73.7980, ['150-01', '190-99']],
    ['Sutphin Blvd', 'Jamaica', 'NY', '11435', 40.7000, -73.8070, ['85-01', '150-99']],
    ['Merrick Blvd', 'Jamaica', 'NY', '11434', 40.6840, -73.7700, ['100-01', '150-99']],
    ['Francis Lewis Blvd', 'Fresh Meadows', 'NY', '11365', 40.7300, -73.7940, ['46-01', '100-99']],
    ['Kissena Blvd', 'Flushing', 'NY', '11355', 40.7500, -73.8200, ['41-01', '70-99']],
    ['30th Ave', 'Astoria', 'NY', '11102', 40.7670, -73.9200, ['20-01', '50-99']],
    ['31st St', 'Astoria', 'NY', '11106', 40.7620, -73.9250, ['21-01', '40-99']],
    ['Greenpoint Ave', 'Sunnyside', 'NY', '11104', 40.7400, -73.9240, ['39-01', '48-99']],
    ['Skillman Ave', 'Sunnyside', 'NY', '11104', 40.7460, -73.9190, ['39-01', '52-99']],
    ['Queens Blvd', 'Sunnyside', 'NY', '11104', 40.7430, -73.9200, ['39-01', '52-99']],
    ['Jackson Ave', 'Long Island City', 'NY', '11101', 40.7470, -73.9430, ['10-01', '30-99']],
    ['Beach Channel Dr', 'Far Rockaway', 'NY', '11691', 40.6040, -73.7550, ['1-01', '20-99']],
    ['Rockaway Beach Blvd', 'Rockaway Park', 'NY', '11694', 40.5800, -73.8350, ['100-01', '130-99']],
    ['E Tremont Ave', 'Bronx', 'NY', '10460', 40.8420, -73.8800, [1, 4000]],
    ['Southern Blvd', 'Bronx', 'NY', '10459', 40.8250, -73.8900, [1, 1500]],
    ['Westchester Ave', 'Bronx', 'NY', '10459', 40.8240, -73.8930, [1, 3000]],
    ['Jerome Ave', 'Bronx', 'NY', '10468', 40.8600, -73.9010, [1, 3800]],
    ['White Plains Rd', 'Bronx', 'NY', '10467', 40.8650, -73.8670, [1, 4500]],
    ['Boston Rd', 'Bronx', 'NY', '10460', 40.8350, -73.8890, [1, 4500]],
    ['E 149th St', 'Bronx', 'NY', '10455', 40.8160, -73.9160, [1, 800]],
    ['Morris Park Ave', 'Bronx', 'NY', '10462', 40.8480, -73.8570, [1, 2000]],
    ['Pelham Pkwy', 'Bronx', 'NY', '10462', 40.8570, -73.8670, [1, 2000]],
    ['Castle Hill Ave', 'Bronx', 'NY', '10462', 40.8300, -73.8510, [1, 2400]],
    ['Webster Ave', 'Bronx', 'NY', '10457', 40.8500, -73.8990, [1, 4000]],
    ['Third Ave', 'Bronx', 'NY', '10457', 40.8420, -73.9030, [2700, 4500]],
    ['Richmond Ave', 'Staten Island', 'NY', '10314', 40.5900, -74.1660, [1, 4000]],
    ['Forest Ave', 'Staten Island', 'NY', '10310', 40.6300, -74.1100, [1, 2400]],
    ['Bay St', 'Staten Island', 'NY', '10301', 40.6300, -74.0760, [1, 1500]],
    ['Richmond Rd', 'Staten Island', 'NY', '10304', 40.6000, -74.0900, [1, 2500]],
    ['Amboy Rd', 'Staten Island', 'NY', '10306', 40.5500, -74.1500, [1, 7000]],
    ['Hempstead Tpke', 'Elmont', 'NY', '11003', 40.7000, -73.7100, [1, 2000]],
    ['Main St', 'Hackensack', 'NJ', '07601', 40.8860, -74.0430, [1, 500]],
    ['Bergenline Ave', 'Union City', 'NJ', '07087', 40.7700, -74.0260, [1, 4000]],
    ['Central Ave', 'Yonkers', 'NY', '10704', 40.9400, -73.8300, [1, 2500]],
    ['Main St', 'New Rochelle', 'NY', '10801', 40.9110, -73.7820, [1, 800]],
    // Elsewhere in the US
    ['Washington St', 'Hoboken', 'NJ', '07030', 40.7410, -74.0290, [1, 1500]], ['Newark Ave', 'Jersey City', 'NJ', '07302', 40.7230, -74.0480, [1, 900]],
    ['Main St', 'White Plains', 'NY', '10601', 41.0330, -73.7650, [1, 600]], ['Michigan Ave', 'Chicago', 'IL', '60611', 41.8940, -87.6240, [1, 2400]],
    ['Market St', 'San Francisco', 'CA', '94103', 37.7790, -122.4170, [1, 3200]], ['Sunset Blvd', 'Los Angeles', 'CA', '90028', 34.0980, -118.3270, [1, 9000]],
    ['Peachtree St NE', 'Atlanta', 'GA', '30303', 33.7590, -84.3870, [1, 1500]], ['Congress Ave', 'Austin', 'TX', '78701', 30.2680, -97.7430, [1, 1900]],
    ['Collins Ave', 'Miami Beach', 'FL', '33139', 25.7900, -80.1300, [1, 9000]], ['Boylston St', 'Boston', 'MA', '02116', 42.3500, -71.0760, [1, 1400]],
    ['Pennsylvania Ave NW', 'Washington', 'DC', '20004', 38.8950, -77.0280, [1, 3000]], ['Walnut St', 'Philadelphia', 'PA', '19103', 39.9500, -75.1700, [1, 4000]],
    ['Pike St', 'Seattle', 'WA', '98101', 47.6100, -122.3400, [1, 2000]], ['Las Vegas Blvd S', 'Las Vegas', 'NV', '89109', 36.1150, -115.1730, [1, 9000]],
  ];
  const ABBR = { st: 'street', ave: 'avenue', blvd: 'boulevard', pkwy: 'parkway', hwy: 'highway', rd: 'road', w: 'west', e: 'east', s: 'south', n: 'north', ne: 'northeast', nw: 'northwest' };
  const words = (s) => s.toLowerCase().replace(/[.,#]/g, ' ').split(/\s+/).filter(Boolean);
  const wordMatches = (typed, w) => w.startsWith(typed) || (ABBR[w] && ABBR[w].startsWith(typed));
  const inRange = (num, [lo, hi]) => (typeof lo === 'string' ? /^\d+-\d*$/.test(num) && +num.split('-')[0] >= +lo.split('-')[0] && +num.split('-')[0] <= +hi.split('-')[0] : /^\d+$/.test(num) && +num >= lo && +num <= hi);
  /** Up to `max` full US addresses for what the person typed so far. */
  function suggestAddresses(text, max = 6) {
    const q = String(text || '').trim();
    if (q.length < 2) return [];
    const m = q.match(/^(\d+(?:-\d*)?)\s*(.*)$/);
    const num = m ? m[1].replace(/-$/, '') : '';
    const rest = words(m ? m[2] : q);
    const out = [];
    for (const [name, city, state, zip, lat, lng, range] of STREETS) {
      const hay = [...words(name), ...words(city), state.toLowerCase(), zip];
      // every typed word must match the start of some word in street, city, state or ZIP; the last word may be partial
      if (!rest.every((t) => hay.some((w) => wordMatches(t, w)))) continue;
      if (!rest.length && !num) continue;
      let house = num;
      if (num && !inRange(num, range)) continue;
      if (!num) house = typeof range[0] === 'string' ? range[0] : String(range[0] === 1 ? 100 : range[0]);
      const score = (rest.length && words(name)[0].startsWith(rest[0]) ? 0 : 1) + (state === 'NY' ? 0 : 2) + (num ? 0 : 1);
      out.push({ t: `${house} ${name}, ${city}, ${state} ${zip}`, line: `${house} ${name}`, city: `${city}, ${state} ${zip}`, lat, lng, score });
    }
    const seen = new Set();
    return out.sort((a, b) => a.score - b.score).filter((x) => !seen.has(x.t) && seen.add(x.t)).slice(0, max);
  }
  const ADDR_SUGGEST = suggestAddresses('210 franklin').concat(suggestAddresses('55 water st brooklyn'), suggestAddresses('350 5th ave new york'));
  const markTyped = (full, typed) => { const t = String(typed).trim().toLowerCase(); const i = t ? full.toLowerCase().indexOf(t) : -1; return i < 0 ? esc(full) : `${esc(full.slice(0, i))}<b>${esc(full.slice(i, i + t.length))}</b>${esc(full.slice(i + t.length))}`; };
  // Not in the list: offer the address exactly as typed (title-cased, NYC assumed when no city), so nobody is stuck.
  const typedOption = (typed, act, found) => {
    if (found) return '';
    const raw = String(typed).replace(/,\s*$/, '').trim(); if (!/^\d/.test(raw) || raw.split(/\s+/).length < 2) return `<div class="addr-none">Keep typing: house number and street, e.g. “92 McKinley Ave”.</div>`;
    const nice = raw.replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\b(Mc)([a-z])/g, (m, a, b) => a + b.toUpperCase());
    const full = /,/.test(nice) ? nice : `${nice}, Brooklyn, NY`;
    return `<button class="addr-opt addr-typed" role="option" data-a="${act}" data-v="${esc(full)}">${ic.pin}<span class="grow"><span class="addr-l1">Use “${esc(nice)}”</span><span class="addr-l2">Not in our suggestions. We’ll check it on the map before your order</span></span></button>`;
  };
  /** Dropdown of full-address suggestions under an address box. `act` is the data-a action that receives data-v. */
  const addrSuggestList = (typed, act, extra = () => '') => {
    const list = suggestAddresses(typed);
    if (String(typed).trim().length < 2) return '';
    return `<div class="addr-sugg" role="listbox" aria-label="Suggested addresses">${list.map((x, i) => `<button class="addr-opt" role="option" data-a="${act}" data-v="${esc(x.t)}" data-i="${i}">${ic.pin}<span class="grow"><span class="addr-l1">${markTyped(x.line, typed.match(/^\S+\s+(.*)/)?.[1] || typed)}</span><span class="addr-l2">${esc(x.city)}${extra(x)}</span></span></button>`).join('')}${typedOption(typed, act, list.length)}</div>`;
  };
  const geoFor = (text) => { const hit = suggestAddresses(String(text).split(',').slice(0, 2).join(' '), 1)[0] || suggestAddresses(String(text).split(',')[0], 1)[0]; return hit ? { lat: hit.lat, lng: hit.lng, exact: true } : { lat: 40.6782, lng: -73.9442, exact: false }; };
  const distMi = (a, b) => { const k = Math.PI / 180; const dLat = (b.lat - a.lat) * k; const dLng = (b.lng - a.lng) * k; const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * k) * Math.cos(b.lat * k) * Math.sin(dLng / 2) ** 2; return 2 * 3958.8 * Math.asin(Math.sqrt(x)); };

  // ── "Use my location" (like Uber Eats): GPS → nearest street → restaurants that deliver there. ──
  // Real apps: device location + reverse geocoding through the core API. Previews can't read GPS, so we fall back to a demo spot.
  const DEMO_SPOT = { lat: 40.6665, lng: -73.9818 };
  function nearestAddress(lat, lng) {
    let best = null, bestD = Infinity;
    for (const [name, city, state, zip, la, ln, range] of STREETS) { const d = distMi({ lat, lng }, { lat: la, lng: ln }); if (d < bestD) { bestD = d; best = { name, city, state, zip, la, ln, range }; } }
    if (!best || bestD > 40) return null;
    const house = typeof best.range[0] === 'string' ? best.range[0] : String(Math.max(best.range[0], Math.min(best.range[1], 400)));
    return { line: `${house} ${best.name}`, city: `${best.city}, ${best.state} ${best.zip}`, t: `${house} ${best.name}, ${best.city}, ${best.state} ${best.zip}`, lat, lng };
  }
  function locateMe() {
    return new Promise((resolve) => {
      let done = false;
      const finish = (lat, lng, real) => { if (done) return; done = true; const a = nearestAddress(lat, lng); resolve(a ? { ...a, real } : { outside: true, real }); };
      const demo = () => finish(DEMO_SPOT.lat, DEMO_SPOT.lng, false);
      try { navigator.geolocation.getCurrentPosition((p) => finish(p.coords.latitude, p.coords.longitude, true), demo, { timeout: 3500, maximumAge: 60000 }); } catch (e) { demo(); }
      setTimeout(demo, 4000);
    });
  }
  function setCurrentLocation(a) {
    S.addresses = S.addresses.filter((x) => x.id !== 'cur');
    S.addresses.unshift({ id: 'cur', label: 'Current location', line: a.line, city: a.city, note: '', lat: a.lat, lng: a.lng });
    S.addrId = 'cur'; S.locAsked = true;
    const near = R.filter((r) => distMi(a, r) <= r.radius).length;
    toast(near ? `${a.real ? '' : 'Demo location (previews can’t read GPS). '}${near} restaurant location${near === 1 ? '' : 's'} deliver to ${a.line}.` : `No restaurants deliver to ${a.line} yet. Try pickup or another address.`);
  }
  const gpsBtn = (target) => `<button type="button" class="gps-btn" data-a="gpsFill" data-target="${target}" aria-label="Use my current location" title="Use my current location">${S.locating === target ? '<span class="gps-spin" aria-hidden="true"></span>' : ic.gps}</button>`;
  const LOC_ART = '<svg class="loc-art" viewBox="0 0 120 120" aria-hidden="true"><rect x="4" y="4" width="112" height="112" rx="26" fill="#EAF1F8"/><path d="M4 78h112M4 96h112M38 4v112M82 4v112" stroke="#FFFFFF" stroke-width="7"/><path d="M14 112 L60 70 L112 40" stroke="#C9D6E4" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M60 22c-12 0-21 9-21 21 0 15 21 37 21 37s21-22 21-37c0-12-9-21-21-21z" fill="#E3242B"/><circle cx="60" cy="43" r="8" fill="#FFFFFF"/><circle cx="60" cy="88" r="9" fill="#0B3B6E"/><circle cx="60" cy="88" r="17" fill="none" stroke="#0B3B6E" stroke-opacity=".25" stroke-width="4"/><path d="M42 30a24 24 0 0 0 0 26M78 30a24 24 0 0 1 0 26" stroke="#0B3B6E" stroke-width="4" fill="none" stroke-linecap="round"/></svg>';

  // ---------- pricing (same rules as the payments service) ----------
  function deliveryShare(r, food) {
    const t = r.rule.type;
    const D = arguments[2];
    if (t === 'split') return Math.min(r.rule.cents, D);
    if (t === 'free') return D;
    if (t === 'freeOver') return food >= r.rule.over ? D : 0;
    return 0;
  }
  function quote(rid, lines, fulfil, tip) {
    const r = rest(rid);
    const food = lines.reduce((a, l) => a + l.unit * l.qty, 0);
    const t = tax(food);
    const tipC = fulfil === 'delivery' ? tip : 0;
    const P = READY ? courierQuote(dist(r)) : COURIER;
    const fee = fulfil === 'delivery' ? priceD((D) => deliveryShare(r, food, D), food, t, tipC, P) : 0;
    const share = fulfil === 'delivery' ? deliveryShare(r, food, fee) : 0;
    return { food, fee, share, tax: t, tip: tipC, total: food + fee - share + t + tipC };
  }
  const lineUnit = (it, sel) => it.price + (it.opts || []).reduce((a, g) => a + g.choices.filter((c) => (g.one ? sel[g.id] === c.id : sel[g.id] && sel[g.id][c.id])).reduce((x, c) => x + c.price, 0), 0);
  const lineDesc = (it, sel) => (it.opts || []).flatMap((g) => g.choices.filter((c) => (g.one ? sel[g.id] === c.id : sel[g.id] && sel[g.id][c.id])).map((c) => c.name)).join(' · ');

  // ---------- state ----------
  let orderSeq = 1048;
  function mkLine(rid, itemId, sel = {}, qty = 1) {
    const it = findItem(rest(rid), itemId);
    if (it.opts) for (const g of it.opts) if (g.one && !sel[g.id]) sel[g.id] = g.choices[0].id;
    return { itemId, name: it.name, img: it.img, sel, desc: lineDesc(it, sel), unit: lineUnit(it, sel), qty };
  }
  function seedOrder(id, rid, lines, status, when, tipPct = 18) {
    const food = lines.reduce((a, l) => a + l.unit * l.qty, 0);
    return { id, rid, lines, fulfil: 'delivery', q: quote(rid, lines, 'delivery', Math.round((food * tipPct) / 100)), status, when, timeline: [], addr: '210 Franklin Ave, Apt 2B', dropoff: 'door', pin: '5306' };
  }
  const S = {
    screen: PHONE ? (M.pwa ? 'install' : 'welcome') : 'home',
    stack: [],
    signedIn: false,
    phone: '', codeSent: false, code: '', newUser: false, name: '', addrText: '',
    user: { name: 'Shakib Haider', phone: '(718) 555-0199', email: '', emailVerified: false },
    // Promotional credit (BUSINESS_MODEL.md → Referral program): phone-verified accounts only, valid 30 days, used only at checkout.
    wallet: { balance: 1000, useCredit: true, history: [
      { id: 'w2', label: 'Referral reward: Nadia R.’s first order', cents: 500, when: 'Nov 3', note: 'Expires Dec 3' },
      { id: 'w1', label: 'Promo code BROOKLYN5', cents: 500, when: 'Nov 1', note: 'Expires Dec 1' },
    ], codes: ['BROOKLYN5'] },
    referral: { code: 'SHAKIB5', invites: [
      { name: 'Nadia R.', status: 'ordered', when: 'Nov 3' },
      { name: 'Leo M.', status: 'joined', when: 'Nov 6' },
      { name: 'Tom K.', status: 'invited', when: 'Nov 7' },
    ] },
    signupCode: '', signupCodeOk: null,
    cards: [{ id: 'c1', brand: 'Visa', last4: '4242', exp: '08/28', zip: '11205' }, { id: 'c2', brand: 'Mastercard', last4: '5454', exp: '03/27', zip: '11205' }],
    defaultCard: 'c1', promoQ: '', profile: null,
    addresses: [
      { id: 'home', label: 'Home', line: '210 Franklin Ave, Apt 2B', city: 'Brooklyn, NY 11205', note: 'Buzzer 2B', lat: 40.6890, lng: -73.9570 },
      { id: 'work', label: 'Work', line: '55 Water St', city: 'Brooklyn, NY 11201', note: '', lat: 40.7030, lng: -73.9910 },
    ],
    addrId: 'home', defaultAddr: 'home',
    q: '', cuisine: null, f: { halal: false, fast: false, free: false, delivers: false }, within: 0, addrQ: '',
    rid: null, tab: 0,
    cart: { rid: null, lines: [] },
    fulfil: 'delivery', tipPct: 18, tipCustom: '', pay: 'c1', courierNote: 'Buzzer 2B', dropoff: 'door',
    sheet: null, modal: null,
    orders: [
      seedOrder('SK1047', 'dhaka', [mkLine('dhaka', 'kac', { size: 'reg', ex: { raita: true } }), mkLine('dhaka', 'lassi', {}, 2)], 'delivered', 'Oct 30, 8:10 PM'),
      { ...seedOrder('SK1029', 'atl', [mkLine('atl', 'pep')], 'declined', 'Oct 24, 6:02 PM'), declineReason: 'Restaurant was too busy' },
    ],
    activeId: null, ordersTab: 'past', receiptId: null,
    notif: { updates: true, sms: true, offers: false },
    help: { orderId: 'SK1047', issue: 'missing', items: {}, note: '', sent: [] },
    installed: false, bannerHidden: false,
    addrForm: null,
    after: null,
    toast: '',
  };
  READY = true;
  const cartCount = () => S.cart.lines.reduce((a, l) => a + l.qty, 0);
  const tipCents = (food) => (S.tipPct === 'custom' ? Math.max(0, Math.round((parseFloat(S.tipCustom) || 0) * 100)) : Math.round((food * S.tipPct) / 100));
  const curQuote = () => {
    if (!S.cart.rid) return null;
    const food = S.cart.lines.reduce((a, l) => a + l.unit * l.qty, 0);
    const q = quote(S.cart.rid, S.cart.lines, S.fulfil, tipCents(food));
    // Send Koro credit: funded by Send Koro, never by the restaurant or the courier. The card is still charged at least $0.50 (Stripe minimum).
    // Credit covers only the restaurant's part (food + tax) and leaves 50¢ on it, so the delivery money and tip still fit in the application fee.
    const credit = S.signedIn && S.wallet.useCredit ? Math.max(0, Math.min(S.wallet.balance, q.food + q.tax - 50)) : 0;
    return credit ? { ...q, credit, total: q.total - credit } : q;
  };

  // ---------- navigation ----------
  const MAIN = ['home', 'search', 'orders', 'account'];
  function applyFulfil(screen) {
    if (!S.fulfilPref) S.fulfilPref = S.fulfil;
    const id = screen === 'restaurant' ? S.rid : ['cart', 'checkout'].includes(screen) ? S.cart.rid : null;
    if (!id) { S.fulfil = S.fulfilPref; return; }
    const r = rest(id); if (S.fulfilPref === 'delivery' && !delivers(r)) S.fulfil = 'pickup'; else if (S.fulfil === 'pickup' && S.fulfilPref === 'delivery' && delivers(r)) S.fulfil = 'delivery';
  }
  function go(screen, extra) {
    if (S.screen !== screen) S.stack.push(S.screen);
    if (screen === 'profile' && S.screen !== 'profile') S.profile = null;
    S.screen = screen;
    if (extra) Object.assign(S, extra);
    applyFulfil(screen);
    S.sheet = null; S.modal = null;
    render(true);
  }
  function tabTo(screen) { S.stack = []; S.screen = screen; applyFulfil(screen); S.sheet = null; S.modal = null; render(true); }
  function back() { S.screen = S.stack.pop() || 'home'; applyFulfil(S.screen); S.sheet = null; render(true); }
  let toastTimer;
  function toast(msg) { S.toast = msg; render(); clearTimeout(toastTimer); toastTimer = setTimeout(() => { S.toast = ''; render(); }, 2600); }
  function needSignIn(after) { S.after = after; go('signin'); toast('Sign in to continue. Your cart is saved.'); }

  // ---------- order simulation ----------
  const STEPS_DEL = [['waiting', 'Waiting for the restaurant', 'Card held, not charged'], ['accepted', 'Accepted, card charged', ''], ['preparing', 'Being prepared', ''], ['picked', 'Picked up by courier', ''], ['onway', 'On the way to you', ''], ['delivered', 'Delivered', 'Enjoy your meal']];
  const STEPS_PICK = [['waiting', 'Waiting for the restaurant', 'Card held, not charged'], ['accepted', 'Accepted, card charged', ''], ['preparing', 'Being prepared', ''], ['ready', 'Ready for pickup', ''], ['collected', 'Picked up', 'Enjoy your meal']];
  const DELAYS = { waiting: 7000, accepted: 4000, preparing: 6000, picked: 5000, onway: 8000, ready: 8000 };
  const stepsFor = (o) => (o.fulfil === 'pickup' ? STEPS_PICK : STEPS_DEL);
  const nowTime = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  function advance(o) {
    if (o.status === 'declined') return;
    const steps = stepsFor(o);
    const i = steps.findIndex((s) => s[0] === o.status);
    if (i < 0 || i >= steps.length - 1) return;
    o.status = steps[i + 1][0];
    o.timeline.push([o.status, nowTime()]);
    if (o.status === 'accepted') toast(`${rest(o.rid).name} accepted. Your card was charged ${money(o.q.total)}.`);
    if (o.status === 'delivered' || o.status === 'collected') toast('Order complete. Enjoy!');
    schedule(o);
    if (['confirm', 'track', 'orders', 'home'].includes(S.screen)) render();
  }
  function schedule(o) { clearTimeout(o.timer); const d = DELAYS[o.status]; if (d) o.timer = setTimeout(() => advance(o), d); }
  function decline(o, reason) {
    clearTimeout(o.timer);
    o.status = 'declined'; o.declineReason = reason; o.timeline.push(['declined', nowTime()]);
    toast('The restaurant declined. The hold on your card was released. You paid nothing.');
    render();
  }

  // ---------- small views ----------
  const stars = (r) => `<span style="color:var(--o2);font-weight:800">★ ${r.rating}</span> <span class="mut">(${r.reviews})</span>`;
  const PAGE_INFO = {
    'Sign in': ['Welcome', 'Sign in with a text code. No passwords.'],
    'Your cart': ['Almost there', 'Check your dishes before checkout.'],
    'Checkout': ['Secure checkout', 'Charged only when the kitchen accepts.'],
    'Order placed': ['Thank you', 'Your order is on its way to the kitchen.'],
    'Live tracking': ['On its way', 'Follow your order in real time.'],
    'Delivery address': ['Deliver to', 'Choose where your food should go.'],
    'New address': ['Add an address', 'Save it once, use it every time.'],
    'Help': ['We’re here', 'Most problems are sorted within the hour.'],
    'Orders': ['Your orders', 'Track, reorder and get receipts.'],
    'Account': ['Your account', 'Profile, wallet, payment and addresses.'],
    'Profile': ['Your account', 'Name, mobile number and email.'],
    'Wallet': ['Send Koro credit', 'Promo credit you can use on any order.'],
    'Payment methods': ['Your account', 'Cards, Apple Pay and Google Pay.'],
    'Refer a friend': ['Give $5, get $5', 'Share your link. You both get credit.'],
  };
  function pageHero(title, opts = {}) {
    const [eyebrow, sub] = PAGE_INFO[title] || ['', ''];
    return `<div class="cx-hero-top">${opts.noBack ? '' : `<button class="cx-back" data-a="back" aria-label="Back">${ic.back}</button>`}<div class="cx-hero-tx">${eyebrow ? `<span class="cx-eyebrow">${esc(eyebrow)}</span>` : ''}<h1>${esc(opts.label || title)}</h1>${sub ? `<p>${esc(opts.sub || sub)}</p>` : ''}</div>${opts.right || ''}</div>`;
  }
  function topbar(title, opts = {}) {
    if (!PHONE) return '';
    return pageHero(title, opts);
  }

  function webBack(label) { return PHONE ? '' : `<button class="btn gh" data-a="back" style="align-self:flex-start;padding:0">← ${esc(label)}</button>`; }
  function restCard(r, compact) {
    if (compact || PHONE) return `<button class="card" data-a="openRest" data-id="${r.id}" style="display:flex;gap:12px;padding:10px;text-align:left;width:100%"><img src="${IMG(r.img)}" alt="" style="width:104px;height:84px;border-radius:10px;object-fit:cover;flex:none"><span class="col" style="gap:3px;min-width:0"><b style="font-size:16px">${esc(r.name)}</b><span class="mut sm-t">${esc(r.cuisine)} · ${esc(r.area)}${r.tags.includes('halal') ? ' · Halal' : ''}</span><span class="sm-t">${stars(r)} <span class="mut">· ${r.eta} min</span></span>${deliveryLine(r)}</span></button>`;
    return `<button class="card" data-a="openRest" data-id="${r.id}" style="display:flex;flex-direction:column;overflow:hidden;text-align:left;padding:0"><img src="${IMG(r.img)}" alt="" style="width:100%;height:170px;object-fit:cover"><span class="col" style="gap:4px;padding:12px 14px 14px"><b style="font-size:17px">${esc(r.name)} <span class="mut" style="font-weight:600;font-size:14px">· ${esc(r.area)}</span></b><span class="sm-t">${stars(r)} <span class="mut">· ${esc(r.cuisine)} · ${r.eta} min</span></span>${deliveryLine(r)}</span></button>`;
  }
  // Deal badge from the restaurant's own delivery rule (never names the courier).
  const dealTag = (r) => ({ free: 'Free delivery', freeOver: `Free delivery over ${money(r.rule.over)}`, split: `${money(r.rule.cents)} off delivery` }[r.rule.type] || '');
  function homeCard(r) {
    const deal = dealTag(r); const w = PHONE ? '100%' : 'auto';
    return `<button class="lx-card" data-a="openRest" data-id="${r.id}" style="width:${w};${r.closed ? 'opacity:.62;filter:grayscale(.5)' : ''}"><span class="lx-img"><img src="${IMG(r.img)}" alt="" loading="lazy">${deal ? `<span class="lx-deal">${esc(deal)}</span>` : ''}<span class="lx-eta">${r.eta} min</span></span><span class="col" style="gap:3px;padding:12px 14px 14px;min-width:0"><span class="row" style="gap:8px;align-items:flex-start"><b class="grow" style="font-size:17px;letter-spacing:-.01em">${esc(r.name)}</b><span class="lx-rate">★ ${r.rating}</span></span><span class="mut sm-t">${esc(r.cuisine)} · ${esc(r.area)}${r.tags.includes('halal') ? ' · Halal' : ''} · ${esc(r.reviews)} ratings</span>${deliveryLine(r)}</span></button>`;
  }
  function promos() {
    const P2 = [
      { rid: 'atl', kick: 'Free delivery', head: 'Atlantic Pizza Co. pays your delivery', sub: 'Every order · Boerum Hill', img: 'pizza', tone: '#7A1F0E' },
      { rid: 'koro', kick: 'Over $30', head: 'Free delivery on Koro Ramen', sub: 'Rich tonkotsu, 20–35 min', img: 'ramen', tone: '#2B1A0F' },
      { rid: 'bbc', kick: '$3 off delivery', head: 'Brooklyn Bowl Co. pays part', sub: 'Halal bowls · Park Slope', img: 'hero_bowl', tone: '#1C1814' },
      { pickup: true, kick: 'Pickup', head: 'Skip the delivery fee', sub: 'Order ahead, collect when it’s ready', img: 'biryani', tone: '#5A2A00' },
    ];
    return `<div class="lx-promos" role="list">${P2.map((x) => `<button role="listitem" class="lx-promo" ${x.pickup ? 'data-a="fulfil" data-v="pickup"' : `data-a="openRest" data-id="${x.rid}"`} style="--tone:${x.tone}"><img src="${IMG(x.img)}" alt=""><span class="lx-promo-t"><span class="lx-kick">${esc(x.kick)}</span><b>${esc(x.head)}</b><span>${esc(x.sub)}</span><span class="lx-cta">${x.pickup ? 'Switch to pickup' : 'Order now'} →</span></span></button>`).join('')}</div>`;
  }
  const promises = () => `<div class="lx-promise">${[['$0', 'service fees'], ['100%', 'of tips to couriers'], ['Hold', 'charged on accept']].map(([b, t]) => `<span><b>${b}</b>${t}</span>`).join('')}</div>`;
  function filtered() {
    const q = S.q.trim().toLowerCase();
    return R.filter((r) => {
      if (S.cuisine && r.cuisine !== S.cuisine) return false;
      if (S.f.halal && !r.tags.includes('halal')) return false;
      if (S.f.fast && r.etaMax > 30) return false;
      if (S.f.free && !['free', 'freeOver'].includes(r.rule.type)) return false;
      if (S.f.delivers && S.fulfil === 'delivery' && !delivers(r)) return false;
      if (!q) return true;
      const hay = [r.name, r.cuisine, r.area, ...r.menu.flatMap((s) => s.items.map((i) => i.name))].join(' ').toLowerCase();
      return hay.includes(q);
    }).sort((a, b) => (S.fulfil === 'delivery' ? (delivers(b) - delivers(a)) : 0) || dist(a) - dist(b));
  }
  function receiptRows(q, r, fulfil) {
    return `<div class="rw"><span class="mut">Food</span><span>${money(q.food)}</span></div>
      ${fulfil === 'delivery' ? `<div class="rw"><span class="mut">Delivery fee</span><span>${money(q.fee)}</span></div>${q.share ? `<div class="rw save"><span>${q.share === q.fee ? 'Free delivery from ' + esc(r.name) : esc(r.name) + ' pays part'}</span><span>${money(-q.share)}</span></div>` : ''}` : '<div class="rw"><span class="mut">Pickup</span><span>No delivery fee</span></div>'}
      <div class="rw"><span class="mut">Tax (set by restaurant)</span><span>${money(q.tax)}</span></div>
      ${fulfil === 'delivery' ? `<div class="rw"><span class="mut">Courier tip · 100% to courier</span><span>${money(q.tip)}</span></div>` : ''}
      ${q.credit ? `<div class="rw save"><span>Send Koro credit (promo)</span><span>${money(-q.credit)}</span></div>` : ''}
      <div class="rw tot"><span>${q.credit ? 'Card total' : 'Total'}</span><span>${money(q.total)}</span></div>`;
  }

  const BRAND_BG = { Visa: '#0B3B6E', Mastercard: '#0E1E33', Amex: '#5B6B80', Discover: '#C81E24' };
  const cardPill = (c) => `<span class="pm-brand" style="background:${BRAND_BG[c.brand] || '#0B3B6E'}">${esc(c.brand === 'Mastercard' ? 'MC' : c.brand.toUpperCase())}</span>`;
  const cardById = (id) => S.cards.find((c) => c.id === id);
  const accRow = (to, icon, title, sub, right = '') => `<button class="acc-row" data-a="go" data-to="${to}"><span class="acc-ic" aria-hidden="true">${icon}</span><span class="grow" style="min-width:0"><b>${title}</b><span class="mut sm-t" style="display:block">${sub}</span></span>${right}<span class="acc-go" aria-hidden="true">›</span></button>`;

  // "Complete your meal" (like Uber Eats / DoorDash): other dishes from the same restaurant, drinks and sides first, one tap to add.
  function completeMeal(r) {
    const inCart = new Set(S.cart.lines.map((l) => l.itemId));
    const pool = r.menu.flatMap((sec, si) => sec.items.map((it) => ({ it, si }))).filter(({ it }) => !inCart.has(it.id) && !it.soldOut);
    const pick = [...pool.filter((x) => x.si > 0), ...pool.filter((x) => x.si === 0)].slice(0, 6);
    if (!pick.length) return '';
    return `<div class="col" style="gap:8px;padding-top:10px;border-top:1px solid var(--line)"><b>Complete your meal</b><div class="cm-row">${pick.map(({ it }) => `<div class="cm-card">${it.img ? `<img src="${IMG(it.img)}" alt="">` : `<span class="cm-ph" aria-hidden="true">${it.name[0]}</span>`}<button class="cm-add" data-a="quickAdd" data-id="${it.id}" aria-label="Add ${esc(it.name)}">+</button><b>${esc(it.name)}</b><span class="mut sm-t">${money(it.price)}</span></div>`).join('')}</div></div>`;
  }

  // ---------- screens ----------
  const V = {};
  V.welcome = () => `<div class="col" style="min-height:100%;gap:0">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:16px 14px 0">
      <img src="${IMG('ramen')}" alt="" style="width:100%;height:140px;object-fit:cover;border-radius:22px"><img src="${IMG('burger2')}" alt="" style="width:100%;height:170px;object-fit:cover;border-radius:22px">
      <img src="${IMG('salad')}" alt="" style="width:100%;height:140px;object-fit:cover;border-radius:22px;margin-top:-30px"><img src="${IMG('pizza')}" alt="" style="width:100%;height:110px;object-fit:cover;border-radius:22px">
    </div>
    <div class="col" style="padding:20px 24px 28px;gap:14px;margin-top:auto">
      <span class="logo" style="font-size:34px;color:var(--ink)">${LOGO('#E2B04A', 70)}${WORD}</span>
      <h1 style="font-size:36px;line-height:1.04;letter-spacing:-.03em;color:var(--ink)">Your neighborhood. <span style="color:var(--o2)">Delivered.</span></h1>
      <p class="mut" style="margin:0">Local Brooklyn restaurants at their own prices. No service fees, and your whole tip goes to your courier.</p>
      <button class="btn" data-a="go" data-to="signin">Get started</button>
      <button class="btn ln" data-a="go" data-to="signin" style="min-height:52px;font-size:17px">Sign in</button>
      <button class="btn gh" data-a="tab" data-to="home">Browse first</button>
    </div></div>`;

  V.install = () => `<div class="col" style="padding:24px;gap:16px">
    <span class="sk-icon" style="width:96px;height:96px;border-radius:24px;background:#EEF3F8;border:1px solid #DCE5EF;display:flex;align-items:center;justify-content:center">${LOGO('#E2B04A', 74)}</span>
    <h1 style="font-size:28px;line-height:1.1;color:var(--ink)">Put Send Koro on your home screen</h1>
    <p class="mut" style="margin:0">Opens full screen like an app, with order updates. No app store needed.</p>
    <div class="card pad col"><b>On iPhone (Safari)</b><span>1. Tap the <b>Share</b> button</span><span>2. Choose <b>Add to Home Screen</b></span><span>3. Tap <b>Add</b></span><span class="mut sm-t">On Android, tap Install when Chrome asks.</span></div>
    <button class="btn" data-a="install">${S.installed ? 'Installed ✓' : 'Install Send Koro'}</button>
    <button class="btn gh" data-a="tab" data-to="home">${S.installed ? 'Open Send Koro' : 'Not now, keep browsing'}</button></div>`;

  V.signin = () => {
    const step = !S.codeSent ? 1 : S.newUser ? 3 : 2;
    return `${PHONE ? `<div class="cx-sign"><img src="${IMG('hero_bowl')}" alt=""><button class="cx-back" data-a="back" aria-label="Back">${ic.back}</button><span class="logo" style="font-size:26px;color:#fff">${LOGO('#E2B04A', 52)}${WORD}</span></div>` : ''}<div class="col ${PHONE ? 'cx-sheetcard' : 'card pad'}" style="padding:${PHONE ? '24px 20px' : '28px'};gap:16px;${PHONE ? '' : 'max-width:520px;margin:20px auto 0;width:100%'}">
      ${webBack('Back')}
      <div><h1 style="font-size:32px;color:var(--ink)">${step === 3 ? 'Welcome! Two quick details' : 'Sign in or create an account'}</h1><p class="mut" style="margin:6px 0 0">${step === 1 ? 'Enter your mobile number. We’ll text you a 6-digit code.' : step === 2 ? `Enter the code we sent to ${esc(S.phone)}. <b>Prototype: any 6 digits work.</b>` : 'We use these for your deliveries.'}</p></div>
      ${step === 1 ? `<label class="f">Mobile number<span class="row"><span class="in" style="width:64px;display:flex;align-items:center;font-weight:800">+1</span><input class="in" id="ph" data-m="phone" inputmode="tel" placeholder="(718) 555-0199" value="${esc(S.phone)}"></span></label>
        <label class="row sm-t"><input type="checkbox" id="nu" data-m="newUserPick" ${S.newUserPick ? 'checked' : ''}>I’m new to Send Koro</label>
        <button class="btn" data-a="sendCode">Text me a code</button>` : ''}
      ${step === 2 ? `<label class="f">6-digit code<input class="in" id="code" data-m="code" inputmode="numeric" maxlength="6" placeholder="123456" value="${esc(S.code)}" style="font-size:22px;letter-spacing:.4em;font-weight:800;text-align:center"></label>
        <div class="row between sm-t"><button class="btn gh" data-a="changePhone" style="padding:0">Change number</button><button class="btn gh" data-a="resend" style="padding:0">Resend code</button></div>
        <button class="btn" data-a="verify">Continue</button>` : ''}
      ${step === 3 ? `<label class="f">Your name<input class="in" id="nm" data-m="name" value="${esc(S.name)}" placeholder="First and last name"></label>
        <label class="f">Delivery address<span class="in-gps"><input class="in" id="na" data-m="addrText" data-live="1" autocomplete="off" value="${esc(S.addrText)}" placeholder="Start typing your address, e.g. 210 Franklin">${gpsBtn('signup')}</span></label>
        ${S.addrText && !S.addrPicked ? addrSuggestList(S.addrText, 'pickSignupAddr') : ''}
        ${S.signupCodeOpen || S.signupCode ? `<label class="f">Promo or referral code <span class="mut" style="font-weight:600">(optional)</span><span class="row" style="gap:8px"><input class="in grow" id="sc" data-m="signupCode" data-live="1" autocomplete="off" value="${esc(S.signupCode)}" placeholder="e.g. NADIA5" style="text-transform:uppercase;min-width:0"><button class="btn ln sm" data-a="checkSignupCode" type="button">Apply</button></span></label>${S.signupCodeOk === true ? `<div class="note n-g sm-t">✓ ${esc(S.signupCodeMsg)}</div>` : S.signupCodeOk === false ? `<div class="note n-w sm-t">${esc(S.signupCodeMsg)}</div>` : ''}` : `<button class="btn gh" data-a="openSignupCode" style="align-self:flex-start;padding:0;font-size:14px">+ Add a promo or referral code (optional)</button>`}
        <button class="btn" data-a="finishProfile">Create account</button>` : ''}
      <p class="mut sm-t" style="margin:0;text-align:center">By continuing you agree to the Terms of Service. <button class="btn gh" data-a="tab" data-to="home" style="min-height:0;padding:0;font-size:13px">Browse as a guest</button></p>
    </div>`;
  };

  // Trial look (navy + red), Home only. Turned on by SK_MODE.theme = 'navy'.
  function navyHome(list, activeBar) {
    const sort = S.navySort || '';
    const sorted = sort === 'rating' ? [...list].sort((a, b) => b.rating - a.rating) : sort === 'time' ? [...list].sort((a, b) => a.eta.split('–')[0] - b.eta.split('–')[0]) : sort === 'offers' ? [...list].sort((a, b) => (dealTag(b) ? 1 : 0) - (dealTag(a) ? 1 : 0)) : list;
    const count = cartCount();
    const card = (r) => { const deal = dealTag(r); return `<button class="nv-card" data-a="openRest" data-id="${r.id}" style="${r.closed ? 'opacity:.6' : ''}"><span class="nv-img"><img src="${IMG(r.img)}" alt="" loading="lazy">${deal ? `<span class="nv-badge">${esc(deal)}</span>` : ''}</span><span class="nv-body"><b class="nv-name">${esc(r.name)}</b><span class="nv-meta">${esc(r.cuisine)} • ${esc(r.area)}${r.tags.includes('halal') ? ' • Halal' : ''}</span><span class="nv-stats"><span><i class="nv-star">★</i> <b>${r.rating}</b> (${esc(r.reviews)})</span><span class="nv-sep"></span><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg> ${r.eta} min</span></span>${deliveryLine(r)}</span></button>`; };
    const pill = (k, l, icon) => `<button class="nv-pill ${sort === k ? 'on' : ''}" data-a="navySort" data-v="${k}" aria-pressed="${sort === k}">${icon}${l}<span class="addr-chev" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button>`;
    return `<header class="nv-head"><span class="nv-logo">${LOGO('', 40)}${WORD}</span><span class="grow"></span>${S.signedIn ? `<span class="nv-av">${esc((S.user.name || 'A')[0])}</span>` : '<button class="nv-sign" data-a="go" data-to="signin">Sign in</button>'}<button class="nv-cart" data-a="go" data-to="cart" aria-label="Cart, ${count} items"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.6 12.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.5L21 8H6"/></svg>${count ? `<i>${count}</i>` : ''}</button></header>
      <button class="nv-deliver" data-a="go" data-to="addresses">${ic.pin}<span><small>${S.fulfil === 'pickup' ? 'Pickup near' : 'Deliver to'}</small><b>${esc(addr().label)} · ${esc(addr().line)}</b></span><span class="addr-chev" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button>
      <section class="nv-hero">
        <div class="nv-plates" aria-hidden="true"><img src="${IMG('burger')}" alt="" class="p1"><img src="${IMG('pizza')}" alt="" class="p2"><img src="${IMG('biryani')}" alt="" class="p3"></div>
        <h1>Your neighborhood. Delivered.</h1><i class="nv-rule"></i>
        <p>Discover food from local restaurants.</p>
        <div class="nv-toggle" role="tablist" aria-label="Delivery or pickup"><button role="tab" aria-selected="${S.fulfil === 'delivery'}" class="${S.fulfil === 'delivery' ? 'on' : ''}" data-a="fulfil" data-v="delivery">Delivery</button><button role="tab" aria-selected="${S.fulfil === 'pickup'}" class="${S.fulfil === 'pickup' ? 'on' : ''}" data-a="fulfil" data-v="pickup">Pickup</button></div>
        <div class="nv-find"><label>${ic.search}<input id="hq" data-m="q" data-live="homeList" placeholder="Search food or restaurants" value="${esc(S.q)}"></label><button data-a="navyFind">Find food</button></div>
      </section>
      <div class="col" style="padding:18px 16px 24px;gap:22px">
        ${activeBar}
        <div class="cuis-wrap"><button class="cuis-arrow l" data-a="cuisScroll" data-d="-1" aria-label="Previous cuisines"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button><div class="nv-cuis">${CUISINES.map(([c, img]) => `<button class="${S.cuisine === c ? 'on' : ''}" data-a="cuisine" data-c="${c}" aria-pressed="${S.cuisine === c}"><img src="${IMG(img)}" alt="">${c}</button>`).join('')}</div><button class="cuis-arrow r" data-a="cuisScroll" data-d="1" aria-label="More cuisines"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>
        <div class="col" style="gap:12px"><h2 class="nv-h2">${S.cuisine || S.q ? `${list.length} restaurant${list.length === 1 ? '' : 's'}` : 'Popular near you'}</h2>
          <div class="nv-pills">${pill('rating', 'Rating', '<i class="nv-star">★</i>')}${pill('time', 'Delivery time', '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>')}${pill('offers', 'Offers', '% ')}</div></div>
        <div class="col" id="homeList" style="gap:16px">${sorted.map(card).join('') || '<div class="empty">No restaurants match. Try another cuisine.</div>'}</div>
        <div class="nv-ban"><div><b>Local favorites, one easy order.</b><i class="nv-rule"></i><span>From burgers to biryani, get the food you love, delivered to your door.</span></div><img src="${IMG('pizza')}" alt=""></div>
        <div class="nv-ban light"><div><b>Own a restaurant? Grow with Send Koro.</b><i class="nv-rule"></i><span>Zero commission. Simple monthly plans.</span><button class="nv-red" data-a="toastMsg" data-msg="Opens restaurant sign-up (prototype)">Become a partner</button></div><svg viewBox="0 0 64 56" width="70" aria-hidden="true"><path d="M6 20 L10 6 H54 L58 20Z" fill="#E3242B"/><path d="M10 6h8l-2 14H6zM26 6h6v14h-8zM40 6h6l4 14h-10z" fill="#fff"/><rect x="9" y="22" width="46" height="30" fill="none" stroke="#0B3B6E" stroke-width="4"/><rect x="16" y="29" width="14" height="10" fill="#0B3B6E"/><rect x="36" y="29" width="12" height="23" fill="#0B3B6E"/></svg></div>
      </div>
      <footer class="nv-foot"><span class="nv-logo inv">${LOGO('', 44)}${WORD}</span><div>${['About', 'Restaurants', 'Help', 'Privacy', 'Terms'].map((l) => `<button data-a="toastMsg" data-msg="${l} (prototype)">${l}</button>`).join('')}</div></footer>`;
  }
  function navyHomeWeb(list, activeBar) {
    const sort = S.navySort || '';
    const sorted = sort === 'rating' ? [...list].sort((a, b) => b.rating - a.rating) : sort === 'time' ? [...list].sort((a, b) => a.eta.split('–')[0] - b.eta.split('–')[0]) : sort === 'offers' ? [...list].sort((a, b) => (dealTag(b) ? 1 : 0) - (dealTag(a) ? 1 : 0)) : list;
    const clock = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
    const card = (r) => { const deal = dealTag(r); return `<button class="nv-card" data-a="openRest" data-id="${r.id}" style="${r.closed ? 'opacity:.6' : ''}"><span class="nv-img" style="height:190px"><img src="${IMG(r.img)}" alt="" loading="lazy">${deal ? `<span class="nv-badge">${esc(deal)}</span>` : ''}</span><span class="nv-body"><b class="nv-name">${esc(r.name)}</b><span class="nv-meta">${esc(r.cuisine)} • ${esc(r.area)}${r.tags.includes('halal') ? ' • Halal' : ''}</span><span class="nv-stats"><span><i class="nv-star">★</i> <b>${r.rating}</b> (${esc(r.reviews)})</span><span class="nv-sep"></span><span>${clock} ${r.eta} min</span></span>${deliveryLine(r)}</span></button>`; };
    const pill = (k, l, icon) => `<button class="nv-pill ${sort === k ? 'on' : ''}" data-a="navySort" data-v="${k}" aria-pressed="${sort === k}">${icon}${l}<span class="addr-chev" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button>`;
    return `<section class="nvw-hero"><div class="nvw-hero-tx"><h1>Your neighborhood. Delivered.</h1><i class="nv-rule"></i><p>Discover food from local Brooklyn restaurants. No service fees, and every tip goes to your courier.</p>
        <div class="nv-toggle" role="tablist" aria-label="Delivery or pickup"><button role="tab" aria-selected="${S.fulfil === 'delivery'}" class="${S.fulfil === 'delivery' ? 'on' : ''}" data-a="fulfil" data-v="delivery">Delivery</button><button role="tab" aria-selected="${S.fulfil === 'pickup'}" class="${S.fulfil === 'pickup' ? 'on' : ''}" data-a="fulfil" data-v="pickup">Pickup</button></div>
        <div class="nv-find" style="max-width:540px"><label>${ic.search}<input id="hq" data-m="q" data-live="homeList" placeholder="Search food, cuisines or restaurants" value="${esc(S.q)}"></label><button data-a="navyFind">Find food</button></div></div>
        <div class="nvw-collage" aria-hidden="true"><img src="${IMG('burger')}" class="a" alt=""><img src="${IMG('biryani')}" class="b" alt=""><img src="${IMG('pizza')}" class="c" alt=""><img src="${IMG('salad')}" class="d" alt=""><img src="${IMG('ramen')}" class="e" alt=""></div></section>
      ${activeBar}
      <div class="cuis-wrap"><button class="cuis-arrow l" data-a="cuisScroll" data-d="-1" aria-label="Previous cuisines"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button><div class="nv-cuis nvw-cuis">${CUISINES.map(([c, img]) => `<button class="${S.cuisine === c ? 'on' : ''}" data-a="cuisine" data-c="${c}" aria-pressed="${S.cuisine === c}"><img src="${IMG(img)}" alt="">${c}</button>`).join('')}</div><button class="cuis-arrow r" data-a="cuisScroll" data-d="1" aria-label="More cuisines"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>
      <div class="nvw-band"><div class="row between wrap" style="gap:12px;align-items:center"><h2 class="nv-h2" style="font-size:36px!important">${S.cuisine || S.q ? `${list.length} restaurant${list.length === 1 ? '' : 's'}` : 'Popular near you'}</h2><div class="nv-pills">${pill('rating', 'Rating', '<i class="nv-star">★</i>')}${pill('time', 'Delivery time', clock)}${pill('offers', 'Offers', '% ')}</div></div>
        <div id="homeList" class="nvw-grid">${sorted.map(card).join('') || '<div class="empty">No restaurants match. Try another cuisine.</div>'}</div></div>
      <div class="nvw-bans"><div class="nv-ban"><div><b style="font-size:32px">Local favorites, one easy order.</b><i class="nv-rule"></i><span style="font-size:16px">From burgers to biryani, get the food you love, delivered to your door.</span></div><img src="${IMG('pizza')}" alt="" style="width:200px;height:200px;margin-right:-50px"></div>
        <div class="nv-ban light"><div><b style="font-size:32px">Own a restaurant? Grow with Send Koro.</b><i class="nv-rule"></i><span style="font-size:16px">Zero commission. Simple monthly plans.</span><button class="nv-red" data-a="toastMsg" data-msg="Opens restaurant sign-up (prototype)">Become a partner</button></div><svg viewBox="0 0 64 56" width="120" aria-hidden="true"><path d="M6 20 L10 6 H54 L58 20Z" fill="#E3242B"/><path d="M10 6h8l-2 14H6zM26 6h6v14h-8zM40 6h6l4 14h-10z" fill="#fff"/><rect x="9" y="22" width="46" height="30" fill="none" stroke="#0B3B6E" stroke-width="4"/><rect x="16" y="29" width="14" height="10" fill="#0B3B6E"/><rect x="36" y="29" width="12" height="23" fill="#0B3B6E"/></svg></div></div>`;
  }
  V.home = () => {
    const list = filtered();
    const chips = `<div class="chips">${[['delivers', 'Delivers to me'], ['halal', 'Halal'], ['fast', 'Under 30 min'], ['free', 'Free or cheap delivery']].map(([k, l]) => `<button class="chip ${S.f[k] ? 'on' : ''}" data-a="filter" data-k="${k}" aria-pressed="${S.f[k]}">${l}</button>`).join('')}${S.cuisine ? `<button class="chip on" data-a="cuisine" data-c="">${esc(S.cuisine)} ✕</button>` : ''}</div>`;
    const tiles = `<div class="lx-cuis">${CUISINES.map(([c, img]) => `<button class="lx-cu ${S.cuisine === c ? 'on' : ''}" data-a="cuisine" data-c="${c}" aria-pressed="${S.cuisine === c}"><img src="${IMG(img)}" alt="">${c}</button>`).join('')}</div>`;
    const seg = `<div class="lx-seg" role="tablist" aria-label="Delivery or pickup"><button role="tab" aria-selected="${S.fulfil === 'delivery'}" class="${S.fulfil === 'delivery' ? 'on' : ''}" data-a="fulfil" data-v="delivery">Delivery</button><button role="tab" aria-selected="${S.fulfil === 'pickup'}" class="${S.fulfil === 'pickup' ? 'on' : ''}" data-a="fulfil" data-v="pickup">Pickup</button></div>`;
    const hd = (t, sub) => `<div class="row between" style="align-items:flex-end"><div><h2 class="lx-h">${t}</h2>${sub ? `<span class="mut sm-t">${sub}</span>` : ''}</div></div>`;
    const browsing = !(S.cuisine || S.q);
    const active = S.orders.find((o) => !['delivered', 'collected', 'declined'].includes(o.status));
    const activeBar = active ? `<button class="note n-g" data-a="track" data-id="${active.id}" style="border:0;text-align:left;display:flex;align-items:center;gap:10px;width:100%"><b class="grow">${esc(rest(active.rid).name)}: ${esc(stepsFor(active).find((s) => s[0] === active.status)[1])}</b><span>Track →</span></button>` : '';
    if (PHONE && M.theme === 'navy') return navyHome(list, activeBar);
    if (PHONE) return `<div class="lx-top col">
        <div class="row"><span class="logo" style="font-size:22px">${LOGO()}${WORD}</span><span class="grow"></span>${S.signedIn ? `<span class="lx-av">${esc((S.user.name || 'A')[0])}</span>` : '<button class="btn sm" data-a="go" data-to="signin">Sign in</button>'}</div>
        <button data-a="go" data-to="addresses" class="lx-addr">${ic.pin}<span class="grow" style="min-width:0"><span style="display:block;font-size:12px;color:#CDB894;font-weight:700;letter-spacing:.06em">${S.fulfil === 'pickup' ? 'PICKUP NEAR' : 'DELIVER TO'}</span><b>${esc(addr().label)} · ${esc(addr().line)}</b></span><span class="addr-chev on-dark" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button>
        <h1 class="lx-hello">${S.signedIn && S.user.name ? `Hungry, ${esc(S.user.name.split(' ')[0])}?` : 'What are you craving?'}</h1>
        <label class="lx-search">${ic.search}<input id="hq" data-m="q" data-live="homeList" placeholder="Biryani, ramen, pizza…" value="${esc(S.q)}"></label>
        ${seg}
      </div>
      <div class="col" style="padding:16px 16px 22px;gap:18px">
        ${activeBar}
        ${browsing ? promos() : ''}
        ${tiles}${chips}
        ${hd(browsing ? 'Popular near you' : `${list.length} restaurant${list.length === 1 ? '' : 's'}`, browsing ? 'Loved by Brooklyn this week' : '')}
        <div class="col" id="homeList" style="gap:16px">${list.map((r) => homeCard(r)).join('') || '<div class="empty">No restaurants match. Try fewer filters.</div>'}</div>
        ${promises()}
      </div>${phoneFooter()}`;
    if (M.theme === 'navy') return navyHomeWeb(list, activeBar);
    return `<section class="lx-hero">
        <div class="col" style="flex:1 1 420px;gap:18px;min-width:0;position:relative;z-index:1">
          <span class="lx-kick" style="align-self:flex-start">Brooklyn’s local favourites</span>
          <h1 class="lx-hero-h">Your neighborhood.<br><span>Delivered.</span></h1>
          <p style="margin:0;font-size:18px;max-width:500px;color:#E6D8BF">Great food from local restaurants. No service fees from us, and every dollar you tip goes to your courier.</p>
          ${seg}
          <label class="lx-search" style="max-width:580px;height:58px">${ic.search}<input id="hq" data-m="q" data-live="homeList" placeholder="Search for food, cuisines or restaurants" value="${esc(S.q)}"></label>
          <button data-a="go" data-to="addresses" class="lx-addr" style="align-self:flex-start;max-width:100%">${ic.pin}<span style="min-width:0"><b>${S.fulfil === 'pickup' ? 'Pickup near' : 'Delivering to'} ${esc(addr().label)}</b> · ${esc(addr().line)}</span><span style="text-decoration:underline">Change</span></button>
        </div>
        <div class="lx-collage" aria-hidden="true">
          <img src="${IMG('hero_bowl')}" alt="" class="c1"><img src="${IMG('ramen')}" alt="" class="c2"><img src="${IMG('pizza')}" alt="" class="c3">
          <span class="lx-float f1"><b>★ 4.8</b> Brooklyn Bowl Co.</span><span class="lx-float f2"><b>$0</b> service fees</span><span class="lx-float f3"><b>100%</b> of tips to couriers</span>
        </div>
      </section>
      ${activeBar}
      ${browsing ? `${hd('Deals near you', 'Paid for by the restaurants themselves')}${promos()}` : ''}
      ${hd('Explore by cuisine')}${tiles}
      <div class="row between wrap" style="align-items:flex-end"><h2 class="lx-h">${browsing ? 'Popular in Brooklyn' : `${list.length} restaurant${list.length === 1 ? '' : 's'}`}</h2>${chips}</div>
      <div id="homeList" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:22px">${list.map((r) => homeCard(r)).join('') || '<div class="empty">No restaurants match. Try fewer filters.</div>'}</div>`;
  };

  V.search = () => {
    const list = filtered();
    return `${PHONE ? `<div style="background:var(--g);padding:14px 12px" class="row"><label class="row grow" style="height:46px;padding:0 12px;border-radius:999px;background:var(--card)">${ic.search}<input id="sq" data-m="q" data-live="searchList" placeholder="Search food or restaurants" value="${esc(S.q)}" style="border:0;outline:0;flex:1;min-width:0;font-size:16px;background:transparent"></label></div>` : `<h1 style="font-size:34px;color:var(--ink)">Search</h1><label class="row" style="height:52px;padding:0 14px;border-radius:12px;background:var(--card);border:1.5px solid var(--g);max-width:640px">${ic.search}<input id="sq" data-m="q" data-live="searchList" placeholder="Try biryani, ramen or pizza" value="${esc(S.q)}" style="border:0;outline:0;flex:1;font-size:16px;background:transparent"></label>`}
      <div class="col" style="padding:${PHONE ? '12px 16px' : '0'};gap:12px">
        <div class="chips">${[['delivers', 'Delivers to me'], ['halal', 'Halal'], ['fast', 'Under 30 min'], ['free', 'Free or cheap delivery']].map(([k, l]) => `<button class="chip ${S.f[k] ? 'on' : ''}" data-a="filter" data-k="${k}">${l}</button>`).join('')}</div>
        ${nearBar()}
        <div class="mut sm-t">Try: ${['biryani', 'ramen', 'burger', 'salad'].map((w) => `<button class="btn gh" data-a="setQ" data-v="${w}" style="min-height:0;padding:0 4px;font-size:13px">${w}</button>`).join('')}</div>
        <div id="searchList" class="${PHONE ? 'col' : ''}" style="${PHONE ? '' : 'display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px'}">${list.map((r) => restCard(r, true)).join('') || `<div class="empty">No results for “${esc(S.q)}”. Try another spelling or remove filters.</div>`}</div>
      </div>`;
  };

  V.restaurant = () => {
    const r = rest(S.rid);
    const sec = r.menu[S.tab] || r.menu[0];
    const q = S.cart.rid === r.id ? curQuote() : null;
    const items = sec.items.map((it) => {
      const inCart = S.cart.rid === r.id ? S.cart.lines.filter((l) => l.itemId === it.id).reduce((a, l) => a + l.qty, 0) : 0;
      const idx = sec.items.indexOf(it);
      const btn = r.closed ? `<span class="mi-state">Closed now</span>` : it.soldOut ? `<span class="mi-state">${esc(it.soldOut)}</span>` : `<button class="mi-add ${inCart ? 'in' : ''}" data-a="openItem" data-id="${it.id}" aria-label="${inCart ? `In cart · ${inCart}. Add more ${esc(it.name)}` : `Add ${esc(it.name)}`}">${inCart ? `${inCart} in cart` : 'Add'}</button>`;
      return `<div class="mi ${it.soldOut || r.closed ? 'off' : ''}"><div class="col grow" style="gap:5px;min-width:0">${S.tab === 0 && idx < 2 && !it.soldOut ? '<span class="mi-pop">Most ordered</span>' : ''}<b class="mi-name">${esc(it.name)}</b><span class="mut sm-t mi-desc">${esc(it.desc)}</span><b class="mi-price">${money(it.price)}</b></div><div class="mi-media">${it.img ? `<img src="${IMG(it.img)}" alt="">` : '<span class="mi-noimg" aria-hidden="true"></span>'}${btn}</div></div>`;
    }).join('');
    const hero = `<div class="rx-hero" style="position:relative;${PHONE ? 'height:260px' : 'height:320px;border-radius:28px;overflow:hidden'};background:var(--g);color:#fff">
      <img src="${IMG(r.img)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(24,18,12,.6),rgba(24,18,12,.15) 40%,rgba(24,18,12,.9))"></div>
      ${PHONE ? `<button data-a="back" aria-label="Back" style="position:absolute;left:10px;top:10px;width:44px;height:44px;border:0;background:transparent;color:#fff;display:flex;align-items:center;justify-content:center">${ic.back}</button>` : ''}
      <div style="position:absolute;left:${PHONE ? 18 : 32}px;right:18px;bottom:${PHONE ? 42 : 66}px"><span class="rx-tag">${esc(r.cuisine)}${r.tags.includes('halal') ? ' · Halal' : ''}</span><h1 style="font-size:${PHONE ? 30 : 48}px;letter-spacing:-.03em;margin-top:6px">${esc(r.name)}</h1><div style="font-weight:800;font-size:16px;color:#FFD2B5">${esc(r.area)} location</div><div style="font-size:14px">${esc(r.addr)}, ${esc(r.area)} · ${r.closed ? 'Closed now' : 'Open now'}</div></div></div>`;
    const banner = `<div class="note n-g row" style="gap:10px"><b class="grow">${r.rule.type === 'customer' ? `Delivery fee about ${money(estFee(r))}` : r.rule.type === 'split' ? `${esc(r.name)} pays $3 of your delivery fee (about ${money(estFee(r))})` : r.rule.type === 'free' ? 'Free delivery, paid by the restaurant' : 'Free delivery on orders over $30'}</b></div>`;
    const alt = R.filter((x) => x.brand === r.brand && x.id !== r.id).sort((a, b) => dist(a) - dist(b))[0];
    const out = r.closed ? `<div class="note n-r">${whyNo(r)} You can look at the menu, but ordering is off until then.</div>` : S.fulfil === 'delivery' && !delivers(r) ? `<div class="note n-w col" style="gap:8px"><span>${whyNo(r)}</span><div class="row wrap"><button class="btn sm" data-a="fulfil" data-v="pickup">Switch to pickup</button>${alt && delivers(alt) ? `<button class="btn ln sm" data-a="openRest" data-id="${alt.id}">Try ${esc(alt.brand)} · ${esc(alt.area)} (delivers to you)</button>` : ''}<button class="btn gh" data-a="go" data-to="addresses">Change address</button></div></div>` : `<div class="note n-g sm-t">${S.fulfil === 'pickup' ? `Pickup at ${esc(r.addr)}, ${esc(r.area)}` : `Delivers to ${esc(addr().label)}`}${alt ? ` · Also at <button class="btn gh" data-a="openRest" data-id="${alt.id}" style="min-height:0;padding:0 2px;font-size:13px">${esc(alt.area)}</button>` : ''}</div>`;
    const minR = S.fulfil === 'delivery' && delivers(r) ? minOrderFor(r) : 0; const inCartFood = S.cart.rid === r.id ? S.cart.lines.reduce((a2, l) => a2 + l.unit * l.qty, 0) : 0;
    const minNote = minR ? `<div class="note n-w sm-t">Delivery to ${esc(addr().label)} has a <b>${money(minR)} minimum</b>${inCartFood ? ` · your cart: ${money(inCartFood)}${inCartFood >= minR ? ' ✓' : `, add ${money(minR - inCartFood)} more`}` : ''}.</div>` : '';
    const fbar = r.closed ? '' : fulfilButtons(r);
    const deal = { free: 'Free', freeOver: 'Free $30+', split: '$3 off', customer: `~${money(estFee(r))}` }[r.rule.type];
    const strip = `<div class="rx-strip"><div><b>★ ${r.rating}</b><span>${esc(r.reviews)} ratings</span></div><div><b>${S.fulfil === 'pickup' ? '15' : r.eta}</b><span>min ${S.fulfil === 'pickup' ? 'to ready' : 'delivery'}</span></div>${S.fulfil === 'delivery' && delivers(r) ? `<div><b>${esc(deal)}</b><span>${r.rule.type === 'split' ? `delivery · ~${money(estFee(r))}` : r.rule.type === 'customer' ? 'delivery fee' : 'delivery'}</span></div>` : `<div><b>$0</b><span>pickup fee</span></div>`}${minR ? `<div><b>${money(minR)}</b><span>minimum</span></div>` : ''}</div>`;
    const minBar = minR && inCartFood ? `<div class="rx-min"><div class="row between sm-t"><span>${inCartFood >= minR ? '<b style="color:var(--gx)">Minimum reached ✓</b>' : `Add <b>${money(minR - inCartFood)}</b> more for delivery`}</span><span class="mut">${money(inCartFood)} / ${money(minR)}</span></div><i><em style="width:${Math.min(100, Math.round((inCartFood / minR) * 100))}%"></em></i></div>` : '';
    const tabs = `<div class="chips" role="tablist">${r.menu.map((s, i) => `<button class="chip ${i === S.tab ? 'on' : ''}" role="tab" aria-selected="${i === S.tab}" data-a="tabMenu" data-i="${i}">${esc(s.s)}</button>`).join('')}</div>`;
    const cartPanel = q ? `<div class="card pad col" style="gap:6px"><b style="font-size:18px">Your order</b>${S.cart.lines.map((l, i) => `<div class="row" style="gap:8px"><div class="grow"><b class="sm-t" style="font-size:14px">${esc(l.name)}</b>${l.desc ? `<div class="mut sm-t">${esc(l.desc)}</div>` : ''}</div><span class="qty"><button data-a="qty" data-i="${i}" data-d="-1" aria-label="Remove one">−</button><b>${l.qty}</b><button data-a="qty" data-i="${i}" data-d="1" aria-label="Add one">+</button></span><b style="width:64px;text-align:right">${money(l.unit * l.qty)}</b></div>`).join('')}<div style="height:1px;background:var(--line);margin:4px 0"></div>${receiptRows({ ...q, tip: 0, total: q.food + q.fee - q.share }, r, S.fulfil).replace(/<div class="rw"><span class="mut">Tax[\s\S]*$/, '')}<span class="mut sm-t">Tax and tip are added at checkout.</span><button class="btn" data-a="go" data-to="cart">Go to cart · ${money(q.food + q.fee - q.share)}</button></div>` : `<div class="card pad col"><b style="font-size:18px">Your order</b><span class="mut">Your cart is empty. Tap Add on any dish.</span></div>`;
    if (PHONE) return `${hero}<div class="col" style="padding:0 16px ${q ? 12 : 24}px;gap:12px;margin-top:-26px;position:relative">${strip}${fbar}${out}${minBar}${tabs}<div class="col" style="gap:12px">${items}</div></div>
      ${q ? `<div class="vcart-wrap"><button class="btn vcart" data-a="go" data-to="cart"><span class="vcart-n">${cartCount()}</span><span class="grow" style="text-align:left">View cart</span><span>${money(q.food)}</span></button></div>` : ''}`;
    return `${webBack('Back')}${hero}<div class="col" style="gap:14px;margin-top:-44px;position:relative;padding:0 24px">${strip}</div><div class="row wrap" style="gap:12px;align-items:stretch"><div style="flex:1 1 420px">${fbar}</div></div>${out}${minBar}<div style="display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start"><div class="col" style="flex:999 1 520px;min-width:0;gap:14px">${tabs}<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px">${items}</div></div><div style="flex:1 1 320px;max-width:400px;position:sticky;top:16px">${cartPanel}</div></div>`;
  };

  V.cart = () => {
    if (!S.cart.lines.length) return `${topbar('Your cart')}<div class="col" style="padding:${PHONE ? '20px' : 0};gap:14px">${PHONE ? '' : '<h1 style="font-size:34px;color:var(--ink)">Your cart</h1>'}<div class="card empty col" style="align-items:center"><b style="color:var(--ink);font-size:18px">Your cart is empty</b><span>Find something tasty nearby.</span><button class="btn" data-a="tab" data-to="home">Browse restaurants</button></div></div>`;
    const r = rest(S.cart.rid); const q = curQuote();
    return `${topbar('Your cart')}<div class="col" style="padding:${PHONE ? '14px 16px 24px' : 0};gap:14px">
      ${PHONE ? '' : '<h1 style="font-size:34px;color:var(--ink)">Your cart</h1>'}
      <div style="display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start">
      <div class="card pad col" style="flex:999 1 420px;min-width:0">
        <div class="row between"><span>From <b>${esc(r.name)}</b></span><button class="btn gh" data-a="clearCart" style="min-height:0">Clear cart</button></div>
        ${S.cart.lines.map((l, i) => `<div class="row" style="padding:10px 0;border-top:1px solid var(--line);align-items:flex-start">${l.img ? `<img src="${IMG(l.img)}" alt="" style="width:64px;height:64px;border-radius:10px;object-fit:cover">` : ''}<div class="grow" style="min-width:0"><b>${esc(l.name)}</b><div class="mut sm-t">${esc(l.desc || 'Regular')}</div><div class="row" style="gap:12px;margin-top:2px"><b class="sm-t">${money(l.unit * l.qty)}</b>${findItem(r, l.itemId) && (findItem(r, l.itemId).opts || l.note !== undefined) ? `<button class="btn gh" data-a="editLine" data-i="${i}" style="min-height:0;padding:0;font-size:13px">Edit</button>` : ''}</div></div><span class="qty"><button data-a="qty" data-i="${i}" data-d="-1" aria-label="${l.qty === 1 ? 'Remove' : 'Remove one'}">${l.qty === 1 ? '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '−'}</button><b>${l.qty}</b><button data-a="qty" data-i="${i}" data-d="1" aria-label="Add one">+</button></span></div>`).join('')}
        <button class="btn ln sm" data-a="openRest" data-id="${r.id}" style="align-self:flex-start">+ Add more items</button>
        ${completeMeal(r)}
        <label class="row" style="padding:10px 0 2px;border-top:1px solid var(--line)"><span class="grow"><b>Utensils, napkins and straws</b><span class="mut sm-t" style="display:block">Only ask if you need them; it helps reduce waste</span></span><span class="switch"><input type="checkbox" role="switch" data-a="utensils" ${S.utensils ? 'checked' : ''} aria-label="Utensils, napkins and straws"></span></label>
        ${fulfilButtons(r)}
      </div>
      <div class="card pad col" style="flex:1 1 300px;gap:4px"><b style="font-size:18px">Summary</b>${receiptRows({ ...q, tip: 0, total: q.total - q.tip }, r, S.fulfil).replace('<span>Total</span>', '<span>Before tip</span>')}<p class="mut sm-t" style="margin:6px 0">No service or card fees. ${S.fulfil === 'delivery' ? 'You can tip your courier at checkout.' : ''}</p><button class="btn" data-a="checkout">Continue to checkout</button></div>
      </div></div>`;
  };

  const addr = () => S.addresses.find((a) => a.id === S.addrId) || S.addresses[0];
  const dist = (r) => distMi(addr(), r);
  const inArea = (r) => dist(r) <= r.radius;
  const delivers = (r) => inArea(r) && !r.paused && !r.closed;
  const minOrderFor = (r) => { const d = dist(r); const ring = r.rings.find((x) => d <= x[0]); return ring ? ring[1] : 0; };
  const farther = (r) => dist(r) > 2;
  const whyNo = (r) => r.closed ? `<b>${esc(r.name)} is closed now.</b> ${esc(r.closed)}.` : r.paused ? `<b>Delivery from ${esc(r.name)} is paused right now</b> because the kitchen is busy. Pickup is still open.` : `<b>Delivery isn’t available to ${esc(addr().label)} from ${esc(r.name)} · ${esc(r.area)}.</b> You can order for pickup.`;
  const miles = (r) => dist(r).toFixed(1) + ' mi';
  const deliveryLine = (r) => {
    if (r.closed) return `<span class="sm-t" style="color:var(--mut);font-weight:700">Closed · ${esc(r.closed)}</span>`;
    if (S.fulfil === 'pickup') return `<span class="sm-t" style="color:var(--gx);font-weight:700">Pickup · ready in about 15 min</span>`;
    if (r.paused && inArea(r)) return `<span class="sm-t" style="color:var(--warnx);font-weight:700">Delivery paused right now · pickup open</span>`;
    if (!inArea(r)) return `<span class="sm-t" style="color:var(--warnx);font-weight:700">Pickup only for your address</span>`;
    const min = minOrderFor(r);
    return `<span class="sm-t" style="color:var(--gx);font-weight:700">Delivers to you · ${esc(ruleText(r))}${min ? ` · ${money(min)} minimum` : ''}</span>`;
  };

  // Delivery / Pickup choice for one restaurant. Delivery is switched off when this location can't deliver to the address.
  function fulfilButtons(r) {
    const can = delivers(r);
    const why = r.paused ? 'Delivery paused right now' : 'Delivery not available to your address';
    return `<div class="cx-seg" role="group" aria-label="Delivery or pickup"><button class="opt ${S.fulfil === 'delivery' && can ? 'on' : ''}" data-a="fulfil" data-v="delivery" ${can ? '' : 'disabled aria-disabled="true"'} style="justify-content:center;${can ? '' : 'opacity:.5;cursor:not-allowed;background:#F3EDE3'}">${can ? `<span class="cx-seg-t">Delivery</span><span class="cx-seg-s">${r.eta} min</span>` : `<span class="cx-seg-t">Delivery</span><span class="cx-seg-s">${why.replace('Delivery ', '')}</span>`}</button><button class="opt ${S.fulfil === 'pickup' || !can ? 'on' : ''}" data-a="fulfil" data-v="pickup" style="justify-content:center"><span class="cx-seg-t">Pickup</span><span class="cx-seg-s">about 15 min</span></button></div>`;
  }
  function nearBar() {
    const a = addr();
    return `<div class="card pad row wrap" style="gap:8px"><span class="grow sm-t"><b>${S.fulfil === 'pickup' ? 'Pickup near' : 'Delivering to'} ${esc(a.label)}</b> · ${esc(a.line)}, ${esc(a.city)}</span><button class="btn ln sm" data-a="go" data-to="addresses">Change address</button></div>`;
  }

  V.checkout = () => {
    if (!S.cart.lines.length) return V.cart();
    const r = rest(S.cart.rid); const q = curQuote(); const food = q.food; const noDel = S.fulfil === 'delivery' && !delivers(r); const minShort = S.fulfil === 'delivery' && delivers(r) ? Math.max(0, minOrderFor(r) - food) : 0;
    const tipBtn = (p) => `<button class="opt ${S.tipPct === p ? 'on' : ''}" data-a="tip" data-v="${p}" style="flex-direction:column;justify-content:center;gap:0;padding:6px 4px"><b>${p}%</b><span class="mut sm-t">${money(Math.round((food * p) / 100))}</span></button>`;
    return `${topbar('Checkout')}<div class="col" style="padding:${PHONE ? '14px 16px 24px' : 0};gap:14px">
      ${PHONE ? '' : `${webBack('Back to cart')}<h1 style="font-size:34px;color:var(--ink)">Checkout</h1>`}
      <div style="display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start">
      <div class="col" style="flex:999 1 420px;min-width:0;gap:14px">
        <div class="card pad col"><div class="row between"><b style="font-size:17px">${S.fulfil === 'delivery' ? 'Deliver to' : 'Pick up from'}</b><div class="row" style="gap:6px"><button class="chip ${S.fulfil === 'delivery' ? 'on' : ''}" data-a="fulfil" data-v="delivery" ${S.cart.rid && !delivers(rest(S.cart.rid)) ? 'disabled style="opacity:.45;cursor:not-allowed"' : ''}>Delivery</button><button class="chip ${S.fulfil === 'pickup' ? 'on' : ''}" data-a="fulfil" data-v="pickup">Pickup</button></div></div>
          ${S.fulfil === 'delivery' ? `${S.addresses.map((a) => `<label class="opt ${S.addrId === a.id ? 'on' : ''}"><input type="radio" name="ad" data-a="pickAddr" data-id="${a.id}" ${S.addrId === a.id ? 'checked' : ''}><span class="grow"><b>${esc(a.label)}</b> · ${esc(a.line)}<span class="mut sm-t" style="display:block">${esc(a.city)}</span></span></label>`).join('')}<button class="btn gh" data-a="newAddr" style="align-self:flex-start;padding:0">+ Add a new address</button>
          <div class="col" style="gap:8px"><b>Drop-off</b>${dropChoices(S.dropoff, 'dropoff')}</div>
          <label class="f">Note for your courier<input class="in" id="cn" data-m="courierNote" value="${esc(S.courierNote)}" placeholder="Buzzer, gate code, floor"></label>` : `<div><b>${esc(r.name)}</b><div class="mut">${esc(r.addr)}, ${esc(r.area)} · ready in about 15 min</div></div>`}
        </div>
        ${S.fulfil === 'delivery' ? `<div class="card pad col"><div class="row between"><b style="font-size:17px">Tip your courier</b><span class="pill p-g">100% goes to them</span></div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${tipBtn(15)}${tipBtn(18)}${tipBtn(20)}<button class="opt ${S.tipPct === 'custom' ? 'on' : ''}" data-a="tip" data-v="custom" style="justify-content:center">Other</button></div>${S.tipPct === 'custom' ? `<label class="f">Tip amount in dollars<input class="in" id="tc" data-m="tipCustom" data-live="sum" inputmode="decimal" placeholder="5.00" value="${esc(S.tipCustom)}"></label>` : ''}</div>` : ''}
        <div class="card pad col"><div class="row between"><b style="font-size:17px">Payment</b><button class="btn gh" data-a="go" data-to="payments" style="min-height:0;padding:0;font-size:14px">Manage</button></div>${[...S.cards.map((c) => [c.id, `${cardPill(c)}<span class="grow">${esc(c.brand)} •••• ${c.last4}<span class="mut sm-t" style="display:block">Expires ${c.exp}</span></span>`]), ['apple', '<span class="pm-brand" style="background:#0E1E33"> Pay</span><span class="grow">Apple Pay</span>'], ['google', '<span class="pm-brand" style="background:#5B6B80">G Pay</span><span class="grow">Google Pay</span>']].map(([k, l]) => `<label class="opt ${S.pay === k ? 'on' : ''}"><input type="radio" name="pm" data-a="pay" data-v="${k}" ${S.pay === k ? 'checked' : ''}>${l}</label>`).join('')}<button class="btn gh" data-a="addCard" style="align-self:flex-start;padding:0">+ Add a card</button>
          ${S.signedIn && S.wallet.balance ? `<label class="opt ${S.wallet.useCredit ? 'on' : ''}" style="align-items:center"><span class="grow"><b>Use Send Koro credit</b><span class="mut sm-t" style="display:block">${money(S.wallet.balance)} available${q.credit ? ` · ${money(q.credit)} on this order` : ''}</span></span><span class="switch"><input type="checkbox" role="switch" data-a="toggleCredit" ${S.wallet.useCredit ? 'checked' : ''} aria-label="Use Send Koro credit"></span></label>` : ''}<span class="mut sm-t">Secure payment by Stripe. Your money goes straight to ${esc(r.name)}. <b>Prototype: no card is charged.</b></span></div>
      </div>
      <div class="card pad col" style="flex:1 1 300px;gap:4px" id="sum"><div class="row"><img src="${IMG(r.img)}" alt="" style="width:52px;height:52px;border-radius:10px;object-fit:cover"><div><b>${esc(r.name)}</b><div class="mut sm-t">${cartCount()} items · ${S.fulfil === 'delivery' ? r.eta + ' min' : 'pickup'}</div></div></div><div style="height:8px"></div>${receiptRows(q, r, S.fulfil)}
        ${r.closed ? `<div class="note n-r sm-t" style="margin-top:8px">${whyNo(r)}</div>` : minShort ? `<div class="note n-w sm-t" style="margin-top:8px">Delivery to this address has a <b>${money(minOrderFor(r))} minimum</b> . Add ${money(minShort)} more, or switch to pickup.</div><button class="btn" data-a="openRest" data-id="${r.id}">Add more items</button><button class="btn ln" data-a="fulfil" data-v="pickup" style="min-height:48px">Switch to pickup</button>` : noDel ? `<div class="note n-w sm-t" style="margin-top:8px">${whyNo(r)}</div><button class="btn" data-a="fulfil" data-v="pickup">Switch to pickup</button>` : `<button class="btn" data-a="placeOrder" style="margin-top:8px">Place order · ${money(q.total)}</button>`}<span class="mut sm-t" style="text-align:center">We hold ${money(q.total)} now. You’re charged only when ${esc(r.name)} accepts. No answer in 5 minutes means the hold is released.</span></div>
      </div></div>`;
  };

  V.confirm = () => {
    const o = S.orders.find((x) => x.id === S.activeId); if (!o) return V.home();
    const r = rest(o.rid);
    const declined = o.status === 'declined';
    return `${topbar('Order placed')}<div class="col" style="padding:${PHONE ? '18px 16px' : 0};gap:16px;${PHONE ? '' : 'max-width:760px;margin:0 auto;width:100%'}">
      <div class="row" style="align-items:flex-start;gap:16px"><span class="cx-ok ${declined ? 'bad' : ''}" aria-hidden="true">${declined ? '!' : '✓'}</span><div><h1 style="font-size:28px;color:var(--ink)">${declined ? 'The restaurant declined' : o.status === 'waiting' ? 'Order sent to the kitchen' : 'Order accepted'}</h1><p class="mut" style="margin:4px 0 0">${declined ? `Reason: ${esc(o.declineReason)}. The hold on your card was released. You paid nothing.` : o.status === 'waiting' ? `${esc(r.name)} has 5 minutes to accept. Your card is only charged once they do.` : `Your card was charged ${money(o.q.total)}.`}</p></div></div>
      <div class="cx-ticket row wrap"><div class="grow"><div class="cx-eyebrow">Order number</div><b>${o.id}</b></div><div><div class="cx-eyebrow">${o.fulfil === 'delivery' ? 'Estimated delivery' : 'Ready for pickup'}</div><b style="font-size:24px;color:var(--ink)">${o.fulfil === 'delivery' ? r.eta + ' min' : '15 min'}</b></div></div>
      ${o.fulfil === 'delivery' && !declined ? (o.dropoff === 'hand' ? `<div class="card pad row wrap" style="gap:12px;background:var(--ot);border-color:#F6C9A6"><div class="grow"><b>Hand it to me</b><div class="sm-t">Give your courier this PIN at the door. It’s also on the tracking page.</div></div><b style="font-size:30px;letter-spacing:.3em;color:var(--ink)">${o.pin}</b></div>` : `<div class="card pad col" style="gap:2px"><b>Leave at my door</b><span class="mut sm-t">Your courier will send a photo when it’s there. You can change this until pickup.</span></div>`) : ''}
      ${declined ? '<button class="btn" data-a="tab" data-to="home">Order from somewhere else</button>' : `<div class="row wrap"><button class="btn grow" data-a="track" data-id="${o.id}">Track order</button><button class="btn ln grow" data-a="receipt" data-id="${o.id}" style="min-height:52px">View receipt</button></div>`}
      ${o.status === 'waiting' ? `<div class="card pad col"><b>Test the restaurant’s answer</b><span class="mut sm-t">In the real app the restaurant taps Accept or Decline. Here it auto-accepts in a few seconds, or you can decide now.</span><div class="row wrap"><button class="btn sm" data-a="simAccept" data-id="${o.id}" style="background:var(--g)">Restaurant accepts now</button><button class="btn ln sm" data-a="simDecline" data-id="${o.id}">Restaurant declines</button></div></div>` : ''}
    </div>`;
  };

  function dropChoices(cur, act, id) {
    return [['door', 'Leave at my door', 'Your courier sends a photo when it’s there'], ['hand', 'Hand it to me', 'Give your courier a 4-digit PIN from this app']].map(([k, l, d2]) => `<label class="opt ${cur === k ? 'on' : ''}"><input type="radio" name="drop${id || ''}" data-a="${act}" data-v="${k}" ${id ? `data-id="${id}"` : ''} ${cur === k ? 'checked' : ''}><span class="grow"><b>${l}</b><span class="mut sm-t" style="display:block">${d2}</span></span></label>`).join('');
  }
  const doorPhoto = `<svg viewBox="0 0 320 180" width="100%" role="img" aria-label="Courier’s photo of your order at the door" style="display:block;border-radius:12px;background:#D9CFC0"><rect x="100" y="10" width="120" height="170" fill="#7A4A2A"/><rect x="112" y="22" width="96" height="70" fill="#8F5A35"/><circle cx="198" cy="105" r="5" fill="#E8C66A"/><rect x="140" y="40" width="40" height="18" rx="3" fill="#F7F1E6"/><text x="160" y="54" font-size="13" text-anchor="middle" font-family="Inter,sans-serif" font-weight="700" fill="#17201B">2B</text><rect x="60" y="150" width="200" height="30" fill="#4E5B52"/><path d="M128 120h64l-6 48h-52z" fill="#F2600C"/><path d="M146 120v-8a14 14 0 0 1 28 0v8" fill="none" stroke="#F2600C" stroke-width="5"/></svg>`;
  function dropCard(o, idx, done) {
    if (o.fulfil !== 'delivery' || o.status === 'declined') return '';
    const pickedUp = idx >= 3;
    if (done) return o.dropoff === 'hand' ? `<div class="card pad col"><b>Handed to you</b><span class="mut sm-t">Your courier confirmed your PIN at ${o.timeline.find((x) => x[0] === 'delivered')?.[1] || 'drop-off'}.</span></div>` : `<div class="card pad col"><b>Left at your door</b>${doorPhoto}<span class="mut sm-t">Photo from your courier${o.timeline.find((x) => x[0] === 'delivered') ? ' at ' + o.timeline.find((x) => x[0] === 'delivered')[1] : ''}.</span></div>`;
    const pinBox = o.dropoff === 'hand' ? `<div class="card pad col" style="background:var(--ot);border-color:#F6C9A6;gap:6px"><span class="mut sm-t">Your delivery PIN</span><b style="font-size:34px;letter-spacing:.35em;color:var(--ink)">${o.pin}</b><span class="sm-t">Tell your courier this PIN when they hand you the order. Don’t share it before they arrive.</span></div>` : `<div class="card pad col" style="gap:4px"><b>Leaving it at your door</b><span class="mut sm-t">Your courier will send a photo when it’s there.</span></div>`;
    const change = pickedUp ? '' : `<details class="sm-t"><summary><b>Change drop-off</b></summary><div class="col" style="gap:8px;margin-top:8px">${dropChoices(o.dropoff, 'setDrop', o.id)}</div></details>`;
    return pinBox + change;
  }
  V.track = () => {
    const o = S.orders.find((x) => x.id === S.activeId); if (!o) return V.orders();
    const r = rest(o.rid); const steps = stepsFor(o);
    const idx = o.status === 'declined' ? -1 : steps.findIndex((s) => s[0] === o.status);
    const pct = Math.max(0, idx) / (steps.length - 1);
    const done = o.status === 'delivered' || o.status === 'collected';
    const cx = 70 + pct * 260, cy = 210 - pct * 170;
    const map = o.fulfil === 'delivery' ? `<div style="position:relative;${PHONE ? '' : 'flex:999 1 420px;min-width:0;'}"><svg viewBox="0 0 400 250" width="100%" role="img" aria-label="Map showing your courier's progress" style="display:block;background:#0B231C;${PHONE ? '' : 'border-radius:16px'}"><rect x="0" y="150" width="110" height="100" fill="#12352B"/><g stroke="#1F4537" stroke-width="8"><path d="M0 60h400M0 140h400M0 220h400M70 0v250M190 0v250M300 0v250"/></g><path d="M70 210 L190 210 L190 140 L300 140 L300 60 L330 40" fill="none" stroke="#F6C428" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="70" cy="210" r="11" fill="#F3EEDF"/><circle cx="330" cy="40" r="11" fill="#F3EEDF"/>${idx >= 3 && !done ? `<circle cx="${cx}" cy="${cy}" r="13" fill="#F6C428" stroke="#fff" stroke-width="3"/>` : ''}</svg></div>` : '';
    const title = o.status === 'declined' ? 'Declined, not charged' : done ? (o.fulfil === 'delivery' ? 'Delivered' : 'Picked up') : steps[idx][1];
    return `${topbar('Live tracking')}${PHONE ? map : ''}<div class="col" style="padding:${PHONE ? '14px 16px 24px' : 0};gap:14px">
      ${PHONE ? '' : `<h1 style="font-size:32px;color:var(--ink)">Track order ${o.id}</h1>`}
      <div style="display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start">
      ${PHONE ? '' : map}
      <div class="col" style="flex:1 1 320px;gap:12px">
        <div><b style="font-size:24px;color:var(--ink)">${esc(title)}</b><div class="mut sm-t">${o.id} · ${esc(r.name)} · ${o.fulfil === 'delivery' ? esc(o.addr) : 'Pickup at ' + esc(r.addr)}</div></div>
        ${o.fulfil === 'delivery' && idx >= 3 && !done ? `<div class="card pad row"><span style="width:46px;height:46px;border-radius:99px;background:var(--ot);color:var(--warnx);display:flex;align-items:center;justify-content:center;font-weight:800">A</span><div class="grow"><b>Alex</b><div class="mut sm-t">Your courier</div></div><button class="btn ln sm" data-a="toastMsg" data-msg="Calling your courier (prototype)">Call</button><button class="btn ln sm" data-a="toastMsg" data-msg="Message sent to your courier (prototype)">Message</button></div>` : ''}
        ${!done && o.status !== 'declined' ? `<div class="tx-eta"><div class="row between" style="align-items:flex-end"><div><span class="tx-k">${o.fulfil === 'delivery' ? 'Estimated arrival' : 'Ready for pickup in'}</span><b>${o.fulfil === 'delivery' ? `${Math.max(5, Math.round(r.etaMax * (1 - pct)))} min` : `${Math.max(2, Math.round(15 * (1 - pct)))} min`}</b></div><span class="tx-step">Step ${idx + 1} of ${steps.length}</span></div><div class="tx-bar">${steps.map((_, i) => `<i class="${i < idx ? 'd' : i === idx ? 'n' : ''}"></i>`).join('')}</div></div>` : ''}
        ${dropCard(o, idx, done)}
        <ol class="card pad col" style="list-style:none;margin:0;gap:12px">${(o.status === 'declined' ? [...steps.slice(0, 1), ['declined', 'Declined: ' + o.declineReason, 'Hold released, you paid nothing']] : steps).map((s, i) => { const t = o.timeline.find((x) => x[0] === s[0]); const state = o.status === 'declined' ? (i === 0 || s[0] === 'declined' ? 'done' : 'todo') : i < idx || (i === idx && done) ? 'done' : i === idx ? 'now' : 'todo'; return `<li class="row" style="align-items:flex-start"><span style="width:24px;height:24px;flex:none;border-radius:99px;display:flex;align-items:center;justify-content:center;${state === 'done' ? `background:${s[0] === 'declined' ? 'var(--red)' : '#B9862F'}` : state === 'now' ? 'border:3px solid var(--o)' : 'border:2px solid var(--line2)'}">${state === 'done' ? ic.check : ''}</span><span class="grow"><b style="${state === 'todo' ? 'color:var(--mut)' : ''}">${esc(s[1])}</b>${s[2] && state !== 'todo' ? `<span class="mut sm-t" style="display:block">${esc(s[2])}</span>` : ''}</span><span class="mut sm-t">${t ? t[1] : state === 'now' ? 'Now' : ''}</span></li>`; }).join('')}</ol>
        ${!done && o.status !== 'declined' ? `<div class="row wrap"><button class="btn ln sm" data-a="skip" data-id="${o.id}">Skip to next step</button>${o.status === 'waiting' ? `<button class="btn ln sm" data-a="simDecline" data-id="${o.id}">Restaurant declines</button>` : ''}</div>` : ''}
        <div class="card pad col" style="gap:2px"><b style="margin-bottom:6px">Receipt</b>${receiptRows(o.q, r, o.fulfil)}${o.status === 'waiting' ? '<span class="mut sm-t">Held on your card, not charged yet.</span>' : o.status === 'declined' ? '<span class="sm-t" style="color:var(--gx);font-weight:700">Hold released. You were not charged.</span>' : ''}</div>
        <button class="btn gh" data-a="helpFor" data-id="${o.id}" style="align-self:flex-start;padding:0">Problem with this order? Get help</button>
      </div></div></div>`;
  };

  V.orders = () => {
    const active = S.orders.filter((o) => !['delivered', 'collected', 'declined'].includes(o.status));
    const past = S.orders.filter((o) => ['delivered', 'collected', 'declined'].includes(o.status));
    const list = S.ordersTab === 'active' ? active : past;
    const pill = (o) => o.status === 'declined' ? '<span class="pill p-n">Declined · not charged</span>' : ['delivered', 'collected'].includes(o.status) ? '<span class="pill p-g">' + (o.status === 'delivered' ? 'Delivered' : 'Picked up') + '</span>' : `<span class="pill p-o">${esc(stepsFor(o).find((s) => s[0] === o.status)[1])}</span>`;
    return `${PHONE ? pageHero('Orders', { noBack: true }) : '<h1 style="font-size:34px;color:var(--ink)">My orders</h1>'}
      <div class="col" style="padding:${PHONE ? '14px 16px 24px' : 0};gap:12px">
        <div class="cx-seg" role="tablist" style="align-self:${PHONE ? 'stretch' : 'flex-start'};min-width:${PHONE ? 0 : 340}px">${[['active', 'Active', active.length], ['past', 'Past', past.length]].map(([k, l, n]) => `<button role="tab" class="opt ${S.ordersTab === k ? 'on' : ''}" aria-selected="${S.ordersTab === k}" data-a="ordersTab" data-v="${k}"><span class="cx-seg-t">${l} (${n})</span></button>`).join('')}</div>
        ${list.length ? list.map((o) => { const r = rest(o.rid); return `<div class="card pad col cx-order"><div class="row" style="gap:14px"><img src="${IMG(r.img)}" alt="" style="width:76px;height:76px;border-radius:18px;object-fit:cover;box-shadow:0 8px 18px -10px rgba(0,0,0,.4)"><div class="grow col" style="gap:3px;min-width:0"><b class="cx-serif" style="font-size:18px">${esc(r.name)}</b><div class="mut sm-t">${o.id} · ${esc(o.when)}</div>${pill(o)}</div><b>${o.status === 'declined' ? '$0.00' : money(o.q.total)}</b></div><div class="mut sm-t">${o.lines.map((l) => `${l.qty}× ${esc(l.name)}`).join(', ')}</div><div class="row wrap">${S.ordersTab === 'active' ? `<button class="btn sm" data-a="track" data-id="${o.id}">Track</button>` : `<button class="btn sm" data-a="reorder" data-id="${o.id}">Reorder</button>`}<button class="btn ln sm" data-a="receipt" data-id="${o.id}">Receipt</button><button class="btn ln sm" data-a="helpFor" data-id="${o.id}">Help</button></div></div>`; }).join('') : `<div class="card empty col" style="align-items:center"><b style="color:var(--ink)">${S.ordersTab === 'active' ? 'No active orders' : 'No past orders yet'}</b><button class="btn" data-a="tab" data-to="home">Browse restaurants</button></div>`}
      </div>`;
  };

  V.account = () => {
    if (!S.signedIn) return `${PHONE ? pageHero('Account', { noBack: true }) : ''}<div class="col" style="padding:${PHONE ? '20px 16px' : 0};gap:14px;${PHONE ? '' : 'max-width:520px'}"><div class="card pad col" style="align-items:flex-start"><b style="font-size:20px">You’re browsing as a guest</b><span class="mut">Sign in to save addresses, see your orders and check out.</span><button class="btn" data-a="go" data-to="signin">Sign in or sign up</button></div><button class="btn ln" data-a="go" data-to="help">Help center</button></div>`;
    const u = S.user; const init = esc(u.name.split(' ').map((w) => w[0]).join('').slice(0, 2));
    const dc = cardById(S.defaultCard);
    return `${PHONE ? pageHero('Account', { noBack: true }) : '<h1 style="font-size:34px;color:var(--ink)">Account overview</h1>'}
      <div class="col" style="padding:${PHONE ? '14px 16px 24px' : 0};gap:14px;${PHONE ? '' : 'max-width:760px'}">
        <div class="card pad row" style="align-items:center"><span class="acc-av">${init}</span><div class="grow" style="min-width:0"><b style="font-size:18px">${esc(u.name)}</b><div class="mut sm-t">${esc(u.phone)}</div><div class="sm-t">${u.email ? `${esc(u.email)} ${u.emailVerified ? '<span class="pill p-g">Verified</span>' : '<span class="pill p-o">Not verified</span>'}` : '<span class="mut">No email yet</span>'}</div></div><button class="btn ln sm" data-a="go" data-to="profile">Edit</button></div>
        ${u.email && !u.emailVerified ? `<div class="note n-w sm-t">Verify ${esc(u.email)} to get receipts by email. <button class="btn gh" data-a="go" data-to="profile" style="min-height:0;padding:0">Verify now</button></div>` : ''}
        <div class="card col" style="padding:4px 16px">
          ${accRow('wallet', '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16 15h2"/></svg>', 'Wallet', 'Promo credit for your orders', `<b class="acc-amt">${money(S.wallet.balance)}</b>`)}
          ${accRow('payments', '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h4"/></svg>', 'Payment methods', `${S.cards.length} card${S.cards.length === 1 ? '' : 's'}${dc ? ` · default ${esc(dc.brand)} •••• ${dc.last4}` : ''}`)}
          ${accRow('refer', '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8c-2-4-6-4-6-1s6 1 6 1zM12 8c2-4 6-4 6-1s-6 1-6 1z"/></svg>', 'Refer a friend', 'Give $5, get $5 in credit', '<span class="pill p-r">$5</span>')}
          ${accRow('profile', '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>', 'Profile', 'Name, mobile number, email')}
        </div>
        <div class="card pad col"><div class="row between"><b style="font-size:17px">Saved addresses</b><button class="btn ln sm" data-a="newAddr">+ Add</button></div>${S.addresses.map((a) => `<div class="acc-addr"><div style="min-width:0"><b>${esc(a.label)}</b>${S.defaultAddr === a.id ? ' <span class="pill p-g">Default</span>' : ''}<div class="mut sm-t">${esc(a.line)}, ${esc(a.city)}</div>${a.note ? `<div class="mut sm-t">Note: ${esc(a.note)}</div>` : ''}</div><div class="row" style="gap:14px">${S.defaultAddr === a.id ? '' : `<button class="btn gh" data-a="defAddr" data-id="${a.id}" style="min-height:32px;padding:0;font-size:13px">Make default</button>`}<button class="btn gh" data-a="delAddr" data-id="${a.id}" style="min-height:32px;padding:0;font-size:13px">Delete</button></div></div>`).join('')}</div>
        <div class="card pad col"><b style="font-size:17px">Notifications</b>${[['updates', 'Order updates', 'Accepted, on the way, delivered'], ['sms', 'Text messages', 'If push notifications are off'], ['offers', 'Restaurant offers', 'Free delivery and restaurant deals']].map(([k, l, d]) => `<label class="row" style="padding:8px 0;border-top:1px solid var(--line)"><span class="grow"><b>${l}</b><span class="mut sm-t" style="display:block">${d}</span></span><span class="switch"><input type="checkbox" role="switch" data-a="notif" data-k="${k}" ${S.notif[k] ? 'checked' : ''} aria-label="${l}"></span></label>`).join('')}</div>
        <div class="row wrap"><button class="btn ln" data-a="go" data-to="help">Help center</button><button class="btn ln" data-a="signOut" style="color:var(--red);border-color:var(--red)">Sign out</button></div>
      </div>${PHONE ? phoneFooter() : ''}`;
  };

  // Profile: name, mobile number (verified by text code), email (verified by emailed code).
  V.profile = () => {
    const f = S.profile || (S.profile = { name: S.user.name, email: S.user.email, emailCode: '', emailSent: false, phone: '', phoneCode: '', phoneSent: false });
    const emailChanged = f.email.trim() && f.email.trim().toLowerCase() !== (S.user.email || '').toLowerCase();
    return `${topbar('Profile')}<div class="col" style="padding:${PHONE ? '14px 16px 24px' : 0};gap:14px;${PHONE ? '' : 'max-width:560px'}">${PHONE ? '' : `${webBack('Back to account')}<h1 style="font-size:32px;color:var(--ink)">Profile</h1>`}
      <div class="card pad col"><label class="f">Full name<input class="in" id="pf-name" data-m="profile.name" value="${esc(f.name)}" autocomplete="name"></label><button class="btn sm" data-a="saveProfileName" style="align-self:flex-start">Save name</button></div>
      <div class="card pad col"><div class="row between"><b>Email</b>${S.user.email ? (S.user.emailVerified ? '<span class="pill p-g">Verified</span>' : '<span class="pill p-o">Not verified</span>') : ''}</div>
        <label class="f">Email address<input class="in" id="pf-email" type="email" inputmode="email" autocomplete="email" data-m="profile.email" data-live="1" value="${esc(f.email)}" placeholder="you@example.com"></label>
        ${f.emailSent ? `<span class="sm-t">We emailed a 6-digit code to <b>${esc(f.email)}</b>.</span><label class="f">Code from the email<input class="in" id="pf-ecode" inputmode="numeric" maxlength="6" data-m="profile.emailCode" value="${esc(f.emailCode)}" placeholder="123456" style="letter-spacing:.3em;font-weight:800"></label><div class="row wrap"><button class="btn sm" data-a="verifyEmail">Verify email</button><button class="btn gh" data-a="sendEmailCode" style="min-height:0;padding:0">Resend code</button></div>`
          : (emailChanged || (S.user.email && !S.user.emailVerified) ? `<button class="btn sm" data-a="sendEmailCode" style="align-self:flex-start">${emailChanged ? 'Save and send code' : 'Send verification code'}</button>` : '')}
        <span class="mut sm-t">We send receipts here. A new email is used only after you verify it.</span></div>
      <div class="card pad col"><b>Mobile number</b><div class="row between"><span>${esc(S.user.phone)}</span><span class="pill p-g">Verified · used to sign in</span></div>
        <label class="f">New mobile number<input class="in" id="pf-phone" type="tel" inputmode="tel" autocomplete="tel" data-m="profile.phone" value="${esc(f.phone)}" placeholder="(917) 555-0123"></label>
        ${f.phoneSent ? `<span class="sm-t">We texted a 6-digit code to <b>${esc(f.phone)}</b>.</span><label class="f">Code from the text<input class="in" id="pf-pcode" inputmode="numeric" maxlength="6" data-m="profile.phoneCode" value="${esc(f.phoneCode)}" placeholder="123456" style="letter-spacing:.3em;font-weight:800"></label><div class="row wrap"><button class="btn sm" data-a="verifyPhone">Confirm new number</button><button class="btn gh" data-a="sendPhoneCode" style="min-height:0;padding:0">Resend code</button></div>` : `<button class="btn ln sm" data-a="sendPhoneCode" style="align-self:flex-start">Change number</button>`}
        <span class="mut sm-t">Your old number keeps working until the new one is confirmed.</span></div>
    </div>`;
  };

  // Wallet: Send Koro promo credit. Funded by Send Koro, applied at checkout, no cash value.
  V.wallet = () => {
    const w = S.wallet;
    return `${topbar('Wallet')}<div class="col" style="padding:${PHONE ? '14px 16px 24px' : 0};gap:14px;${PHONE ? '' : 'max-width:620px'}">${PHONE ? '' : `${webBack('Back to account')}<h1 style="font-size:32px;color:var(--ink)">Wallet</h1>`}
      <div class="wal-hero"><span>Send Koro credit</span><b>${money(w.balance)}</b><div class="wal-meta"><small>Used at checkout, oldest first</small>${w.history.find((h) => h.note && h.cents > 0) ? `<span class="wal-exp">Next expiry ${esc(w.history.filter((h) => h.note && h.cents > 0).slice(-1)[0].note.replace('Expires ', ''))}</span>` : ''}</div></div>
      <label class="card pad row" style="align-items:center"><span class="grow"><b>Use credit at checkout</b><span class="mut sm-t" style="display:block">Turn off to save it for later</span></span><span class="switch"><input type="checkbox" role="switch" data-a="toggleCredit" ${w.useCredit ? 'checked' : ''} aria-label="Use credit at checkout"></span></label>
      <button class="card pad row refer-cta" data-a="go" data-to="refer"><span class="grow" style="text-align:left"><b>Give $5, get $5</b><span class="mut sm-t" style="display:block">Invite friends. They get $5 when they join; you get $5 after their first order.</span></span><span class="pill p-r">Invite</span></button>
      <div class="card pad col"><b>Add a promo code</b><div class="row" style="gap:8px"><input class="in grow" id="promo" data-m="promoQ" value="${esc(S.promoQ)}" placeholder="e.g. WELCOME10" style="text-transform:uppercase;min-width:0"><button class="btn sm" data-a="applyPromo">Apply</button></div><span class="mut sm-t">Try WELCOME10 or BROOKLYN5 (prototype).</span></div>
      <div class="card col" style="padding:4px 16px"><b style="padding:12px 0 6px">History</b>${w.history.map((h) => `<div class="row between" style="border-top:1px solid var(--line);padding:10px 0"><span><b>${esc(h.label)}</b><span class="mut sm-t" style="display:block">${esc(h.when)}${h.note ? ' · ' + esc(h.note) : ''}</span></span><b style="color:${h.cents > 0 ? '#0B3B6E' : '#C81E24'}">${h.cents > 0 ? '+' : '−'}${money(Math.abs(h.cents))}</b></div>`).join('')}</div>
      <span class="mut sm-t">Credit comes from Send Koro, not from the restaurant or your courier: restaurants still get their full food price and couriers keep 100% of tips. Promotional credit is for phone-verified accounts, is valid for 30 days, has no cash value and can’t be transferred or withdrawn. At least $0.50 of each order is paid by card.</span>
    </div>`;
  };

  const in30 = () => { const d = new Date(Date.now() + 30 * 864e5); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
  const REF_LINK = () => `sendkoro.com/r/${S.referral.code}`;
  // Refer a friend: link + code, share, invite status. Both people get $5 once the friend's phone is verified.
  V.refer = () => {
    const rf = S.referral; const joined = rf.invites.filter((i) => i.status === 'ordered').length;
    return `${topbar('Refer a friend')}<div class="col" style="padding:${PHONE ? '14px 16px 24px' : 0};gap:14px;${PHONE ? '' : 'max-width:640px'}">${PHONE ? '' : `${webBack('Back to account')}<h1 style="font-size:32px;color:var(--ink)">Refer a friend</h1>`}
      <div class="ref-hero"><span class="ref-gift" aria-hidden="true"><svg viewBox="0 0 48 48" width="44" height="44"><rect x="6" y="18" width="36" height="24" rx="4" fill="#FFFFFF"/><rect x="4" y="12" width="40" height="9" rx="3" fill="#FFFFFF"/><rect x="21" y="12" width="6" height="30" fill="#E3242B"/><path d="M24 12c-4-8-13-8-12-2 1 4 12 2 12 2zM24 12c4-8 13-8 12-2-1 4-12 2-12 2z" fill="#E3242B"/></svg></span><b>Give $5, get $5</b><span>Share your link. Your friend gets $5 when they sign up and verify their phone. You get $5 when they complete their first order.</span></div>
      <div class="card pad col"><span class="mut sm-t">Your code</span><div class="row between"><b class="ref-code">${esc(rf.code)}</b><button class="btn ln sm" data-a="copyRef" data-v="${esc(rf.code)}">Copy code</button></div>
        <span class="mut sm-t" style="margin-top:6px">Your link</span><div class="row between" style="gap:8px"><span class="ref-link">${esc(REF_LINK())}</span><button class="btn ln sm" data-a="copyRef" data-v="https://${esc(REF_LINK())}">Copy link</button></div>
        <div class="ref-share">${[['Text', 'sms'], ['WhatsApp', 'wa'], ['Email', 'mail'], ['More', 'more']].map(([l, k]) => `<button class="btn sm" data-a="shareRef" data-k="${k}">${l}</button>`).join('')}</div>
        <button class="btn gh" data-a="previewRef" style="align-self:flex-start;padding:0;font-size:14px">See what your friend sees</button></div>
      <div class="card pad col"><b>How it works</b>${[['Share', 'Send your link or code to a friend.'], ['They join', 'Your friend signs up, verifies their phone and gets $5.'], ['You get $5', 'When their first order is delivered or picked up, $5 lands in your wallet.']].map(([t, d], i) => `<div class="row" style="align-items:flex-start;gap:12px;padding:6px 0"><span class="ref-step">${i + 1}</span><span><b>${t}</b><span class="mut sm-t" style="display:block">${d}</span></span></div>`).join('')}</div>
      <div class="card col" style="padding:4px 16px"><div class="row between" style="padding:12px 0 6px"><b>Your invites</b><span class="mut sm-t">${joined} rewarded · ${money(joined * 500)} earned</span></div>${rf.invites.map((i) => `<div class="row between" style="border-top:1px solid var(--line);padding:10px 0"><span><b>${esc(i.name)}</b><span class="mut sm-t" style="display:block">${i.status === 'ordered' ? 'First order ' + esc(i.when) + ' · you got $5' : i.status === 'joined' ? 'Joined ' + esc(i.when) + ' · you get $5 after their first order' : 'Invited ' + esc(i.when) + ' · waiting for them to sign up'}</span></span><span class="pill ${i.status === 'ordered' ? 'p-g' : 'p-o'}">${i.status === 'ordered' ? '+$5' : i.status === 'joined' ? 'Joined' : 'Pending'}</span></div>`).join('')}</div>
      <span class="mut sm-t">Terms: for new customers with a verified US mobile number, one reward per person and phone number. The person who refers gets $5 after the friend’s first completed order. Credit is valid for 30 days, can only be used at checkout, has no cash value and can’t be transferred. Send Koro pays for this credit; restaurants still get their full food price. Send Koro may cancel credit gained by misuse.</span>
    </div>`;
  };

  // Payment methods: several cards, a default, edit expiry/ZIP, remove; Apple Pay and Google Pay at checkout.
  V.payments = () => `${topbar('Payment methods')}<div class="col" style="padding:${PHONE ? '14px 16px 24px' : 0};gap:14px;${PHONE ? '' : 'max-width:620px'}">${PHONE ? '' : `${webBack('Back to account')}<h1 style="font-size:32px;color:var(--ink)">Payment methods</h1>`}
    <div class="card col" style="padding:4px 16px">${S.cards.map((c) => `<div class="pm-row">${cardPill(c)}<span class="grow" style="min-width:0"><span class="pm-name"><b>${esc(c.brand)} •••• ${c.last4}</b>${S.defaultCard === c.id ? '<span class="pill p-g">Default</span>' : ''}</span><span class="mut sm-t pm-sub">Expires ${c.exp} · ZIP ${esc(c.zip)}</span></span><span class="pm-acts">${S.defaultCard === c.id ? '' : `<button class="btn gh" data-a="defCard" data-id="${c.id}" style="min-height:32px;padding:0;font-size:13px">Make default</button>`}<button class="btn gh" data-a="editCard" data-id="${c.id}" style="min-height:32px;padding:0;font-size:13px">Edit</button><button class="btn gh" data-a="delCard" data-id="${c.id}" style="min-height:32px;padding:0;font-size:13px">Remove</button></span></div>`).join('') || '<span class="mut" style="padding:14px 0">No saved cards yet.</span>'}</div>
    <button class="btn" data-a="addCard" style="width:100%">+ Add a card</button>
    <div class="card pad col"><b>Also at checkout</b><div class="row"><span class="pm-brand" style="background:#0E1E33"> Pay</span><span>Apple Pay on iPhone, iPad and Safari</span></div><div class="row"><span class="pm-brand" style="background:#5B6B80">G Pay</span><span>Google Pay on Android and Chrome</span></div></div>
    <span class="mut sm-t">Cards are saved securely by Stripe; Send Koro never sees your full card number. Your card is charged by the restaurant you order from, only when it accepts.</span>
  </div>`;

  V.addresses = () => `${topbar('Delivery address')}<div class="col" style="padding:${PHONE ? '14px 16px 24px' : 0};gap:12px">${PHONE ? '' : `${webBack('Back')}<h1 style="font-size:32px;color:var(--ink)">Choose a delivery address</h1>`}
    ${S.addresses.map((a) => `<label class="opt ${S.addrId === a.id ? 'on' : ''}"><input type="radio" name="ad2" data-a="pickAddr" data-id="${a.id}" data-back="1" ${S.addrId === a.id ? 'checked' : ''}><span class="grow"><b>${esc(a.label)}</b> · ${esc(a.line)}<span class="mut sm-t" style="display:block">${esc(a.city)}</span></span></label>`).join('')}
    <div class="card pad col"><b>Find a different address</b><label class="row" style="height:48px;padding:0 12px;border-radius:10px;border:1.5px solid var(--line2);background:var(--card)">${ic.search}<input id="aq" data-m="addrQ" data-live="1" placeholder="Start typing your address" autocomplete="off" value="${esc(S.addrQ)}" style="border:0;outline:0;flex:1;min-width:0;background:transparent;font-size:15px">${gpsBtn('addresses')}</label>
      ${S.addrQ.trim().length >= 2 ? addrSuggestList(S.addrQ, 'useAddr', (x) => { const near = R.filter((r) => distMi(x, r) <= r.radius).length; return ` · ${near ? `${near} restaurant location${near === 1 ? '' : 's'} deliver here` : 'outside delivery areas for now'}`; }) : '<span class="mut sm-t">Type a house number and street, e.g. “210 Franklin” or “37-12 74th”.</span>'}
      <button class="btn gh" data-a="gpsFill" data-target="addresses" style="align-self:flex-start;padding:0">${ic.gps} Use my current location</button></div>
    <button class="btn ln" data-a="newAddr" style="width:100%">+ Add a new address</button></div>`;

  V.addrForm = () => {
    const f = S.addrForm || { street: '', apt: '', note: '', label: 'Home', def: false };
    return `${topbar('New address')}<div class="col" style="padding:${PHONE ? '14px 16px 24px' : 0};gap:12px;${PHONE ? '' : 'max-width:560px'}">${PHONE ? '' : `${webBack('Back')}<h1 style="font-size:32px;color:var(--ink)">Where should we deliver?</h1>`}
      <label class="f">Street address<span class="in-gps"><input class="in" id="af-street" data-m="addrForm.street" data-live="1" autocomplete="off" placeholder="Start typing, e.g. 210 Franklin" value="${esc(f.street)}">${gpsBtn('addrForm')}</span></label>
      ${f.street && !f.picked ? addrSuggestList(f.street, 'useSugg') : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label class="f">Apt / floor<input class="in" id="af-apt" data-m="addrForm.apt" value="${esc(f.apt)}"></label><label class="f">Courier note<input class="in" id="af-note" data-m="addrForm.note" value="${esc(f.note)}" placeholder="Buzzer, gate code"></label></div>
      <div class="row">${['Home', 'Work', 'Other'].map((l) => `<button class="chip ${f.label === l ? 'on' : ''}" data-a="addrLabel" data-v="${l}">${l}</button>`).join('')}</div>
      <label class="row"><input type="checkbox" id="af-def" data-m="addrForm.def" ${f.def ? 'checked' : ''}>Make this my default address</label>
      <button class="btn" data-a="saveAddr">Save address</button></div>`;
  };

  V.help = () => {
    const h = S.help; const o = S.orders.find((x) => x.id === h.orderId) || S.orders[0];
    return `${topbar('Help')}<div class="col" style="padding:${PHONE ? '14px 16px 24px' : 0};gap:14px;${PHONE ? '' : 'max-width:760px'}">${PHONE ? '' : `${webBack('Back')}<h1 style="font-size:32px;color:var(--ink)">Help center</h1>`}
      ${h.sent.map((s) => `<div class="note n-w"><b>${esc(s.what)} · ${s.id}</b><br>Status: <b>In review</b>. Our team is checking with the restaurant. Approved refunds go back to your card.</div>`).join('')}
      <div class="card pad col"><b style="font-size:17px">Report a problem with an order</b>
        <label class="f">Order<select class="in" id="h-order" data-m="help.orderId" data-rerender="1">${S.orders.map((x) => `<option value="${x.id}" ${x.id === o.id ? 'selected' : ''}>${x.id} · ${esc(rest(x.rid).name)} (${esc(x.when)})</option>`).join('')}</select></label>
        <fieldset style="margin:0;padding:0;border:0" class="col"><legend class="f" style="padding:0 0 6px">What happened?</legend>${[['missing', 'An item was missing'], ['wrong', 'Wrong item'], ['late', 'Order was very late'], ['damaged', 'Arrived damaged or spilled']].map(([k, l]) => `<label class="opt ${h.issue === k ? 'on' : ''}"><input type="radio" name="hi" data-a="helpIssue" data-v="${k}" ${h.issue === k ? 'checked' : ''}>${l}</label>`).join('')}</fieldset>
        ${['missing', 'wrong', 'damaged'].includes(h.issue) ? `<fieldset style="margin:0;padding:0;border:0" class="col"><legend class="f" style="padding:0 0 6px">Which items?</legend>${o.lines.map((l, i) => `<label class="row"><input type="checkbox" data-a="helpItem" data-i="${i}" ${h.items[i] ? 'checked' : ''}>${l.qty}× ${esc(l.name)} · ${money(l.unit * l.qty)}</label>`).join('')}</fieldset>` : ''}
        <label class="f">Anything else? <textarea class="in" id="h-note" data-m="help.note" placeholder="Optional">${esc(h.note)}</textarea></label>
        <button class="btn" data-a="sendHelp">Send to our team</button>
      </div>
      <div class="card pad col"><b>Common questions</b>
        <details open><summary><b>When is my card charged?</b></summary><p class="mut">We hold the amount when you order and charge it only when the restaurant accepts. No answer in 5 minutes means the hold is released.</p></details>
        <details><summary><b>Does my courier get my whole tip?</b></summary><p class="mut">Yes. 100% of your tip goes to your courier.</p></details>
        <details><summary><b>Why is there no service fee?</b></summary><p class="mut">Restaurants pay a flat monthly plan instead of commission, so we don’t add service fees.</p></details>
      </div>
      <div class="row wrap"><button class="btn ln" data-a="toastMsg" data-msg="Support chat would open here (prototype)">Chat with us</button><button class="btn ln" data-a="toastMsg" data-msg="Email support: help@sendkoro.com">Email us</button></div></div>`;
  };

  // ---------- overlays ----------
  function itemSheet() {
    const sh = S.sheet; const r = rest(sh.rid); const it = findItem(r, sh.itemId);
    const unit = lineUnit(it, sh.sel);
    const groups = (it.opts || []).map((g) => `<fieldset style="margin:0;padding:0;border:0" class="col"><legend class="row between" style="width:100%;padding:0 0 6px"><b>${esc(g.name)}</b><span class="mut sm-t">${g.one ? 'Choose 1' : `Up to ${g.max}`}</span></legend>${g.choices.map((c) => { const on = g.one ? sh.sel[g.id] === c.id : !!(sh.sel[g.id] && sh.sel[g.id][c.id]); return `<label class="opt ${on ? 'on' : ''}"><input type="${g.one ? 'radio' : 'checkbox'}" name="g-${g.id}" data-a="optPick" data-g="${g.id}" data-c="${c.id}" ${on ? 'checked' : ''}><span class="grow">${esc(c.name)}</span><span class="mut">${c.price ? '+' + money(c.price) : 'Included'}</span></label>`; }).join('')}</fieldset>`).join('');
    return `<div class="overlay" data-a="closeSheet" data-self="1"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(it.name)}">
      ${it.img ? `<img src="${IMG(it.img)}" alt="" style="width:100%;height:180px;object-fit:cover;border-radius:14px">` : ''}
      <div class="row between" style="align-items:flex-start"><div><h2 style="font-size:22px">${esc(it.name)}</h2><div class="mut">${esc(it.desc)}</div></div><b style="font-size:19px">${money(it.price)}</b></div>
      ${groups}
      ${it.allergens ? `<div class="note n-w"><b>Allergens:</b> ${esc(it.allergens)}</div>` : ''}
      <label class="f">Note for the kitchen<input class="in" id="it-note" data-m="sheet.note" placeholder="e.g. no onions" value="${esc(sh.note || '')}"></label>
      <div class="row"><span class="qty"><button data-a="sheetQty" data-d="-1" aria-label="Fewer">−</button><b>${sh.qty}</b><button data-a="sheetQty" data-d="1" aria-label="More">+</button></span><button class="btn grow" data-a="addToCart">${sh.editIndex != null ? 'Update item' : 'Add to cart'} · ${money(unit * sh.qty)}</button></div>
      <button class="btn gh" data-a="closeSheet">Cancel</button></div></div>`;
  }
  function modal() {
    const md = S.modal;
    if (md.type === 'locate') return `<div class="overlay"><div class="sheet loc-sheet" role="dialog" aria-modal="true" aria-label="Allow your location"><button class="loc-x" data-a="locType" data-close="1" aria-label="Close">×</button><h2 style="font-size:26px;margin:0">Allow your location</h2>${LOC_ART}<p class="mut" style="margin:0;text-align:center">Skip the typing and see restaurants near you.</p>${S.locating === 'modal' ? '<div class="row" style="justify-content:center;gap:10px;min-height:52px"><span class="gps-spin" aria-hidden="true"></span><b>Finding you…</b></div>' : '<button class="btn" data-a="locAllow" style="min-height:52px">Allow</button>'}<button class="btn gh" data-a="locType">Type in delivery address instead</button></div></div>`;
    if (md.type === 'replace') return `<div class="overlay"><div class="sheet" role="dialog" aria-modal="true"><h2 style="font-size:22px">Start a new cart?</h2><p class="mut" style="margin:0">Your cart has items from ${esc(rest(S.cart.rid).name)}. Each order comes from one restaurant.</p><button class="btn" data-a="replaceCart">Start new cart</button><button class="btn ln" data-a="closeModal" style="min-height:52px">Keep current cart</button></div></div>`;
    if (md.type === 'receipt') { const o = S.orders.find((x) => x.id === md.id); const r = rest(o.rid); return `<div class="overlay" data-a="closeModal" data-self="1"><div class="sheet" role="dialog" aria-modal="true"><div class="row between"><h2 style="font-size:22px">Receipt ${o.id}</h2><button class="btn gh" data-a="closeModal" aria-label="Close">✕</button></div><div class="mut">${esc(r.name)} · ${esc(o.when)}</div><div class="card pad col" style="gap:2px">${o.lines.map((l) => `<div class="rw"><span>${l.qty}× ${esc(l.name)}${l.desc ? ` <span class="mut sm-t">(${esc(l.desc)})</span>` : ''}</span><span>${money(l.unit * l.qty)}</span></div>`).join('')}</div><div class="card pad col" style="gap:2px">${receiptRows(o.q, r, o.fulfil)}</div>${o.status === 'declined' ? '<div class="note n-g">Declined by the restaurant. The hold was released and you were not charged.</div>' : '<div class="mut sm-t">Paid with Visa •••• 4242. No Send Koro service or card fees.</div>'}<button class="btn" data-a="closeModal">Done</button></div></div>`; }
    if (md.type === 'info') { const [t, html] = INFO[md.k]; return `<div class="overlay" data-a="closeModal" data-self="1"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(t)}"><div class="row between"><h2 style="font-size:22px">${esc(t)}</h2><button class="btn gh" data-a="closeModal" aria-label="Close">✕</button></div><div class="col info">${html}</div><button class="btn" data-a="closeModal">Done</button></div></div>`; }
    if (md.type === 'card') { const c = md; return `<div class="overlay"><div class="sheet" role="dialog" aria-modal="true" aria-label="${c.id ? 'Edit card' : 'Add a card'}"><h2 style="font-size:22px">${c.id ? `Edit ${esc(c.brand)} •••• ${c.last4}` : 'Add a card'}</h2>
      ${c.id ? '<span class="mut sm-t">To change the card number, add a new card and remove this one.</span>' : `<label class="f">Card number<input class="in" id="cd-num" inputmode="numeric" autocomplete="cc-number" data-m="modal.num" value="${esc(c.num || '')}" placeholder="4242 4242 4242 4242"></label>`}
      <div style="display:grid;grid-template-columns:1fr 1fr${c.id ? '' : ' 1fr'};gap:10px"><label class="f">Expiry<input class="in" id="cd-exp" inputmode="numeric" autocomplete="cc-exp" data-m="modal.exp" value="${esc(c.exp || '')}" placeholder="MM/YY"></label>${c.id ? '' : `<label class="f">CVC<input class="in" id="cd-cvc" inputmode="numeric" autocomplete="cc-csc" data-m="modal.cvc" value="${esc(c.cvc || '')}" placeholder="123"></label>`}<label class="f">ZIP<input class="in" id="cd-zip" inputmode="numeric" autocomplete="postal-code" data-m="modal.zip" value="${esc(c.zip || '')}" placeholder="11205"></label></div>
      ${c.id ? '' : `<label class="row"><input type="checkbox" id="cd-def" data-m="modal.def" ${c.def ? 'checked' : ''}>Make this my default card</label>`}
      <button class="btn" data-a="saveCard">${c.id ? 'Save changes' : 'Save card'}</button><button class="btn gh" data-a="closeModal">Cancel</button><span class="mut sm-t" style="text-align:center">Secured by Stripe. Prototype: no real card is saved.</span></div></div>`; }
    if (md.type === 'delCard') { const c = cardById(md.id); return `<div class="overlay"><div class="sheet" role="dialog" aria-modal="true"><h2 style="font-size:22px">Remove ${esc(c.brand)} •••• ${c.last4}?</h2><p class="mut" style="margin:0">You can add it again any time.</p><button class="btn" data-a="confirmDelCard" data-id="${c.id}" style="background:#C81E24">Remove card</button><button class="btn gh" data-a="closeModal">Keep it</button></div></div>`; }
    if (md.type === 'name') return `<div class="overlay"><div class="sheet" role="dialog" aria-modal="true"><h2 style="font-size:22px">Edit your name</h2><label class="f">Name<input class="in" id="md-name" data-m="modal.value" value="${esc(md.value)}"></label><button class="btn" data-a="saveName">Save</button><button class="btn gh" data-a="closeModal">Cancel</button></div></div>`;
    return '';
  }

  // ---------- frame ----------
  function webHeader() {
    if (M.theme === 'navy') return `<header class="nvw-head"><div class="nvw-in">
      <button data-a="tab" data-to="home" class="nv-logo" style="border:0;font-size:28px;cursor:pointer">${LOGO('', 54)}${WORD}</button><span class="nvw-div"></span>
      <button data-a="go" data-to="addresses" class="nvw-addr">${ic.pin}<span><small>${S.fulfil === 'pickup' ? 'Pickup near' : 'Deliver to'}</small><b>${esc(addr().label)} · ${esc(addr().line)}</b></span><span class="addr-chev" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button>
      <span class="grow"></span>
      <nav class="nvw-nav">${[['home', 'Restaurants'], ['search', 'Search'], ['orders', 'Orders'], ['help', 'Help']].map(([k, l]) => `<button data-a="${k === 'help' ? 'go' : 'tab'}" data-to="${k}" class="${S.screen === k ? 'on' : ''}">${l}</button>`).join('')}</nav>
      ${S.signedIn ? `<button data-a="tab" data-to="account" aria-label="Account" class="nv-av" style="border:0;width:42px;height:42px">${esc(S.user.name.split(' ').map((w) => w[0]).join('').slice(0, 2))}</button>` : '<button class="nv-sign" data-a="go" data-to="signin" style="height:42px;padding:0 20px">Sign in</button>'}
      <button class="nv-cart" data-a="go" data-to="cart" aria-label="Cart, ${cartCount()} items" style="width:56px;height:42px"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.6 12.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.5L21 8H6"/></svg>${cartCount() ? `<i>${cartCount()}</i>` : ''}</button></div></header>`;
    return `<header style="background:var(--g);color:#fff"><div style="max-width:1240px;margin:0 auto;padding:12px max(16px,env(safe-area-inset-left,0px));display:flex;flex-wrap:wrap;align-items:center;gap:12px;min-height:72px">
      <button data-a="tab" data-to="home" class="logo" style="border:0;background:transparent;color:#fff;font-size:23px;padding:0">${LOGO('#E2B04A', 38)}${WORD}</button>
      <button data-a="go" data-to="addresses" class="row" style="height:42px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.3);background:transparent;color:#fff;font-weight:600;font-size:14px">${ic.pin}${S.fulfil === 'delivery' ? 'Deliver to ' + esc(addr().label) : 'Pickup'}<span class="addr-chev on-dark" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button>
      <span class="grow"></span>
      <nav class="row wrap" style="gap:2px">${[['home', 'Browse food'], ['search', 'Search'], ['orders', 'Orders'], ['help', 'Help']].map(([k, l]) => `<button data-a="${k === 'help' ? 'go' : 'tab'}" data-to="${k}" style="height:42px;padding:0 12px;border:0;background:${S.screen === k ? 'rgba(255,255,255,.14)' : 'transparent'};border-radius:10px;color:#fff;font-weight:600">${l}</button>`).join('')}
        <button data-a="go" data-to="cart" aria-label="Cart, ${cartCount()} items" style="position:relative;width:44px;height:44px;border:0;background:transparent;color:#fff">${ic.cart}${cartCount() ? `<span style="position:absolute;right:2px;top:4px;min-width:18px;height:18px;border-radius:99px;background:#FF7A2E;color:var(--ink);font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center">${cartCount()}</span>` : ''}</button>
        ${S.signedIn ? `<button data-a="tab" data-to="account" aria-label="Account" style="width:40px;height:40px;border-radius:99px;border:0;background:var(--card);color:var(--ink);font-weight:800">${esc(S.user.name.split(' ').map((w) => w[0]).join('').slice(0, 2))}</button>` : '<button class="btn sm" data-a="go" data-to="signin">Sign in</button>'}</nav></div></header>`;
  }
  const INFO = {
    prices: ['How our prices work', `<p>Restaurants set their own menu prices. They pay Send Koro a flat monthly plan with <b>$0 commission</b>, so we add <b>no service fee and no card fee</b>.</p><div class="card pad col" style="gap:2px"><div class="rw"><span class="mut">Food</span><span>Restaurant’s own prices</span></div><div class="rw"><span class="mut">Delivery fee</span><span>Set by distance, the restaurant may pay part or all</span></div><div class="rw"><span class="mut">Tax</span><span>Set by the restaurant</span></div><div class="rw"><span class="mut">Courier tip</span><span>Optional, 100% to your courier</span></div></div><p class="mut">We hold the amount when you order and charge it only when the restaurant accepts. No answer in 5 minutes means the hold is released.</p>`],
    partner: ['Add your restaurant', `<p>Flat monthly plan from <b>$50</b>, <b>first month free</b>, and <b>$0 commission</b>. Food money goes straight to your own Stripe account on every order.</p><ul class="mut" style="margin:0;padding-left:18px"><li>You set your prices, tax and hours</li><li>Choose who pays delivery: customer, split, free over an amount, or you</li><li>Card processing on food is 2.9% + 30¢</li></ul><a class="btn dk" href="https://claude.ai/artifact/K9LXa63KacHGUGyWuc1HFu" target="_blank" rel="noopener">Open the restaurant portal prototype</a>`],
    restsignin: ['Restaurant sign in', `<p>Owners, managers and staff sign in to the restaurant portal with a text code. No passwords.</p><a class="btn dk" href="https://claude.ai/artifact/K9LXa63KacHGUGyWuc1HFu" target="_blank" rel="noopener">Open the restaurant portal prototype</a>`],
    courier: ['Deliver with Send Koro', `<p>See the pay for every trip before you accept it, and it never goes down after you accept.</p><ul class="mut" style="margin:0;padding-left:18px"><li>100% of every tip goes to you</li><li>No fees taken from your pay or tips</li><li>Meets New York City’s minimum pay rules for delivery workers</li><li>No subscription to drive</li></ul>`],
    contact: ['Contact us', `<p>Chat with us in the app from 11 AM to 11 PM, or email:</p><p style="font-size:18px;font-weight:800;user-select:all">help@sendkoro.com</p><p class="mut">For a problem with an order, the Help center form is fastest.</p>`],
    apps: ['Get the app', `<p>The Send Koro app for iPhone and Android has the same restaurants, prices and order tracking as the website.</p><a class="btn dk" href="https://claude.ai/artifact/KwU9YEmqULMaFRV57DpdRW" target="_blank" rel="noopener">Open the app prototype</a>`],
    privacy: ['Privacy', `<p>We use your phone number to sign you in and your address to deliver. Card details are stored by Stripe, never by Send Koro. We don’t sell your personal information.</p><p class="mut">Prototype text. The full policy will be written with a lawyer.</p>`],
    accessibility: ['Accessibility', `<p>Send Koro aims to meet WCAG 2.1 AA: readable contrast, keyboard access and screen-reader labels. Tell us about any barrier at help@sendkoro.com.</p>`],
    terms: ['Terms', `<p>Restaurants sell you the food and set its price and tax. Send Koro runs the marketplace and arranges delivery.</p><p class="mut">Prototype text. The full terms will be written with a lawyer.</p>`],
    cookies: ['Cookie settings', `<label class="row" style="padding:8px 0"><span class="grow"><b>Needed</b><span class="mut sm-t" style="display:block">Sign-in and your cart. Always on.</span></span><span class="switch"><input type="checkbox" checked disabled aria-label="Needed cookies"></span></label><label class="row" style="padding:8px 0;border-top:1px solid var(--line)"><span class="grow"><b>Analytics</b><span class="mut sm-t" style="display:block">Helps us improve the site.</span></span><span class="switch"><input type="checkbox" aria-label="Analytics cookies"></span></label>`],
  };
  const AREAS = ['Park Slope', 'Kensington', 'Prospect Heights', 'Fort Greene', 'Boerum Hill', 'Flatbush', 'Cobble Hill'];
  function webFooter() {
    const L = (a, extra, label) => `<button data-a="${a}" ${extra} class="flink">${label}</button>`;
    const promise = [['$0', 'No service fees', 'Restaurants pay a flat plan, not commission'], ['100%', 'Of tips to couriers', 'Every dollar you tip goes to your courier'], ['Hold', 'Charged on accept', 'Card held until the restaurant says yes'], ['Local', 'Brooklyn favourites', 'Neighborhood kitchens at their own prices']];
    return `<footer style="background:var(--g);color:#F3E9D6;margin-top:56px">
      <div class="fwrap" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;padding-block:28px;border-bottom:1px solid rgba(255,255,255,.16)">${promise.map(([b, t, d]) => `<div class="row" style="align-items:flex-start;gap:12px"><span style="flex:none;min-width:56px;height:44px;padding:0 8px;border-radius:12px;background:rgba(255,255,255,.1);color:#FF9A5C;font-weight:800;display:flex;align-items:center;justify-content:center">${b}</span><span><b style="color:#fff">${t}</b><span style="display:block;font-size:13px;color:#E6D8BF">${d}</span></span></div>`).join('')}</div>
      <div class="fwrap" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:28px;padding-block:36px 28px;font-size:14px">
        <div class="col" style="gap:12px;grid-column:span 1;min-width:0"><span class="logo" style="color:#fff;font-size:24px">${LOGO('', 50)}${WORD}</span><span style="line-height:1.55">Your neighborhood, delivered. Local New York restaurants with $0 commission.</span>
          <div class="row wrap" style="gap:8px">${[['Download on the', 'App Store'], ['Get it on', 'Google Play']].map(([s, b]) => `<button data-a="info" data-k="apps" style="height:44px;padding:0 14px;border-radius:10px;border:0;background:var(--card);color:var(--ink);display:inline-flex;flex-direction:column;justify-content:center;align-items:flex-start;line-height:1.1"><span style="font-size:10px;font-weight:600">${s}</span><b style="font-size:14px">${b}</b></button>`).join('')}</div></div>
        <nav aria-label="Order" class="col fcol"><b>Order</b>${L('tab', 'data-to="home"', 'Browse restaurants')}${L('footPickup', '', 'Pickup near me')}${L('tab', 'data-to="search"', 'Search food')}${L('tab', 'data-to="orders"', 'Your orders')}${L('go', 'data-to="cart"', 'Your cart')}</nav>
        <nav aria-label="Cuisines" class="col fcol"><b>Cuisines</b>${CUISINES.slice(0, 6).map(([c]) => L('footCuisine', `data-c="${c}"`, c)).join('')}</nav>
        <nav aria-label="Neighborhoods" class="col fcol"><b>Neighborhoods</b>${AREAS.map((a) => L('footArea', `data-v="${a}"`, a)).join('')}</nav>
        <nav aria-label="Partners" class="col fcol"><b>Partners</b>${L('info', 'data-k="partner"', 'Add your restaurant')}${L('info', 'data-k="restsignin"', 'Restaurant sign in')}${L('info', 'data-k="courier"', 'Deliver with Send Koro')}</nav>
        <nav aria-label="Help" class="col fcol"><b>Help</b>${L('go', 'data-to="help"', 'Help center')}${L('info', 'data-k="contact"', 'Contact us')}${L('info', 'data-k="prices"', 'How our prices work')}${L('tab', 'data-to="account"', 'Your account')}</nav>
      </div>
      <div class="fwrap" style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px 24px;padding-block:18px 26px;border-top:1px solid rgba(255,255,255,.16);font-size:13px"><span>© 2026 Send Koro · New York, NY · Payments by Stripe</span><span class="row wrap" style="gap:18px">${[['privacy', 'Privacy'], ['accessibility', 'Accessibility'], ['terms', 'Terms'], ['cookies', 'Cookie settings']].map(([k, l]) => L('info', `data-k="${k}"`, l)).join('')}</span></div></footer>`;
  }
  function phoneFooter() {
    const L = (a, extra, label) => `<button data-a="${a}" ${extra} class="flink">${label}</button>`;
    return `<div style="background:var(--g);color:#F3E9D6;padding:22px 18px 26px;margin-top:8px" class="col">
      <span class="logo" style="color:#fff;font-size:19px">${LOGO('#E2B04A', 28)}${WORD}</span>
      <div class="col" style="gap:8px;font-size:13px">${[['$0', 'No service fees'], ['100%', 'Of tips to your courier'], ['Hold', 'Charged only when the restaurant accepts']].map(([b, t]) => `<div class="row"><b style="color:#FF9A5C;min-width:44px">${b}</b><span>${t}</span></div>`).join('')}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 14px;padding-top:10px;border-top:1px solid rgba(255,255,255,.16)">${L('go', 'data-to="help"', 'Help center')}${L('info', 'data-k="prices"', 'How prices work')}${L('info', 'data-k="contact"', 'Contact us')}${L('info', 'data-k="partner"', 'Add your restaurant')}${L('info', 'data-k="courier"', 'Deliver with us')}${L('info', 'data-k="privacy"', 'Privacy')}${L('info', 'data-k="terms"', 'Terms')}${L('info', 'data-k="accessibility"', 'Accessibility')}</div>
      <span style="font-size:12px;color:#E6D8BF">© 2026 Send Koro · New York, NY</span></div>`;
  }
  function tabBar() {
    const items = [['home', 'Home', ic.home], ['search', 'Search', ic.search], ['orders', 'Orders', ic.list], ['account', 'Account', ic.user]];
    const cur = MAIN.includes(S.screen) ? S.screen : S.stack.find((s) => MAIN.includes(s)) || 'home';
    const live = S.orders.some((o) => !['delivered', 'collected', 'declined'].includes(o.status));
    return `<nav aria-label="Main" class="cx-tabs">${items.map(([k, l, svg]) => `<button data-a="tab" data-to="${k}" aria-current="${cur === k ? 'page' : 'false'}" class="${cur === k ? 'on' : ''}">${svg}<span>${l}</span>${k === 'orders' && live ? '<i class="cx-dot" aria-label="Order in progress"></i>' : ''}</button>`).join('')}</nav>`;
  }
  function browserBar() {
    return `<div style="flex:none;height:56px;padding:8px 12px;background:#F3EDE3;display:flex;align-items:center;gap:8px">${ic.home}<div style="flex:1;height:38px;border-radius:999px;background:var(--card);display:flex;align-items:center;justify-content:center;gap:6px;font-size:14px;font-weight:600">${ic.lock}sendkoro.com</div><button aria-label="Reload" data-a="tab" data-to="home" style="border:0;background:transparent;font-size:18px">↻</button></div>`;
  }

  const PAGES = [
    ...(PHONE && !M.pwa ? [['welcome', 'Welcome']] : []), ...(M.pwa ? [['install', 'Install']] : []),
    ['signin', 'Sign in'], ['addresses', 'Address'], ['home', 'Home'], ['search', 'Search'], ['restaurant', 'Restaurant'], ['item', 'Item options'], ['cart', 'Cart'], ['checkout', 'Checkout'], ['confirm', 'Order placed'], ['track', 'Tracking'], ['orders', 'Orders'], ['account', 'Account'], ['profile', 'Profile'], ['wallet', 'Wallet'], ['payments', 'Payment methods'], ['refer', 'Refer a friend'], ['addrForm', 'New address'], ['help', 'Help'],
  ];
  function pagesBar() {
    const cur = S.sheet ? 'item' : S.screen;
    return `<nav class="pages" aria-label="Open a page"><span class="pages-l">Open a page</span>${PAGES.map(([k, l], i) => `<button data-a="page" data-k="${k}" class="${cur === k ? 'on' : ''}" aria-current="${cur === k ? 'page' : 'false'}">${i + 1}. ${l}</button>`).join('')}</nav>`;
  }
  let lastScreen = null;
  // Cuisine row: arrows show only when there is more to see; drag with the mouse like a swipe.
  function wireCuisineRows() {
    root.querySelectorAll('.cuis-wrap').forEach((w) => {
      const row = w.querySelector('.nv-cuis'); if (!row || row.dataset.wired) return; row.dataset.wired = '1';
      const upd = () => { w.classList.toggle('at-start', row.scrollLeft <= 20); w.classList.toggle('at-end', row.scrollLeft + row.clientWidth >= row.scrollWidth - 20); };
      row.addEventListener('scroll', upd, { passive: true }); upd();
      row.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') drag = { row, x0: e.clientX, s0: row.scrollLeft, moved: false }; });
      row.addEventListener('click', (e) => { if (row.dataset.dragged) { delete row.dataset.dragged; e.stopPropagation(); e.preventDefault(); } }, true);
    });
  }
  let drag = null;
  window.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x0; if (Math.abs(dx) > 5) { drag.moved = true; drag.row.classList.add('dragging'); } drag.row.scrollLeft = drag.s0 - dx; });
  window.addEventListener('pointerup', () => { if (!drag) return; if (drag.moved) drag.row.dataset.dragged = '1'; drag.row.classList.remove('dragging'); drag = null; });
  function render(scrollTop) {
    if (S.screen === 'home' && !S.signedIn && !S.locAsked && !S.modal && !S.sheet) S.modal = { type: 'locate' };
    root.classList.toggle('navy', M.theme === 'navy');
    const content = (V[S.screen] || V.home)();
    const scr = root.querySelector('.scr');
    const keep = !scrollTop && lastScreen === S.screen && scr ? scr.scrollTop : 0;
    const active = document.activeElement && document.activeElement.id;
    const caret = active && document.activeElement.selectionStart;
    let html;
    const demo = `<div class="demo"><b>Prototype.</b> Pretend data, no real orders or payments. ${M.label || ''}</div>`;
    const overlays = (S.sheet ? itemSheet() : '') + (S.modal ? modal() : '') + (S.toast ? `<div class="toast" role="status">${esc(S.toast)}</div>` : '');
    if (PHONE) {
      const showTabs = MAIN.includes(S.screen);
      const banner = M.pwa && !S.installed && !S.bannerHidden && S.screen === 'home' ? `<div class="row sk-install" style="flex:none;background:var(--gt);padding:8px 12px">${LOGO('#E2B04A', 30)}<span class="grow sm-t"><b>Install Send Koro</b><br>Add it to your home screen</span><button class="btn dk" data-a="go" data-to="install" style="min-height:36px;font-size:14px;padding:0 12px">Install</button><button data-a="hideBanner" aria-label="Dismiss" style="border:0;background:transparent;width:32px;height:32px">✕</button></div>` : '';
      html = `<div class="stage">${pagesBar()}<div class="device">${M.pwa && !S.installed ? browserBar() : ''}${banner}<div class="scr">${content}</div>${showTabs ? tabBar() : ''}${overlays}</div><p class="stage-note">${esc(M.note || '')}</p></div>`;
    } else {
      html = `<div class="web" style="background:var(--bg);min-height:100vh;display:flex;flex-direction:column">${demo}${pagesBar()}${webHeader()}<main class="scr col" style="max-width:1240px;width:100%;margin:0 auto;padding:24px max(16px,env(safe-area-inset-left,0px)) 0;gap:20px;flex:1;overflow:visible">${content}</main>${webFooter()}${overlays}</div>`;
    }
    root.innerHTML = html;
    wireCuisineRows();
    lastScreen = S.screen;
    const scr2 = root.querySelector('.scr');
    if (scr2) scr2.scrollTop = keep;
    if (!PHONE && scrollTop) window.scrollTo(0, 0);
    if (active) { const el = document.getElementById(active); if (el) { el.focus(); try { if (caret != null) el.setSelectionRange(caret, caret); } catch (e) { /* not a text field */ } } }
  }

  // ---------- model binding ----------
  function setPath(path, val) { const parts = path.split('.'); let o = S; while (parts.length > 1) o = o[parts.shift()]; o[parts[0]] = val; }
  // Address suggestions: ↓/↑ move through the list, Enter picks the first (or focused) one, Esc closes.
  root.addEventListener('keydown', (e) => {
    const box = e.target.closest ? e.target.closest('label, .addr-sugg') : null; if (!box) return;
    const list = (e.target.closest('.addr-sugg') || (box.nextElementSibling && box.nextElementSibling.classList.contains('addr-sugg') ? box.nextElementSibling : null) || box.parentElement.querySelector('.addr-sugg'));
    if (!list) return; const opts = [...list.querySelectorAll('.addr-opt')]; if (!opts.length) return;
    const i = opts.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); opts[Math.min(opts.length - 1, i + 1)].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (i <= 0) (box.querySelector('input') || opts[0]).focus(); else opts[i - 1].focus(); }
    else if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); opts[0].click(); }
    else if (e.key === 'Escape') list.remove();
  });
  root.addEventListener('input', (e) => {
    const t = e.target; const m = t.dataset.m; if (!m) return;
    if (m.startsWith('addrForm.') && !S.addrForm) S.addrForm = { street: '', apt: '', note: '', label: 'Home', def: false };
    if (m === 'addrForm.street' && S.addrForm) S.addrForm.picked = false;
    if (m === 'addrText') S.addrPicked = false;
    if (m === 'signupCode') S.signupCodeOk = null;
    setPath(m, t.type === 'checkbox' ? t.checked : t.value);
    if (t.dataset.live || t.dataset.rerender) render();
  });
  root.addEventListener('change', (e) => { const t = e.target; if (t.dataset.m && t.tagName === 'SELECT') { setPath(t.dataset.m, t.value); render(); } });

  // ---------- actions ----------
  const A = {
    back, go: (d) => go(d.to), tab: (d) => tabTo(d.to),
    toastMsg: (d) => toast(d.msg),
    info: (d) => { S.modal = { type: 'info', k: d.k }; render(); },
    footPickup: () => { S.fulfil = 'pickup'; toast('Showing pickup. No delivery fee or tip.'); tabTo('home'); },
    footCuisine: (d) => { S.cuisine = d.c; S.q = ''; tabTo('home'); },
    footArea: (d) => { S.q = d.v; S.cuisine = null; tabTo('search'); },
    install: () => { S.installed = true; toast('Installed. Send Koro now opens full screen from your home screen.'); render(); },
    hideBanner: () => { S.bannerHidden = true; render(); },
    sendCode: () => { const digits = S.phone.replace(/\D/g, ''); if (digits.length !== 10) return toast('Enter a 10-digit US mobile number.'); S.codeSent = true; S.newUser = false; S.code = ''; toast('Code sent by text (prototype: any 6 digits work).'); render(); },
    changePhone: () => { S.codeSent = false; render(); },
    resend: () => toast('A new code is on its way.'),
    verify: () => { if (!/^\d{6}$/.test(S.code)) return toast('Enter the 6-digit code.'); if (S.newUserPick) { S.newUser = true; render(); return; } finishSignIn(); },
    finishProfile: () => { if (S.name.trim().length < 2) return toast('Enter your name.'); if (S.addrText.trim().length < 5) return toast('Enter your delivery address.'); S.user.name = S.name.trim(); const [line, ...rest2] = S.addrText.split(','); S.addresses.unshift({ id: 'a' + Date.now(), label: 'Home', line: line.trim(), city: rest2.join(',').trim() || 'Brooklyn, NY', note: '', ...geoFor(S.addrText) }); S.addrId = S.addresses[0].id; S.defaultAddr = S.addrId;
      const rc = signupCodeResult(S.signupCode); if (rc && !rc.ok) return toast(rc.msg);
      if (rc) { S.wallet = { balance: rc.cents, useCredit: true, codes: rc.friend ? [] : [S.signupCode.trim().toUpperCase()], history: [{ id: 'w' + Date.now(), label: rc.label, cents: rc.cents, when: 'Today', note: 'Expires ' + in30() }] }; S.referral = { code: S.name.trim().split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').slice(0, 10) + '5', invites: [] }; }
      finishSignIn(); if (rc) toast(`Welcome! ${money(rc.cents)} credit added to your wallet, valid 30 days.`); },
    useAddr: (d) => { const g = geoFor(d.v); const [line, ...r2] = d.v.split(','); const a = { id: 'a' + Date.now(), label: 'Other', line: line.trim(), city: r2.join(',').trim(), note: '', lat: g.lat, lng: g.lng }; S.addresses.push(a); S.addrId = a.id; S.addrQ = ''; toast(`Showing restaurants near ${a.line}.`); back(); },
    locAllow: () => { S.locating = 'modal'; render(); locateMe().then((a) => { S.locating = null; S.modal = null; if (a.outside) { S.locAsked = true; toast('You’re outside our delivery areas. Type an address instead.'); go('addresses'); return; } setCurrentLocation(a); render(); }); },
    locType: (d) => { S.locAsked = true; S.modal = null; if (d.close) return render(); go('addresses'); setTimeout(() => { const q = document.getElementById('aq'); if (q) q.focus(); }, 50); },
    gpsFill: (d) => {
      S.locating = d.target; render();
      locateMe().then((a) => {
        S.locating = null;
        if (a.outside) { toast('We couldn’t find a delivery address near you. Type it instead.'); return render(); }
        if (d.target === 'addresses') { setCurrentLocation(a); S.addrQ = ''; back(); return; }
        if (d.target === 'addrForm') { S.addrForm.street = a.t; S.addrForm.picked = true; }
        if (d.target === 'signup') { S.addrText = a.t; S.addrPicked = true; }
        toast(a.real ? 'Filled from your location. Check the house number.' : 'Demo location filled in (previews can’t read GPS).'); render();
      });
    },
    cuisScroll: (d, el) => { const row = el.closest('.cuis-wrap').querySelector('.nv-cuis'); row.scrollBy({ left: +d.d * Math.max(200, row.clientWidth * 0.8), behavior: 'smooth' }); },
    useCurrent: () => { const g = suggestAddresses('1 prospect park w', 1)[0]; const ex = S.addresses.find((x) => x.id === 'cur'); if (!ex) S.addresses.push({ id: 'cur', label: 'Current location', line: 'Near Prospect Park West', city: 'Brooklyn, NY 11215', note: '', lat: g.lat, lng: g.lng }); S.addrId = 'cur'; toast('Prototype: using a demo location near Prospect Park.'); back(); },
    filter: (d) => { S.f[d.k] = !S.f[d.k]; render(); },
    cuisine: (d) => { S.cuisine = d.c ? (S.cuisine === d.c ? null : d.c) : null; render(); },
    setQ: (d) => { S.q = d.v; render(); },
    fulfil: (d) => {
      const r = ['restaurant', 'cart', 'checkout'].includes(S.screen) ? rest(S.screen === 'restaurant' ? S.rid : S.cart.rid) : null;
      if (d.v === 'delivery' && r && !delivers(r)) return toast('Delivery isn’t available to your address from this restaurant. Pickup is open.');
      S.fulfil = d.v; if (!r) S.fulfilPref = d.v; render();
    },
    openRest: (d) => go('restaurant', { rid: d.id, tab: 0 }),
    tabMenu: (d) => { S.tab = +d.i; render(); },
    openItem: (d) => { const it = findItem(rest(S.rid), d.id); const sel = {}; (it.opts || []).forEach((g) => { if (g.one) sel[g.id] = g.choices[0].id; else sel[g.id] = {}; }); S.sheet = { rid: S.rid, itemId: d.id, sel, qty: 1, note: '' }; render(); },
    closeSheet: (d, t, e) => { if (d.self && e.target !== t) return; S.sheet = null; render(); },
    optPick: (d) => { const sh = S.sheet; const g = findItem(rest(sh.rid), sh.itemId).opts.find((x) => x.id === d.g); if (g.one) sh.sel[g.id] = d.c; else { const cur = sh.sel[g.id]; if (cur[d.c]) delete cur[d.c]; else { if (Object.keys(cur).length >= g.max) { toast(`Choose up to ${g.max}.`); render(); return; } cur[d.c] = true; } } render(); },
    sheetQty: (d) => { S.sheet.qty = Math.max(1, Math.min(20, S.sheet.qty + +d.d)); render(); },
    addToCart: () => { const sh = S.sheet; if (S.cart.rid && S.cart.rid !== sh.rid && S.cart.lines.length) { S.modal = { type: 'replace' }; render(); return; } commitAdd(); },
    replaceCart: () => { S.cart = { rid: null, lines: [] }; S.modal = null; commitAdd(); },
    closeModal: (d, t, e) => { if (d && d.self && e.target !== t) return; S.modal = null; render(); },
    openSignupCode: () => { S.signupCodeOpen = true; render(); setTimeout(() => { const el = document.getElementById('sc'); if (el) el.focus(); }, 30); },
    checkSignupCode: () => { const r = signupCodeResult(S.signupCode); if (!r) return toast('Type a code, or leave it empty.'); S.signupCodeOk = r.ok; S.signupCodeMsg = r.msg; render(); },
    copyRef: (d) => { try { navigator.clipboard.writeText(d.v).then(() => toast('Copied.'), () => toast('Copy: ' + d.v)); } catch (e) { toast('Copy: ' + d.v); } },
    shareRef: (d) => { const msg = `Join Send Koro with my link and get $5 to spend on food: https://${REF_LINK()} (code ${S.referral.code})`; toast({ sms: 'Opens Messages with: ', wa: 'Opens WhatsApp with: ', mail: 'Opens Mail with: ', more: 'Opens the share menu with: ' }[d.k] + msg); S.referral.invites.unshift({ name: 'New invite', status: 'invited', when: 'Today' }); render(); },
    previewRef: () => { S.signedIn = false; S.codeSent = true; S.newUserPick = true; S.newUser = true; S.code = '123456'; S.name = ''; S.addrText = ''; S.signupCode = S.referral.code; S.signupCodeOpen = true; const r = signupCodeResult(S.referral.code); S.signupCodeOk = r.ok; S.signupCodeMsg = r.msg; go('signin'); },
    editLine: (d) => { const l = S.cart.lines[+d.i]; const it = findItem(rest(S.cart.rid), l.itemId); const sel = JSON.parse(JSON.stringify(l.sel || {})); (it.opts || []).forEach((g) => { if (!g.one && !sel[g.id]) sel[g.id] = {}; }); S.sheet = { rid: S.cart.rid, itemId: l.itemId, sel, qty: l.qty, note: l.note || '', editIndex: +d.i }; render(); },
    quickAdd: (d) => { const r = rest(S.cart.rid); const it = findItem(r, d.id); const sel = {}; (it.opts || []).forEach((g) => { sel[g.id] = g.one ? g.choices[0].id : {}; }); S.cart.lines.push({ itemId: it.id, name: it.name, img: it.img, sel, note: '', desc: lineDesc(it, sel), unit: lineUnit(it, sel), qty: 1 }); toast(`Added ${it.name}.`); render(); },
    utensils: () => { S.utensils = !S.utensils; render(); },
    qty: (d) => { const l = S.cart.lines[+d.i]; l.qty += +d.d; if (l.qty <= 0) S.cart.lines.splice(+d.i, 1); if (!S.cart.lines.length) S.cart.rid = null; render(); },
    clearCart: () => { S.cart = { rid: null, lines: [] }; toast('Cart cleared.'); render(); },
    checkout: () => { if (!S.signedIn) return needSignIn('checkout'); go('checkout'); },
    tip: (d) => { S.tipPct = d.v === 'custom' ? 'custom' : +d.v; render(); },
    pay: (d) => { S.pay = d.v; render(); },
    pickAddr: (d) => { S.addrId = d.id; if (d.back) { toast('Delivering to ' + addr().label); back(); } else render(); },
    newAddr: () => { S.addrForm = { street: '', apt: '', note: '', label: 'Other', def: false }; go('addrForm'); },
    useSugg: (d) => { S.addrForm.street = d.v; S.addrForm.picked = true; render(); },
    pickSignupAddr: (d) => { S.addrText = d.v; S.addrPicked = true; render(); },
    addrLabel: (d) => { S.addrForm.label = d.v; render(); },
    saveAddr: () => { const f = S.addrForm; if (f.street.trim().length < 5) return toast('Enter a street address.'); const [line, ...rest2] = f.street.split(','); const a = { id: 'a' + Date.now(), label: f.label, line: line.trim() + (f.apt ? ', ' + f.apt : ''), city: rest2.join(',').trim() || 'Brooklyn, NY', note: f.note, ...geoFor(f.street) }; S.addresses.push(a); S.addrId = a.id; if (f.def) S.defaultAddr = a.id; toast('Address saved.'); back(); },
    defAddr: (d) => { S.defaultAddr = d.id; S.addrId = d.id; toast('Default address updated.'); render(); },
    delAddr: (d) => { if (S.addresses.length === 1) return toast('Keep at least one address.'); S.addresses = S.addresses.filter((a) => a.id !== d.id); if (S.addrId === d.id) S.addrId = S.addresses[0].id; if (S.defaultAddr === d.id) S.defaultAddr = S.addresses[0].id; toast('Address deleted.'); render(); },
    dropoff: (d) => { S.dropoff = d.v; render(); },
    setDrop: (d) => { const o = S.orders.find((x) => x.id === d.id); if (!o || stepsFor(o).findIndex((st) => st[0] === o.status) >= 3) return toast('Your courier already has the order.'); o.dropoff = d.v; toast(d.v === 'hand' ? `Changed: hand it to me. Your PIN is ${o.pin}.` : 'Changed: leave at my door. You’ll get a photo.'); render(); },
    navySort: (d) => { S.navySort = S.navySort === d.v ? '' : d.v; render(); },
    navyFind: () => { const el = root.querySelector('#homeList'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
    placeOrder: () => {
      if (!S.signedIn) return needSignIn('checkout');
      { const rr = rest(S.cart.rid); if (rr.closed) return toast(`${rr.name} is closed now.`); const fd = S.cart.lines.reduce((a2, l) => a2 + l.unit * l.qty, 0); if (S.fulfil === 'delivery' && delivers(rr) && fd < minOrderFor(rr)) return toast(`Delivery here has a ${money(minOrderFor(rr))} minimum.`); }
      if (S.fulfil === 'delivery' && !delivers(rest(S.cart.rid))) return toast('This location doesn’t deliver to that address. Switch to pickup or change the address.');
      const q = curQuote();
      if (S.tipPct === 'custom' && !(parseFloat(S.tipCustom) >= 0)) return toast('Enter a tip amount, or choose a percentage.');
      const o = { id: 'SK' + ++orderSeq, rid: S.cart.rid, lines: S.cart.lines.map((l) => ({ ...l })), fulfil: S.fulfil, q, status: 'waiting', when: 'Today, ' + nowTime(), timeline: [['waiting', nowTime()]], addr: addr().line, dropoff: S.dropoff, pin: String(1000 + Math.floor(Math.random() * 9000)) };
      if (q.credit) { S.wallet.balance -= q.credit; S.wallet.history.unshift({ id: 'w' + Date.now(), label: `Used on order ${o.id}`, cents: -q.credit, when: 'Today' }); }
      S.orders.unshift(o); S.activeId = o.id; S.cart = { rid: null, lines: [] }; S.ordersTab = 'active';
      schedule(o); S.stack = ['home']; S.screen = 'confirm'; render(true);
    },
    simAccept: (d) => { const o = S.orders.find((x) => x.id === d.id); clearTimeout(o.timer); advance(o); },
    simDecline: (d) => decline(S.orders.find((x) => x.id === d.id), 'Restaurant was too busy'),
    skip: (d) => { const o = S.orders.find((x) => x.id === d.id); clearTimeout(o.timer); advance(o); },
    track: (d) => go('track', { activeId: d.id }),
    receipt: (d) => { S.modal = { type: 'receipt', id: d.id }; render(); },
    ordersTab: (d) => { S.ordersTab = d.v; render(); },
    reorder: (d) => { const o = S.orders.find((x) => x.id === d.id); const r = rest(o.rid); const lines = o.lines.filter((l) => !findItem(r, l.itemId).soldOut).map((l) => ({ ...l })); S.cart = { rid: o.rid, lines }; toast(`Added ${lines.length} item${lines.length === 1 ? '' : 's'} from ${r.name} to your cart.`); go('cart'); },
    helpFor: (d) => { S.help.orderId = d.id; S.help.items = {}; go('help'); },
    helpIssue: (d) => { S.help.issue = d.v; render(); },
    helpItem: (d) => { S.help.items[d.i] = !S.help.items[d.i]; render(); },
    sendHelp: () => { const h = S.help; const o = S.orders.find((x) => x.id === h.orderId); if (['missing', 'wrong', 'damaged'].includes(h.issue) && !Object.values(h.items).some(Boolean)) return toast('Choose which items had a problem.'); const what = { missing: 'Missing item', wrong: 'Wrong item', late: 'Late order', damaged: 'Damaged order' }[h.issue]; h.sent.unshift({ id: o.id, what }); h.items = {}; h.note = ''; toast('Sent. We’ll update you here and by text.'); render(true); },
    notif: (d) => { S.notif[d.k] = !S.notif[d.k]; toast(S.notif[d.k] ? 'Turned on.' : 'Turned off.'); },
    saveProfileName: () => { const n = S.profile.name.trim(); if (n.length < 2) return toast('Enter your name.'); S.user.name = n; toast('Name saved.'); render(); },
    sendEmailCode: () => { const e = S.profile.email.trim(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return toast('Enter a valid email address.'); S.profile.emailSent = true; S.profile.emailCode = ''; toast(`Code sent to ${e}. Prototype: any 6 digits work.`); render(); },
    verifyEmail: () => { if (!/^\d{6}$/.test(S.profile.emailCode)) return toast('Enter the 6-digit code from the email.'); S.user.email = S.profile.email.trim(); S.user.emailVerified = true; S.profile.emailSent = false; toast('Email verified. Receipts will go there.'); render(); },
    sendPhoneCode: () => { const d = S.profile.phone.replace(/\D/g, ''); if (!S.profile.phoneSent && !S.profile.phone) { setTimeout(() => { const el = document.getElementById('pf-phone'); if (el) el.focus(); }, 30); return toast('Type your new mobile number.'); } if (!(d.length === 10 || (d.length === 11 && d[0] === '1'))) return toast('Enter a 10-digit US mobile number.'); S.profile.phoneSent = true; S.profile.phoneCode = ''; toast('Code texted. Prototype: any 6 digits work.'); render(); },
    verifyPhone: () => { if (!/^\d{6}$/.test(S.profile.phoneCode)) return toast('Enter the 6-digit code from the text.'); const d = S.profile.phone.replace(/\D/g, '').slice(-10); S.user.phone = `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`; S.profile.phone = ''; S.profile.phoneSent = false; toast('Mobile number updated. Use it to sign in from now on.'); render(); },
    toggleCredit: () => { S.wallet.useCredit = !S.wallet.useCredit; render(); },
    applyPromo: () => {
      const code = S.promoQ.trim().toUpperCase(); const CODES = { WELCOME10: 1000, BROOKLYN5: 500 };
      if (!code) return toast('Enter a promo code.');
      if (!CODES[code]) return toast('That code isn’t valid or has expired.');
      if (S.wallet.codes.includes(code)) return toast('You’ve already used that code.');
      S.wallet.codes.push(code); S.wallet.balance += CODES[code]; S.wallet.history.unshift({ id: 'w' + Date.now(), label: `Promo code ${code}`, cents: CODES[code], when: 'Today', note: 'Expires ' + in30() }); S.promoQ = ''; toast(`${money(CODES[code])} added to your wallet.`); render();
    },
    addCard: () => { S.modal = { type: 'card', num: '', exp: '', cvc: '', zip: '', def: !S.cards.length }; render(); },
    editCard: (d) => { const c = cardById(d.id); S.modal = { type: 'card', ...c }; render(); },
    saveCard: () => {
      const m = S.modal; const exp = (m.exp || '').replace(/\s/g, ''); const zip = (m.zip || '').trim();
      if (!/^(0[1-9]|1[0-2])\/?\d{2}$/.test(exp)) return toast('Enter the expiry as MM/YY.');
      if (!/^\d{5}$/.test(zip)) return toast('Enter a 5-digit ZIP code.');
      const e2 = exp.includes('/') ? exp : exp.slice(0, 2) + '/' + exp.slice(2);
      if (m.id) { Object.assign(cardById(m.id), { exp: e2, zip }); S.modal = null; toast('Card updated.'); return render(); }
      const num = (m.num || '').replace(/\D/g, ''); if (num.length < 15 || num.length > 16) return toast('Enter the full card number.'); if (!/^\d{3,4}$/.test(m.cvc || '')) return toast('Enter the 3 or 4-digit CVC.');
      const brand = num[0] === '4' ? 'Visa' : /^5[1-5]|^2[2-7]/.test(num) ? 'Mastercard' : /^3[47]/.test(num) ? 'Amex' : /^6/.test(num) ? 'Discover' : 'Card';
      const c = { id: 'c' + Date.now(), brand, last4: num.slice(-4), exp: e2, zip }; S.cards.push(c); if (m.def || !S.defaultCard) S.defaultCard = c.id; S.pay = c.id; S.modal = null; toast(`${brand} •••• ${c.last4} saved.`); render();
    },
    defCard: (d) => { S.defaultCard = d.id; toast('Default card changed.'); render(); },
    delCard: (d) => { S.modal = { type: 'delCard', id: d.id }; render(); },
    confirmDelCard: (d) => { S.cards = S.cards.filter((c) => c.id !== d.id); if (S.defaultCard === d.id) S.defaultCard = S.cards[0] ? S.cards[0].id : null; if (S.pay === d.id) S.pay = S.defaultCard || 'apple'; S.modal = null; toast('Card removed.'); render(); },
    editName: () => { S.modal = { type: 'name', value: S.user.name }; render(); },
    saveName: () => { if (S.modal.value.trim().length < 2) return toast('Enter your name.'); S.user.name = S.modal.value.trim(); S.modal = null; toast('Name updated.'); render(); },
    signOut: () => { S.signedIn = false; S.codeSent = false; S.code = ''; toast('Signed out.'); tabTo('home'); },
  };
  function commitAdd() {
    const sh = S.sheet; const it = findItem(rest(sh.rid), sh.itemId);
    const sel = JSON.parse(JSON.stringify(sh.sel));
    const line = { itemId: it.id, name: it.name, img: it.img, sel, note: sh.note || '', desc: [lineDesc(it, sel), sh.note].filter(Boolean).join(' · '), unit: lineUnit(it, sel), qty: sh.qty };
    if (sh.editIndex != null) { S.cart.lines.splice(sh.editIndex, 1, line); S.cart.rid = sh.rid; S.sheet = null; toast('Item updated.'); render(); return; }
    const same = S.cart.lines.find((l) => l.itemId === line.itemId && l.desc === line.desc);
    if (same) same.qty += line.qty; else S.cart.lines.push(line);
    S.cart.rid = sh.rid; S.sheet = null;
    toast(`Added ${sh.qty}× ${it.name}.`);
    render();
  }
  // Sign-up codes: a friend's referral code (NAME5, e.g. NADIA5) or a promo code. Your own phone is verified at this point.
  function signupCodeResult(raw) {
    const c = String(raw || '').trim().toUpperCase(); if (!c) return null;
    const PROMO = { WELCOME10: 1000, BROOKLYN5: 500 };
    if (PROMO[c]) return { ok: true, cents: PROMO[c], label: `Promo code ${c}`, msg: `${money(PROMO[c])} promo credit will be added to your wallet.` };
    if (/^[A-Z]{2,12}5$/.test(c)) { const who = c.slice(0, -1); const name = who[0] + who.slice(1).toLowerCase(); return { ok: true, cents: 500, label: `Welcome gift from ${name}`, friend: name, msg: `${name} sent you $5. It goes into your wallet when you create your account.` }; }
    return { ok: false, msg: 'We don’t recognize that code. Check it, or leave it empty; it’s optional.' };
  }
  function finishSignIn() {
    S.signedIn = true; if (S.phone) S.user.phone = S.phone;
    toast(`Signed in as ${S.user.name}.`);
    const after = S.after; S.after = null;
    if (after === 'checkout' && S.cart.lines.length) { S.stack = ['home', 'cart']; S.screen = 'checkout'; render(true); }
    else tabTo('home');
  }
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-a]'); if (!t || !root.contains(t)) return;
    const fn = A[t.dataset.a]; if (!fn) return;
    if (t.tagName === 'INPUT' && (t.type === 'checkbox' || t.type === 'radio')) { /* allow default toggle */ } else e.preventDefault();
    fn(t.dataset, t, e);
  });

  // ---------- open any page directly ----------
  function demoCart() { if (!S.cart.lines.length) { S.cart = { rid: 'bbc', lines: [mkLine('bbc', 'gcb', { size: 'reg', ex: { avo: true } }), mkLine('bbc', 'slm')] }; S.fulfil = 'delivery'; S.tipPct = 18; } }
  function demoOrder(status) {
    S.signedIn = true; demoCart();
    const o = { id: 'SK' + ++orderSeq, rid: S.cart.rid, lines: S.cart.lines.map((l) => ({ ...l })), fulfil: 'delivery', q: curQuote(), status: 'waiting', when: 'Today, ' + nowTime(), timeline: [['waiting', nowTime()]], addr: addr().line };
    const steps = stepsFor(o); const idx = steps.findIndex((s) => s[0] === status);
    for (let i = 1; i <= idx; i++) o.timeline.push([steps[i][0], nowTime()]);
    o.status = status; S.orders.unshift(o); S.activeId = o.id; S.ordersTab = 'active'; S.cart = { rid: null, lines: [] };
    schedule(o); return o;
  }
  function setHash(k) { try { history.replaceState(null, '', '#' + k); } catch (e) { try { location.hash = k; } catch (e2) { /* ignore */ } } }
  function openPage(k) {
    S.sheet = null; S.modal = null; S.stack = [];
    if (k === 'item') { S.rid = 'bbc'; S.tab = 0; S.screen = 'restaurant'; S.stack = ['home']; setHash(k); A.openItem({ id: 'gcb' }); return; }
    if (k === 'restaurant') { S.rid = S.rid || 'bbc'; S.tab = 0; S.stack = ['home']; }
    if (k === 'cart') { demoCart(); S.stack = ['home']; }
    if (k === 'checkout') { demoCart(); S.signedIn = true; S.stack = ['home', 'cart']; }
    if (k === 'confirm') { demoOrder('waiting'); S.stack = ['home']; }
    if (k === 'track') { const live = S.orders.find((x) => x.id === S.activeId && !['delivered', 'collected', 'declined'].includes(x.status)); S.activeId = (live || demoOrder('picked')).id; S.stack = ['home']; }
    if (k === 'account') S.signedIn = true;
    if (k === 'profile' || k === 'wallet' || k === 'payments' || k === 'refer') { S.signedIn = true; S.profile = null; S.stack = ['home', 'account']; }
    if (k === 'signin') { S.codeSent = false; S.code = ''; S.stack = ['home']; }
    if (k === 'addresses' || k === 'help') S.stack = ['home'];
    if (k === 'addrForm') { S.addrForm = { street: '', apt: '', note: '', label: 'Other', def: false }; S.stack = ['home', 'account']; }
    S.screen = k; applyFulfil(k); setHash(k); render(true);
  }
  A.page = (d) => openPage(d.k);
  const h = (location.hash || '').slice(1);
  if (PAGES.some((p) => p[0] === h)) openPage(h); else render(true);
})();
