const { chromium } = require('playwright');
(async () => { const [name, w, h] = process.argv.slice(2); const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +w, height: +h } });
 await p.route(/fonts\.googleapis/, r => r.fulfill({ contentType: 'text/css', body: require('fs').readFileSync(__dirname + '/localfonts.css', 'utf8') }));
 await p.goto('file://' + __dirname + '/../prototypes/' + name + '.html'); await p.waitForTimeout(300);
 const keys = await p.$$eval('.pages [data-k]', bs => bs.map(b => b.dataset.k)); const all = {};
 for (const k of keys) { await p.click(`.pages [data-k="${k}"]`); await p.waitForTimeout(150);
   const bad = await p.evaluate(() => {
     const hsl = (s) => { const m = s.match(/[\d.]+/g); if (!m) return null; const [r, g, bl] = m.slice(0, 3).map(x => x / 255); const a = m[3] === undefined ? 1 : +m[3]; if (a < 0.08) return null; const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl), l = (mx + mn) / 2, d = mx - mn; if (d < 0.0001) return { h: 0, s: 0, l }; const sat = d / (1 - Math.abs(2 * l - 1)); let h = mx === r ? ((g - bl) / d) % 6 : mx === g ? (bl - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360; return { h, s: sat, l }; };
     const ok = (c) => { const x = hsl(c); if (!x) return true; if (x.s < 0.14 || x.l > 0.93 || x.l < 0.07) return true; if (x.h >= 198 && x.h <= 228) return true; if (x.h >= 348 || x.h <= 8) return true; return false; };
     const out = new Set();
     document.querySelectorAll('#app *').forEach((el) => { if (el.closest('.pages,.demo,image,img')) return; const r = el.getBoundingClientRect(); if (!r.width || !r.height) return; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') return;
       const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
       const checks = [['bg', cs.backgroundColor]]; if (own) checks.push(['text', cs.color]); if (parseFloat(cs.borderTopWidth) > 0) checks.push(['border', cs.borderTopColor]);
       if (el instanceof SVGElement) { if (cs.fill && cs.fill !== 'none' && !cs.fill.startsWith('url')) checks.push(['fill', cs.fill]); if (cs.stroke && cs.stroke !== 'none') checks.push(['stroke', cs.stroke]); }
       const bgi = cs.backgroundImage; if (bgi && bgi !== 'none') (bgi.match(/rgba?\([^)]*\)/g) || []).forEach((c) => checks.push(['gradient', c]));
       checks.forEach(([t, c]) => { if (!ok(c)) out.add(`${t} ${c} · ${(el.className && el.className.baseVal !== undefined ? el.tagName : el.className || el.tagName).toString().slice(0, 24)} "${(el.textContent || '').trim().slice(0, 22)}"`); }); });
     return [...out].slice(0, 6); });
   if (bad.length) all[k] = bad; }
 for (const [k, v] of Object.entries(all)) console.log(k, '→\n   ' + v.join('\n   ')); console.log(name, 'pages', keys.length, 'pages with other colours:', Object.keys(all).length); await b.close(); })();
